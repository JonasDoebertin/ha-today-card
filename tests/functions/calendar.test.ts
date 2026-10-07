import {
    afterEach,
    beforeEach,
    describe,
    expect,
    setSystemTime,
    spyOn,
    test,
} from "bun:test";
import {CalendarResult, getEvents} from "../../src/functions/calendar";
import {CardConfig} from "../../src/structs/config";
import {
    calendarApi,
    cardConfig,
    entityRow,
    fakeHass,
} from "../support/factories";

type Responses = Record<string, Record<string, unknown>[] | Error>;

async function fetchWith(
    config: Partial<CardConfig>,
    responses: Responses,
): Promise<CalendarResult> {
    const entities = Object.keys(responses).map((entity) => entityRow(entity));

    return getEvents(
        cardConfig({...config, entities}),
        entities,
        fakeHass({callApi: calendarApi(responses)}),
    );
}

async function titlesFrom(
    config: Partial<CardConfig>,
    responses: Responses,
): Promise<string[]> {
    const {events} = await fetchWith(config, responses);

    return events.map((event) => event.title);
}

function timed(
    summary: string,
    start: string,
    end: string,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: summary,
        summary,
        start: {dateTime: start},
        end: {dateTime: end},
        ...overrides,
    };
}

function allDay(
    summary: string,
    startDate: string,
    endDate: string,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: summary,
        summary,
        start: {date: startDate},
        end: {date: endDate},
        ...overrides,
    };
}

/** Swallow the errors the failure path logs, so a green run stays readable. */
function silenceConsole(): () => void {
    const original = console.error;
    console.error = (): void => {};

    return (): void => {
        console.error = original;
    };
}

beforeEach((): void => {
    setSystemTime(new Date("2026-09-18T10:00:00Z"));
});

afterEach((): void => {
    setSystemTime();
});

describe("the window it asks for", (): void => {
    async function requestedPaths(
        config: Partial<CardConfig>,
        entityIds: string[],
    ): Promise<string[]> {
        const paths: string[] = [];
        const entities = entityIds.map((entity) => entityRow(entity));

        await getEvents(
            cardConfig({...config, entities}),
            entities,
            fakeHass({
                callApi: async (
                    _method: string,
                    path: string,
                ): Promise<unknown> => {
                    paths.push(path);
                    return [];
                },
            }),
        );

        return paths;
    }

    test("asks each calendar for today", async (): Promise<void> => {
        const paths = await requestedPaths({}, ["calendar.a", "calendar.b"]);

        expect(paths).toHaveLength(2);
        expect(paths[0]).toStartWith("calendars/calendar.a?");
        expect(paths[1]).toStartWith("calendars/calendar.b?");
        expect(paths[0]).toContain("start=2026-09-18T00:00:00.000Z");
        expect(paths[0]).toContain("end=2026-09-18T23:59:59.999Z");
    });

    test("moves the window with the advance offset", async (): Promise<void> => {
        const [path] = await requestedPaths({advance: 1}, ["calendar.a"]);

        expect(path).toContain("start=2026-09-19T00:00:00.000Z");
        expect(path).toContain("end=2026-09-19T23:59:59.999Z");
    });

    test("looks backwards for a negative advance", async (): Promise<void> => {
        const [path] = await requestedPaths({advance: -1}, ["calendar.a"]);

        expect(path).toContain("start=2026-09-17T00:00:00.000Z");
    });

    test("asks nothing when no calendar is configured", async (): Promise<void> => {
        expect(await requestedPaths({}, [])).toEqual([]);
    });
});

describe("filtering", (): void => {
    const past = timed("Past", "2026-09-18T08:00:00Z", "2026-09-18T09:00:00Z");
    const current = timed(
        "Current",
        "2026-09-18T09:30:00Z",
        "2026-09-18T11:00:00Z",
    );
    const future = timed(
        "Future",
        "2026-09-18T14:00:00Z",
        "2026-09-18T15:00:00Z",
    );
    const holiday = allDay("Holiday", "2026-09-18", "2026-09-19");

    test("keeps everything when both switches are on", async (): Promise<void> => {
        const titles = await titlesFrom(
            {show_all_day_events: true, show_past_events: true},
            {"calendar.a": [past, current, future, holiday]},
        );

        expect(titles).toContain("Past");
        expect(titles).toContain("Holiday");
        expect(titles).toHaveLength(4);
    });

    test("drops all-day events when they are switched off", async (): Promise<void> => {
        const titles = await titlesFrom(
            {show_all_day_events: false},
            {"calendar.a": [current, holiday]},
        );

        expect(titles).toEqual(["Current"]);
    });

    test("drops finished events when past events are switched off", async (): Promise<void> => {
        const titles = await titlesFrom(
            {show_past_events: false},
            {"calendar.a": [past, current, future]},
        );

        expect(titles).toEqual(["Current", "Future"]);
    });

    test("keeps a past event that is still running", async (): Promise<void> => {
        // Started before now but not yet finished, so it is not in the past.
        const titles = await titlesFrom(
            {show_past_events: false},
            {
                "calendar.a": [
                    timed(
                        "Running",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T11:00:00Z",
                    ),
                ],
            },
        );

        expect(titles).toEqual(["Running"]);
    });

    test("drops an all-day event that ended before the day on screen", async (): Promise<void> => {
        // This rule applies regardless of show_past_events, which is why an
        // all-day event from last week never shows up.
        const titles = await titlesFrom(
            {show_past_events: true, advance: 1},
            {
                "calendar.a": [
                    allDay("Yesterday", "2026-09-17", "2026-09-18"),
                    allDay("Tomorrow", "2026-09-19", "2026-09-20"),
                ],
            },
        );

        expect(titles).toEqual(["Tomorrow"]);
    });

    test("merges the events of several calendars", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [current],
                "calendar.b": [future],
            },
        );

        expect(titles.sort()).toEqual(["Current", "Future"]);
    });
});

describe("excluding events", (): void => {
    const standup = timed(
        "Daily Standup",
        "2026-09-18T09:00:00Z",
        "2026-09-18T09:15:00Z",
    );
    const review = timed(
        "Design Review",
        "2026-09-18T11:00:00Z",
        "2026-09-18T12:00:00Z",
        {description: "Bring the quarterly notes"},
    );

    async function remaining(exclude: string[]): Promise<string[]> {
        return titlesFrom({exclude}, {"calendar.a": [standup, review]});
    }

    test("matches a plain substring, whatever the casing", async (): Promise<void> => {
        expect(await remaining(["standup"])).toEqual(["Design Review"]);
        expect(await remaining(["STANDUP"])).toEqual(["Design Review"]);
    });

    test("matches against the description as well as the title", async (): Promise<void> => {
        expect(await remaining(["quarterly"])).toEqual(["Daily Standup"]);
        expect(await remaining(["/QUARTERLY/i"])).toEqual(["Daily Standup"]);
    });

    test("matches a regular expression and honors its flags", async (): Promise<void> => {
        expect(await remaining(["/^daily/i"])).toEqual(["Design Review"]);
        expect(await remaining(["/^daily/"])).toEqual([
            "Daily Standup",
            "Design Review",
        ]);
        expect(await remaining(["/review$/i"])).toEqual(["Daily Standup"]);
    });

    test("falls back to plain text when a regular expression does not compile", async (): Promise<void> => {
        // Matching the whole pattern including its slashes would never match a
        // real title, so the body is used as a substring instead.
        const titles = await titlesFrom(
            {exclude: ["/Standup/"]},
            {"calendar.a": [standup, review]},
        );

        expect(titles).toEqual(["Design Review"]);
        expect(await remaining(["/[unclosed/"])).toEqual([
            "Daily Standup",
            "Design Review",
        ]);
    });

    test("ignores an empty or blank pattern", async (): Promise<void> => {
        // An empty string is a substring of every title, so treating it as a
        // pattern would blank the whole card. YAML lets one through where the
        // editor would have stripped it.
        expect(await remaining([""])).toEqual([
            "Daily Standup",
            "Design Review",
        ]);
        expect(await remaining(["   "])).toEqual([
            "Daily Standup",
            "Design Review",
        ]);
        expect(await remaining(["", "standup"])).toEqual(["Design Review"]);
    });

    test("leaves the list alone when nothing matches or nothing is configured", async (): Promise<void> => {
        expect(await remaining(["nothing like this"])).toEqual([
            "Daily Standup",
            "Design Review",
        ]);
        expect(await remaining([])).toEqual(["Daily Standup", "Design Review"]);
        expect(await titlesFrom({}, {"calendar.a": [standup, review]})).toEqual(
            ["Daily Standup", "Design Review"],
        );
    });
});

describe("ordering", (): void => {
    test("puts all-day events above timed ones", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    timed(
                        "Early meeting",
                        "2026-09-18T06:00:00Z",
                        "2026-09-18T07:00:00Z",
                    ),
                    allDay("Holiday", "2026-09-18", "2026-09-19"),
                ],
            },
        );

        expect(titles).toEqual(["Holiday", "Early meeting"]);
    });

    test("puts the longer all-day span first", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    allDay("One day", "2026-09-18", "2026-09-19"),
                    allDay("Four days", "2026-09-16", "2026-09-20"),
                    allDay("Two days", "2026-09-18", "2026-09-20"),
                ],
            },
        );

        expect(titles).toEqual(["Four days", "Two days", "One day"]);
    });

    test("puts the span that is further along first when they are equally long", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    allDay("Starting today", "2026-09-18", "2026-09-20"),
                    allDay("Ending today", "2026-09-17", "2026-09-19"),
                ],
            },
        );

        expect(titles).toEqual(["Ending today", "Starting today"]);
    });

    test("falls back to the title when spans are otherwise equal", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    allDay("Zebra", "2026-09-18", "2026-09-19"),
                    allDay("Apple", "2026-09-18", "2026-09-19"),
                ],
            },
        );

        expect(titles).toEqual(["Apple", "Zebra"]);
    });

    test("orders timed events by when they start", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    timed(
                        "Afternoon",
                        "2026-09-18T14:00:00Z",
                        "2026-09-18T15:00:00Z",
                    ),
                    timed(
                        "Morning",
                        "2026-09-18T08:00:00Z",
                        "2026-09-18T09:00:00Z",
                    ),
                    timed(
                        "Noon",
                        "2026-09-18T12:00:00Z",
                        "2026-09-18T13:00:00Z",
                    ),
                ],
            },
        );

        expect(titles).toEqual(["Morning", "Noon", "Afternoon"]);
    });

    test("puts the shorter one first when two start together", async (): Promise<void> => {
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    timed(
                        "Long",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T17:00:00Z",
                    ),
                    timed(
                        "Short",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T09:30:00Z",
                    ),
                ],
            },
        );

        expect(titles).toEqual(["Short", "Long"]);
    });

    test("anchors a timed event already under way to the start of the day", async (): Promise<void> => {
        // It began yesterday, so sorting by its own start would push it above
        // everything. It belongs at the top of today instead.
        const titles = await titlesFrom(
            {},
            {
                "calendar.a": [
                    timed(
                        "Early today",
                        "2026-09-18T06:00:00Z",
                        "2026-09-18T07:00:00Z",
                    ),
                    timed(
                        "Since yesterday",
                        "2026-09-17T20:00:00Z",
                        "2026-09-19T06:00:00Z",
                    ),
                ],
            },
        );

        expect(titles).toEqual(["Since yesterday", "Early today"]);
    });
});

describe("limiting", (): void => {
    const events = [
        timed("One", "2026-09-18T08:00:00Z", "2026-09-18T09:00:00Z"),
        timed("Two", "2026-09-18T10:00:00Z", "2026-09-18T11:00:00Z"),
        timed("Three", "2026-09-18T12:00:00Z", "2026-09-18T13:00:00Z"),
    ];

    test("keeps the first events after sorting, not the first fetched", async (): Promise<void> => {
        const titles = await titlesFrom({limit: 2}, {"calendar.a": events});

        expect(titles).toEqual(["One", "Two"]);
    });

    test("treats zero, absent and negative limits as no limit", async (): Promise<void> => {
        expect(await titlesFrom({limit: 0}, {"calendar.a": events})) //
            .toHaveLength(3);
        expect(await titlesFrom({}, {"calendar.a": events})).toHaveLength(3);
        expect(await titlesFrom({limit: -1}, {"calendar.a": events})) //
            .toHaveLength(3);
    });

    test("is harmless when it exceeds the number of events", async (): Promise<void> => {
        expect(await titlesFrom({limit: 10}, {"calendar.a": events})) //
            .toHaveLength(3);
    });
});

describe("reporting calendars that fail", (): void => {
    const event = timed(
        "Standup",
        "2026-09-18T09:00:00Z",
        "2026-09-18T09:30:00Z",
    );

    test("reports nothing when every calendar answers", async (): Promise<void> => {
        const {failed} = await fetchWith({}, {"calendar.a": [event]});

        expect(failed).toEqual([]);
    });

    test("names the calendar that failed and keeps the others", async (): Promise<void> => {
        // A failed calendar contributes no events, which looks exactly like a
        // calendar with nothing on today. The card needs to tell them apart.
        const restore = silenceConsole();

        try {
            const {events, failed} = await fetchWith(
                {},
                {
                    "calendar.broken": new Error("gateway timeout"),
                    "calendar.working": [event],
                },
            );

            expect(failed).toEqual(["calendar.broken"]);
            expect(events.map((each) => each.title)).toEqual(["Standup"]);
        } finally {
            restore();
        }
    });

    test("names every calendar that failed", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const {events, failed} = await fetchWith(
                {},
                {
                    "calendar.a": new Error("down"),
                    "calendar.b": new Error("down"),
                },
            );

            expect(failed.sort()).toEqual(["calendar.a", "calendar.b"]);
            expect(events).toEqual([]);
        } finally {
            restore();
        }
    });

    test("resolves rather than rejecting, so one bad calendar cannot break the card", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            await expect(
                fetchWith({}, {"calendar.a": new Error("down")}),
            ).resolves.toBeDefined();
        } finally {
            restore();
        }
    });
});

describe("giving up on a calendar that does not answer", (): void => {
    type Scheduled = {callback: () => void; delay: number | undefined};

    test("reports it as failed once the request times out", async (): Promise<void> => {
        const restore = silenceConsole();
        const scheduled: Scheduled[] = [];
        const setTimeout = spyOn(globalThis, "setTimeout").mockImplementation(((
            callback: () => void,
            delay?: number,
        ): number => {
            scheduled.push({callback, delay});
            return scheduled.length;
        }) as unknown as typeof globalThis.setTimeout);

        try {
            const pending = getEvents(
                cardConfig({entities: ["calendar.hung"]}),
                [entityRow("calendar.hung")],
                fakeHass({
                    callApi: (): Promise<unknown> => new Promise(() => {}),
                }),
            );

            const timeout = scheduled.find(
                (entry: Scheduled): boolean => entry.delay === 30_000,
            );
            expect(timeout).toBeDefined();
            timeout?.callback();

            expect(await pending).toEqual({
                events: [],
                failed: ["calendar.hung"],
            });
        } finally {
            setTimeout.mockRestore();
            restore();
        }
    });

    test("clears the timeout once the calendar answers", async (): Promise<void> => {
        const setTimeout = spyOn(globalThis, "setTimeout");
        const clearTimeout = spyOn(globalThis, "clearTimeout");

        try {
            await fetchWith({}, {"calendar.a": []});

            const index = setTimeout.mock.calls.findIndex(
                (call: unknown[]): boolean => call[1] === 30_000,
            );
            expect(index).toBeGreaterThanOrEqual(0);
            expect(clearTimeout).toHaveBeenCalledWith(
                setTimeout.mock.results[index]?.value,
            );
        } finally {
            setTimeout.mockRestore();
            clearTimeout.mockRestore();
        }
    });
});

describe("a calendar that answers with a malformed event", (): void => {
    const good = timed(
        "Standup",
        "2026-09-18T09:00:00Z",
        "2026-09-18T09:30:00Z",
    );

    test.each([
        [
            "no start",
            {
                id: "x",
                summary: "Broken",
                end: {dateTime: "2026-09-18T11:00:00Z"},
            },
        ],
        [
            "no end",
            {
                id: "x",
                summary: "Broken",
                start: {dateTime: "2026-09-18T10:00:00Z"},
            },
        ],
        [
            "an empty start",
            {id: "x", summary: "Broken", start: {}, end: {date: "2026-09-19"}},
        ],
    ])(
        "fails only that calendar when an event has %s",
        async (_label, broken): Promise<void> => {
            const restore = silenceConsole();

            try {
                const {events, failed} = await fetchWith(
                    {},
                    {"calendar.broken": [broken], "calendar.working": [good]},
                );

                expect(failed).toEqual(["calendar.broken"]);
                expect(events.map((each) => each.title)).toEqual(["Standup"]);
            } finally {
                restore();
            }
        },
    );
});
