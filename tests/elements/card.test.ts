import {
    afterEach,
    beforeEach,
    describe,
    expect,
    setSystemTime,
    spyOn,
    test,
} from "bun:test";
import {TodayCard} from "../../src/elements/card";
import {CardConfig, cardConfigStruct} from "../../src/structs/config";
import {is} from "superstruct";
import localize from "../../src/localization/localize";
import {setHass} from "../../src/globals";
import {
    calendarApi,
    cardConfig,
    entityState,
    fakeHass,
} from "../support/factories";
import {
    mount,
    settle,
    shadowAll,
    shadowHtml,
    shadowOne,
} from "../support/mount";

type Responses = Record<string, Record<string, unknown>[] | Error>;

interface Configurable extends HTMLElement {
    setConfig(config: CardConfig): void;
}

async function mountCard(
    config: Partial<CardConfig> = {},
    responses: Responses = {"calendar.work": []},
    states: Record<string, unknown> = {},
): Promise<Configurable> {
    const card = await mount<Configurable>("today-card", {
        hass: fakeHass({callApi: calendarApi(responses), states}),
    });

    card.setConfig(
        cardConfig({
            entities: Object.keys(responses),
            ...config,
        } as Partial<CardConfig>),
    );
    await settle(card);

    return card;
}

function timed(
    summary: string,
    start: string,
    end: string,
): Record<string, unknown> {
    return {
        id: summary,
        summary,
        start: {dateTime: start},
        end: {dateTime: end},
    };
}

function allDay(
    summary: string,
    startDate: string,
    endDate: string,
): Record<string, unknown> {
    return {
        id: summary,
        summary,
        start: {date: startDate},
        end: {date: endDate},
    };
}

function classesOfFirstEvent(card: HTMLElement): string[] {
    const event = shadowOne(card, ".event");

    return Array.from(event?.classList ?? []);
}

function silenceConsole(): () => void {
    const original = console.error;
    console.error = (): void => {};

    return (): void => {
        console.error = original;
    };
}

type TimerSpy = {
    mock: {calls: unknown[][]; results: {value: unknown}[]};
};

function scheduledDelays(spy: TimerSpy): unknown[] {
    return spy.mock.calls.map((call: unknown[]): unknown => call[1]);
}

/** The callback the card scheduled with a given delay. */
function scheduledAfter(spy: TimerSpy, delay: number): () => void {
    const call = spy.mock.calls.find((entry: unknown[]): boolean => {
        return entry[1] === delay;
    });

    if (call === undefined) {
        throw new Error(`nothing was scheduled ${delay}ms out`);
    }

    return call[0] as () => void;
}

/** The timer id the card was handed for a given delay. */
function timerScheduledAfter(spy: TimerSpy, delay: number): unknown {
    const index = spy.mock.calls.findIndex((entry: unknown[]): boolean => {
        return entry[1] === delay;
    });

    return index < 0 ? undefined : spy.mock.results[index]?.value;
}

beforeEach((): void => {
    setSystemTime(new Date("2026-09-18T10:00:00Z"));
});

afterEach((): void => {
    setSystemTime();
});

describe("what the card shows", (): void => {
    test("says nothing is scheduled when every calendar answers and none has anything", async (): Promise<void> => {
        const card = await mountCard();
        const html = shadowHtml(card);

        expect(html).toContain("is-fallback");
        expect(html).toContain(localize("noEvents.title"));
        expect(html).toContain(localize("noEvents.subtitle"));
    });

    test("renders one row per event, in order", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {
                "calendar.work": [
                    timed(
                        "Retro",
                        "2026-09-18T15:00:00Z",
                        "2026-09-18T16:00:00Z",
                    ),
                    timed(
                        "Standup",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T09:15:00Z",
                    ),
                ],
            },
        );

        const titles = shadowAll(card, ".event .title strong").map(
            (element) => element.textContent,
        );

        expect(titles).toEqual(["Standup", "Retro"]);
        expect(shadowHtml(card)).not.toContain("is-fallback");
    });

    test("shows the time schedule alongside the title", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {
                "calendar.work": [
                    timed(
                        "Standup",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T09:15:00Z",
                    ),
                ],
            },
        );

        expect(shadowOne(card, ".event .schedule")?.textContent).toBe(
            "09:00 – 09:15",
        );
    });

    test("names the calendars it could not reach", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const card = await mountCard(
                {},
                {"calendar.work": new Error("gateway timeout")},
                {"calendar.work": entityState("Work Calendar")},
            );
            const html = shadowHtml(card);

            expect(html).toContain("is-error");
            expect(html).toContain(localize("error.title"));
            expect(html).toContain("Work Calendar");
        } finally {
            restore();
        }
    });

    test("does not claim the day is empty when it does not know", async (): Promise<void> => {
        // An unreachable calendar means an unknown day. Telling the user to
        // go and do something nice would be a lie.
        const restore = silenceConsole();

        try {
            const card = await mountCard(
                {},
                {"calendar.work": new Error("down")},
            );

            expect(shadowHtml(card)).not.toContain("is-fallback");
        } finally {
            restore();
        }
    });

    test("shows the error above the events it did get", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const card = await mountCard(
                {},
                {
                    "calendar.broken": new Error("down"),
                    "calendar.work": [
                        timed(
                            "Standup",
                            "2026-09-18T09:00:00Z",
                            "2026-09-18T09:15:00Z",
                        ),
                    ],
                },
            );
            const rows = shadowAll(card, ".event");

            expect(Array.from(rows[0]?.classList ?? [])).toContain("is-error");
            expect(rows).toHaveLength(2);
        } finally {
            restore();
        }
    });

    test("renders nothing at all before Home Assistant hands it a connection", async (): Promise<void> => {
        const card = await mount("today-card");

        // Lit leaves its own comment markers behind, so the absence of a card
        // frame is what "nothing" means here.
        expect(shadowOne(card, "ha-card")).toBeNull();
        expect(shadowAll(card, ".event")).toEqual([]);
    });
});

describe("the class hooks card-mod users style against", (): void => {
    test("marks an event still to come", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {
                "calendar.work": [
                    timed(
                        "Later",
                        "2026-09-18T14:00:00Z",
                        "2026-09-18T15:00:00Z",
                    ),
                ],
            },
        );

        expect(classesOfFirstEvent(card)).toContain("is-in-future");
    });

    test("marks an event that has finished", async (): Promise<void> => {
        const card = await mountCard(
            {show_past_events: true},
            {
                "calendar.work": [
                    timed(
                        "Done",
                        "2026-09-18T08:00:00Z",
                        "2026-09-18T09:00:00Z",
                    ),
                ],
            },
        );

        expect(classesOfFirstEvent(card)).toContain("is-in-past");
    });

    test("marks an event under way", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {
                "calendar.work": [
                    timed(
                        "Now",
                        "2026-09-18T09:30:00Z",
                        "2026-09-18T11:00:00Z",
                    ),
                ],
            },
        );

        expect(classesOfFirstEvent(card)).toContain("is-current");
    });

    test("marks an all-day event", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {
                "calendar.work": [
                    allDay("Holiday", "2026-09-18", "2026-09-19"),
                ],
            },
        );

        const classes = classesOfFirstEvent(card);

        expect(classes).toContain("is-all-day");
        expect(classes).not.toContain("is-multi-day");
    });

    test("marks the first, middle and last day of a span", async (): Promise<void> => {
        const span = allDay("Trip", "2026-09-17", "2026-09-20");

        setSystemTime(new Date("2026-09-17T10:00:00Z"));
        const first = await mountCard({}, {"calendar.work": [span]});
        expect(classesOfFirstEvent(first)).toContain("is-first-day");
        expect(classesOfFirstEvent(first)).not.toContain("is-last-day");

        setSystemTime(new Date("2026-09-18T10:00:00Z"));
        const middle = await mountCard({}, {"calendar.work": [span]});
        expect(classesOfFirstEvent(middle)).toContain("is-multi-day");
        expect(classesOfFirstEvent(middle)).not.toContain("is-first-day");
        expect(classesOfFirstEvent(middle)).not.toContain("is-last-day");

        setSystemTime(new Date("2026-09-19T10:00:00Z"));
        const last = await mountCard({}, {"calendar.work": [span]});
        expect(classesOfFirstEvent(last)).toContain("is-last-day");
    });

    test("shows which day of a span is on screen", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {
                "calendar.work": [allDay("Trip", "2026-09-17", "2026-09-20")],
            },
        );

        expect(shadowOne(card, ".event .title span")?.textContent).toBe(
            "(2/3)",
        );
    });
});

describe("the card frame", (): void => {
    test("passes a configured title to the header", async (): Promise<void> => {
        const card = await mountCard({title: "Today"});

        expect(shadowOne(card, "ha-card")?.getAttribute("header")).toBe(
            "Today",
        );
    });

    test("leaves the header off when no title is configured", async (): Promise<void> => {
        const card = await mountCard({title: ""});

        expect(shadowOne(card, "ha-card")?.hasAttribute("header")).toBe(false);
    });

    test("reports the advance offset as a class, so a shifted card can be styled", async (): Promise<void> => {
        const today = await mountCard();
        expect(shadowOne(today, "ha-card")?.className).toContain(
            "has-advance-of-0",
        );

        const tomorrow = await mountCard({advance: 1});
        expect(shadowOne(tomorrow, "ha-card")?.className).toContain(
            "has-advance-of-1",
        );
    });

    test("is not announced as interactive when tapping does nothing", async (): Promise<void> => {
        const card = await mountCard({tap_action: {action: "none"}});
        const frame = shadowOne(card, "ha-card");

        expect(frame?.hasAttribute("role")).toBe(false);
        expect(frame?.hasAttribute("tabindex")).toBe(false);
        expect(shadowOne(card, "ha-ripple")).toBeNull();
    });

    test("is a focusable button when tapping does something", async (): Promise<void> => {
        const card = await mountCard({
            tap_action: {action: "navigate", navigation_path: "/lovelace/0"},
        });
        const frame = shadowOne(card, "ha-card");

        expect(frame?.getAttribute("role")).toBe("button");
        expect(frame?.getAttribute("tabindex")).toBe("0");
        expect(shadowOne(card, "ha-ripple")).not.toBeNull();
    });
});

describe("the size it claims in a masonry column", (): void => {
    test("counts one row even when there is nothing to show", async (): Promise<void> => {
        const card = await mountCard({title: ""});

        expect((card as unknown as TodayCard).getCardSize()).toBe(1);
    });

    test("counts the title as a row of its own", async (): Promise<void> => {
        const card = await mountCard({title: "Today"});

        expect((card as unknown as TodayCard).getCardSize()).toBe(2);
    });

    test("grows with the number of events", async (): Promise<void> => {
        const card = await mountCard(
            {title: "Today"},
            {
                "calendar.work": [
                    timed("A", "2026-09-18T09:00:00Z", "2026-09-18T10:00:00Z"),
                    timed("B", "2026-09-18T11:00:00Z", "2026-09-18T12:00:00Z"),
                ],
            },
        );

        expect((card as unknown as TodayCard).getCardSize()).toBe(3);
    });

    test("counts the row naming calendars it could not reach", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const card = await mountCard(
                {title: "Today"},
                {
                    "calendar.work": [
                        timed(
                            "A",
                            "2026-09-18T09:00:00Z",
                            "2026-09-18T10:00:00Z",
                        ),
                    ],
                    "calendar.home": new Error("down"),
                },
            );

            expect((card as unknown as TodayCard).getCardSize()).toBe(3);
        } finally {
            restore();
        }
    });
});

describe("the configuration it suggests", (): void => {
    test("keeps only calendars", (): void => {
        const config = TodayCard.getStubConfig(
            fakeHass(),
            ["light.kitchen", "calendar.work"],
            [],
        );

        expect(config.entities).toEqual([
            {entity: "calendar.work", color: "light-blue"},
        ]);
    });

    test("falls back to the second list when the first has no calendar", (): void => {
        const config = TodayCard.getStubConfig(
            fakeHass(),
            ["light.kitchen"],
            ["calendar.home"],
        );

        expect(config.entities).toEqual([
            {entity: "calendar.home", color: "light-blue"},
        ]);
    });

    test("produces a configuration the card will accept", (): void => {
        const config = TodayCard.getStubConfig(
            fakeHass(),
            ["calendar.work", "calendar.home"],
            [],
        );

        expect(is(config, cardConfigStruct)).toBe(true);
    });

    test("offers itself for a calendar entity and stays out of the way otherwise", (): void => {
        expect(
            TodayCard.getEntitySuggestion(fakeHass(), "light.kitchen"),
        ).toBeNull();

        const suggestion = TodayCard.getEntitySuggestion(
            fakeHass(),
            "calendar.work",
        );

        expect(suggestion?.config.entities).toEqual([
            {entity: "calendar.work", color: "light-blue"},
        ]);
    });

    test("titles the stub config in the given hass's language, even before hass is known globally", (): void => {
        setHass(null as never);

        const config = TodayCard.getStubConfig(
            fakeHass({language: "de"}),
            ["calendar.work"],
            [],
        );

        expect(config.title).toBe(localize("config.stub.title", "de"));
    });

    test("titles the entity suggestion in the given hass's language, even before hass is known globally", (): void => {
        setHass(null as never);

        const suggestion = TodayCard.getEntitySuggestion(
            fakeHass({language: "de"}),
            "calendar.work",
        );

        expect(suggestion?.config.title).toBe(
            localize("config.stub.title", "de"),
        );
    });
});

describe("keeping itself up to date", (): void => {
    test("starts refreshing when it is added and stops when it is removed", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");
        const clearTimeout = spyOn(window, "clearTimeout");

        try {
            const card = await mount("today-card", {hass: fakeHass()});
            const timer = timerScheduledAfter(setTimeout, 60_000);
            expect(timer).toBeDefined();

            card.remove();
            expect(clearTimeout).toHaveBeenCalledWith(timer);
        } finally {
            setTimeout.mockRestore();
            clearTimeout.mockRestore();
        }
    });

    test("fetches as soon as Home Assistant arrives after the configuration", async (): Promise<void> => {
        // The order Home Assistant itself uses: the configuration lands on a
        // card that has no connection yet.
        const card = document.createElement("today-card") as Configurable;
        document.body.appendChild(card);

        card.setConfig(cardConfig({entities: ["calendar.work"]}));
        (card as unknown as TodayCard).hass = fakeHass({
            callApi: calendarApi({
                "calendar.work": [
                    timed(
                        "Standup",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T09:15:00Z",
                    ),
                ],
            }),
        });
        await settle(card);

        expect(
            shadowAll(card, ".event .title strong").map(
                (element) => element.textContent,
            ),
        ).toEqual(["Standup"]);
    });

    test("fetches when the configuration lands in the same task as the connection", async (): Promise<void> => {
        const card = document.createElement("today-card") as Configurable;
        document.body.appendChild(card);

        (card as unknown as TodayCard).hass = fakeHass({
            callApi: calendarApi({
                "calendar.work": [
                    timed(
                        "Standup",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T09:15:00Z",
                    ),
                ],
            }),
        });
        card.setConfig(cardConfig({entities: ["calendar.work"]}));
        await settle(card);

        expect(
            shadowAll(card, ".event .title strong").map(
                (element) => element.textContent,
            ),
        ).toEqual(["Standup"]);
    });

    test("fetches through the connection it holds now, not the one it started with", async (): Promise<void> => {
        const card = await mountCard();
        let asked = "";

        (card as unknown as TodayCard).hass = fakeHass({
            callApi: async (
                _method: string,
                path: string,
            ): Promise<unknown> => {
                asked = path;
                return [];
            },
        });
        await (card as unknown as TodayCard).updateEvents();

        expect(asked).toContain("calendars/calendar.work");
    });

    test("starts a fresh timer when it is moved around the dashboard", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");

        try {
            const card = await mount("today-card", {hass: fakeHass()});
            card.remove();
            document.body.appendChild(card);
            await settle(card);

            const refreshes = scheduledDelays(setTimeout).filter(
                (delay: unknown): boolean => delay === 60_000,
            );

            expect(refreshes).toHaveLength(2);
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("catches up with the clock when it is attached again", async (): Promise<void> => {
        let calls = 0;
        const card = await mount<Configurable>("today-card", {
            hass: fakeHass({
                callApi: async (): Promise<unknown> => {
                    calls += 1;
                    return [
                        timed(
                            "Standup",
                            "2026-09-18T10:00:00Z",
                            "2026-09-18T10:30:00Z",
                        ),
                    ];
                },
            }),
        });
        card.setConfig(cardConfig({entities: ["calendar.work"]}));
        await settle(card);
        expect(classesOfFirstEvent(card)).toContain("is-current");

        card.remove();
        setSystemTime(new Date("2026-09-18T11:00:00Z"));
        const before = calls;
        document.body.appendChild(card);
        await settle(card);

        expect(calls).toBe(before + 1);
        expect(classesOfFirstEvent(card)).toContain("is-in-past");
    });

    test("hides an event that finished while it was detached", async (): Promise<void> => {
        const card = await mountCard(
            {show_past_events: false},
            {
                "calendar.work": [
                    timed(
                        "Standup",
                        "2026-09-18T10:00:00Z",
                        "2026-09-18T10:30:00Z",
                    ),
                ],
            },
        );
        expect(shadowAll(card, ".event.is-current")).toHaveLength(1);

        card.remove();
        setSystemTime(new Date("2026-09-18T11:00:00Z"));
        document.body.appendChild(card);
        await settle(card);

        expect(shadowAll(card, ".event.is-fallback")).toHaveLength(1);
    });

    test("does not stack timers when it is connected again without leaving", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");

        try {
            const card = await mount("today-card", {hass: fakeHass()});
            (card as unknown as TodayCard).connectedCallback();

            const refreshes = scheduledDelays(setTimeout).filter(
                (delay: unknown): boolean => delay === 60_000,
            );

            expect(refreshes).toHaveLength(1);
        } finally {
            setTimeout.mockRestore();
        }
    });
});

describe("rejecting a broken configuration", (): void => {
    test("refuses a negative limit", async (): Promise<void> => {
        const card = await mount<Configurable>("today-card", {
            hass: fakeHass(),
        });

        expect((): void => {
            card.setConfig({
                type: "custom:today-card",
                entities: [],
                limit: -1,
            } as unknown as CardConfig);
        }).toThrow();
    });

    test("refuses a configuration with no entities key", async (): Promise<void> => {
        const card = await mount<Configurable>("today-card", {
            hass: fakeHass(),
        });

        expect((): void => {
            card.setConfig({
                type: "custom:today-card",
            } as unknown as CardConfig);
        }).toThrow();
    });
});

describe("the space it asks the grid for", (): void => {
    test("asks for a sensible default footprint", async (): Promise<void> => {
        const card = await mountCard();

        expect((card as unknown as TodayCard).getLayoutOptions()).toEqual({
            grid_columns: 4,
            grid_min_columns: 2,
            grid_min_rows: 2,
        });
    });
});

describe("tapping the card", (): void => {
    async function tap(config: Partial<CardConfig>): Promise<unknown[]> {
        const card = await mountCard(config);
        const received: unknown[] = [];

        card.addEventListener("hass-action", (event: Event): void => {
            received.push((event as CustomEvent).detail);
        });

        const frame = shadowOne(card, "ha-card") as HTMLElement;
        const action = new Event("action", {bubbles: true, composed: true});
        (action as unknown as {detail: unknown}).detail = {action: "tap"};
        frame.dispatchEvent(action);

        return received;
    }

    test("hands the configured action to Home Assistant", async (): Promise<void> => {
        const tap_action = {
            action: "navigate" as const,
            navigation_path: "/lovelace/0",
        };

        expect(await tap({tap_action})).toEqual([
            {config: {tap_action}, action: "tap"},
        ]);
    });

    test("still reports a tap when the action is none, and lets Home Assistant ignore it", async (): Promise<void> => {
        const tap_action = {action: "none" as const};

        expect(await tap({tap_action})).toEqual([
            {config: {tap_action}, action: "tap"},
        ]);
    });
});

describe("refreshing on a timer", (): void => {
    test("schedules its first refresh on the next full minute", async (): Promise<void> => {
        setSystemTime(new Date("2026-09-18T10:00:37.500Z"));
        const setTimeout = spyOn(window, "setTimeout");

        try {
            await mount("today-card", {hass: fakeHass()});

            expect(scheduledDelays(setTimeout)).toContain(22_500);
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("puts the next refresh on the minute after that one fires", async (): Promise<void> => {
        setSystemTime(new Date("2026-09-18T10:00:37.500Z"));
        const setTimeout = spyOn(window, "setTimeout");

        try {
            await mount("today-card", {hass: fakeHass()});
            const tick = scheduledAfter(setTimeout, 22_500);

            setSystemTime(new Date("2026-09-18T10:01:00.020Z"));
            tick();

            expect(scheduledDelays(setTimeout)).toContain(59_980);
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("does not refresh twice for the same minute when the clock reads coarsely", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");

        try {
            await mount("today-card", {hass: fakeHass()});
            const tick = scheduledAfter(setTimeout, 60_000);

            // Firefox with resistFingerprinting rounds Date.now() down to
            // 100ms, so the callback can run while the clock still reads the
            // minute before.
            setSystemTime(new Date("2026-09-18T10:00:59.999Z"));
            tick();

            expect(scheduledDelays(setTimeout)).toContain(60_001);
            expect(scheduledDelays(setTimeout)).not.toContain(1);
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("fetches again when the timer fires", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");

        try {
            let calls = 0;
            const card = await mount<Configurable>("today-card", {
                hass: fakeHass({
                    callApi: async (): Promise<unknown> => {
                        calls += 1;
                        return [];
                    },
                }),
            });

            card.setConfig(cardConfig({entities: ["calendar.work"]}));
            await settle(card);
            const before = calls;

            scheduledAfter(setTimeout, 60_000)();
            await settle(card);

            expect(before).toBeGreaterThan(0);
            expect(calls).toBe(before + 1);
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("moves an event to under way on the minute even while a fetch is stuck", async (): Promise<void> => {
        setSystemTime(new Date("2026-09-18T10:00:37.500Z"));
        const setTimeout = spyOn(window, "setTimeout");
        const stuck = new Promise<void>((): void => {});
        let calls = 0;

        try {
            const card = await mount<Configurable>("today-card", {
                hass: fakeHass({
                    callApi: async (): Promise<unknown> => {
                        calls += 1;
                        if (calls > 1) {
                            await stuck;
                        }

                        return [
                            timed(
                                "Standup",
                                "2026-09-18T10:01:00Z",
                                "2026-09-18T10:02:00Z",
                            ),
                        ];
                    },
                }),
            });

            card.setConfig(cardConfig({entities: ["calendar.work"]}));
            await settle(card);
            expect(classesOfFirstEvent(card)).toContain("is-in-future");

            const tick = scheduledAfter(setTimeout, 22_500);
            setSystemTime(new Date("2026-09-18T10:01:00.020Z"));
            tick();
            await settle(card);

            expect(classesOfFirstEvent(card)).toContain("is-current");
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("moves an event to under way on the minute even when a connection update is pending", async (): Promise<void> => {
        setSystemTime(new Date("2026-09-18T10:00:37.500Z"));
        const setTimeout = spyOn(window, "setTimeout");
        const stuck = new Promise<void>((): void => {});
        let calls = 0;
        const callApi = async (): Promise<unknown> => {
            calls += 1;
            if (calls > 1) {
                await stuck;
            }

            return [
                timed(
                    "Standup",
                    "2026-09-18T10:01:00Z",
                    "2026-09-18T10:02:00Z",
                ),
            ];
        };

        try {
            const card = await mount<Configurable>("today-card", {
                hass: fakeHass({callApi}),
            });

            card.setConfig(cardConfig({entities: ["calendar.work"]}));
            await settle(card);

            const tick = scheduledAfter(setTimeout, 22_500);
            setSystemTime(new Date("2026-09-18T10:01:00.020Z"));
            (card as unknown as TodayCard).hass = fakeHass({
                callApi,
                states: {"light.kitchen": entityState("Kitchen")},
            });
            tick();
            await settle(card);

            expect(classesOfFirstEvent(card)).toContain("is-current");
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("goes back to ignoring unrelated updates once the timer has fired", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");

        try {
            const card = await mount<Configurable>("today-card", {
                hass: fakeHass({callApi: calendarApi({"calendar.work": []})}),
            });
            card.setConfig(cardConfig({entities: ["calendar.work"]}));
            await settle(card);

            scheduledAfter(setTimeout, 60_000)();
            await settle(card);

            const render = spyOn(card as unknown as TodayCard, "render");

            try {
                (card as unknown as TodayCard).hass = fakeHass({
                    callApi: calendarApi({"calendar.work": []}),
                    states: {"light.kitchen": entityState("Kitchen")},
                });
                await settle(card);

                expect(render).not.toHaveBeenCalled();
            } finally {
                render.mockRestore();
            }
        } finally {
            setTimeout.mockRestore();
        }
    });

    test("only fetches once while repeated connections arrive before the first answer", async (): Promise<void> => {
        let calls = 0;
        const blocked = new Promise<void>((): void => {});
        const callApi = async (): Promise<unknown> => {
            calls += 1;
            await blocked;
            return [];
        };

        const card = document.createElement("today-card") as Configurable;
        document.body.appendChild(card);
        card.setConfig(cardConfig({entities: ["calendar.work"]}));

        for (let i = 0; i < 3; i++) {
            (card as unknown as TodayCard).hass = fakeHass({callApi});
        }
        await settle(card);

        expect(calls).toBe(1);
    });

    test("fetches again on the next tick even when a request never answers", async (): Promise<void> => {
        const setTimeout = spyOn(window, "setTimeout");
        let calls = 0;

        try {
            const card = await mount<Configurable>("today-card", {
                hass: fakeHass({
                    callApi: (): Promise<unknown> => {
                        calls += 1;
                        return new Promise((): void => {});
                    },
                }),
            });

            card.setConfig(cardConfig({entities: ["calendar.work"]}));
            await settle(card);
            expect(calls).toBe(1);

            scheduledAfter(setTimeout, 60_000)();
            await settle(card);

            expect(calls).toBe(2);
        } finally {
            setTimeout.mockRestore();
        }
    });
});

describe("changing the configuration while a fetch is running", (): void => {
    test("shows the result for the newest configuration, whichever answers last", async (): Promise<void> => {
        const events = [
            timed("Gym", "2026-09-18T07:00:00Z", "2026-09-18T08:00:00Z"),
            timed("Standup", "2026-09-18T09:00:00Z", "2026-09-18T09:15:00Z"),
        ];
        let calls = 0;
        let release: (() => void) | undefined;
        const blocked = new Promise<void>((resolve): void => {
            release = resolve;
        });

        const card = await mount<Configurable>("today-card", {
            hass: fakeHass({
                callApi: async (): Promise<unknown> => {
                    calls += 1;
                    if (calls === 1) {
                        await blocked;
                    }

                    return events;
                },
            }),
        });

        const titles = (): (string | null)[] => {
            return shadowAll(card, ".event .title strong").map(
                (element) => element.textContent,
            );
        };

        card.setConfig(cardConfig({entities: ["calendar.work"]}));
        card.setConfig(
            cardConfig({entities: ["calendar.work"], exclude: ["Gym"]}),
        );
        await settle(card);
        expect(titles()).toEqual(["Standup"]);

        release?.();
        await settle(card);
        expect(titles()).toEqual(["Standup"]);
    });

    test("fetches each calendar once when it is listed twice, keeping the first color", async (): Promise<void> => {
        const asked: string[] = [];
        const card = await mount<Configurable>("today-card", {
            hass: fakeHass({
                callApi: async (
                    _method: string,
                    path: string,
                ): Promise<unknown> => {
                    asked.push(path);
                    return [
                        timed(
                            "Standup",
                            "2026-09-18T09:00:00Z",
                            "2026-09-18T09:15:00Z",
                        ),
                    ];
                },
            }),
        });

        card.setConfig(
            cardConfig({
                entities: [
                    {entity: "calendar.work", color: "#ff0000"},
                    {entity: "calendar.work", color: "#0000ff"},
                ],
            }),
        );
        await settle(card);

        expect(asked).toHaveLength(1);
        expect(shadowAll(card, ".event")).toHaveLength(1);
        expect(
            shadowOne(card, ".event .indicator")?.getAttribute("style"),
        ).toContain("#ff0000");
    });

    test("settles quietly when fetching fails outright", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const card = await mount<Configurable>("today-card", {
                hass: fakeHass({
                    callApi: (): never => {
                        throw new Error("no connection");
                    },
                }),
            });
            card.setConfig(cardConfig({entities: ["calendar.work"]}));

            await expect(
                (card as unknown as TodayCard).updateEvents(),
            ).resolves.toBeUndefined();
        } finally {
            restore();
        }
    });
});

describe("redrawing only when it would look different", (): void => {
    test("ignores a connection that only differs in an unrelated entity", async (): Promise<void> => {
        const card = await mountCard(
            {},
            {"calendar.work": []},
            {"light.kitchen": entityState("Kitchen")},
        );
        const render = spyOn(card as unknown as TodayCard, "render");

        try {
            (card as unknown as TodayCard).hass = fakeHass({
                callApi: calendarApi({"calendar.work": []}),
                states: {"light.kitchen": entityState("Kitchen ceiling")},
            });
            await settle(card);

            expect(render).not.toHaveBeenCalled();
        } finally {
            render.mockRestore();
        }
    });

    test("redraws when Home Assistant switches language", async (): Promise<void> => {
        const card = await mountCard();

        (card as unknown as TodayCard).hass = fakeHass({
            language: "de",
            callApi: calendarApi({"calendar.work": []}),
        });
        await settle(card);

        expect(shadowOne(card, ".is-fallback .title strong")?.textContent).toBe(
            "Keine Termine geplant",
        );
    });

    test("redraws when the configuration and the connection change together", async (): Promise<void> => {
        // A calendar that is still answering holds off the fetch this
        // configuration would otherwise start, so the batch it shares with the
        // connection is the only chance the new title gets.
        const stuck = new Promise<void>((): void => {});
        let calls = 0;
        const callApi = async (): Promise<unknown> => {
            calls += 1;
            if (calls > 1) {
                await stuck;
            }

            return [];
        };

        const card = await mount<Configurable>("today-card", {
            hass: fakeHass({callApi}),
        });
        card.setConfig(
            cardConfig({entities: ["calendar.work"], title: "Today"}),
        );
        await settle(card);

        void (card as unknown as TodayCard).updateEvents();
        card.setConfig(
            cardConfig({entities: ["calendar.work"], title: "Tomorrow"}),
        );
        (card as unknown as TodayCard).hass = fakeHass({callApi});
        await settle(card);

        expect(shadowOne(card, "ha-card")?.getAttribute("header")).toBe(
            "Tomorrow",
        );
    });

    test("redraws when the connection arrives an update after the configuration", async (): Promise<void> => {
        const card = document.createElement("today-card") as Configurable;
        document.body.appendChild(card);

        card.setConfig(cardConfig({entities: ["calendar.work"]}));
        await settle(card);

        (card as unknown as TodayCard).hass = fakeHass({
            callApi: calendarApi({
                "calendar.work": [
                    timed(
                        "Standup",
                        "2026-09-18T09:00:00Z",
                        "2026-09-18T09:15:00Z",
                    ),
                ],
            }),
        });
        await settle(card);

        expect(
            shadowAll(card, ".event .title strong").map(
                (element) => element.textContent,
            ),
        ).toEqual(["Standup"]);
    });

    test("ignores an unrelated entity while an error row is on screen", async (): Promise<void> => {
        const restore = silenceConsole();
        const card = await mountCard(
            {},
            {"calendar.work": new Error("gateway timeout")},
            {"calendar.work": entityState("Work Calendar")},
        );
        const render = spyOn(card as unknown as TodayCard, "render");

        try {
            (card as unknown as TodayCard).hass = fakeHass({
                callApi: calendarApi({
                    "calendar.work": new Error("gateway timeout"),
                }),
                states: {
                    "calendar.work": entityState("Work Calendar"),
                    "light.kitchen": entityState("Kitchen"),
                },
            });
            await settle(card);

            expect(render).not.toHaveBeenCalled();
        } finally {
            render.mockRestore();
            restore();
        }
    });

    test("redraws when one of several unreachable calendars is renamed", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const card = await mountCard(
                {},
                {
                    "calendar.work": new Error("gateway timeout"),
                    "calendar.home": new Error("gateway timeout"),
                },
                {
                    "calendar.work": entityState("Work Calendar"),
                    "calendar.home": entityState("Home Calendar"),
                },
            );

            (card as unknown as TodayCard).hass = fakeHass({
                callApi: calendarApi({
                    "calendar.work": new Error("gateway timeout"),
                    "calendar.home": new Error("gateway timeout"),
                }),
                states: {
                    "calendar.work": entityState("Work Calendar"),
                    "calendar.home": entityState("Family Calendar"),
                },
            });
            await settle(card);

            expect(shadowOne(card, ".is-error .schedule")?.textContent).toBe(
                "Work Calendar, Family Calendar",
            );
        } finally {
            restore();
        }
    });

    test("redraws when a calendar it could not reach is renamed", async (): Promise<void> => {
        const restore = silenceConsole();

        try {
            const card = await mountCard(
                {},
                {"calendar.work": new Error("gateway timeout")},
                {"calendar.work": entityState("Work Calendar")},
            );

            (card as unknown as TodayCard).hass = fakeHass({
                callApi: calendarApi({
                    "calendar.work": new Error("gateway timeout"),
                }),
                states: {"calendar.work": entityState("Team Calendar")},
            });
            await settle(card);

            expect(shadowOne(card, ".is-error .schedule")?.textContent).toBe(
                "Team Calendar",
            );
        } finally {
            restore();
        }
    });
});
