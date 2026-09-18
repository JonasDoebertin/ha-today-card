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
});

describe("keeping itself up to date", (): void => {
    test("starts refreshing when it is added and stops when it is removed", async (): Promise<void> => {
        const setInterval = spyOn(window, "setInterval");
        const clearInterval = spyOn(window, "clearInterval");

        try {
            const card = await mount("today-card", {hass: fakeHass()});
            expect(setInterval).toHaveBeenCalledTimes(1);

            card.remove();
            expect(clearInterval).toHaveBeenCalledTimes(1);
        } finally {
            setInterval.mockRestore();
            clearInterval.mockRestore();
        }
    });

    test("does not stack intervals when it is moved around the dashboard", async (): Promise<void> => {
        const setInterval = spyOn(window, "setInterval");

        try {
            const card = await mount("today-card", {hass: fakeHass()});
            card.remove();
            document.body.appendChild(card);
            await settle(card);

            expect(setInterval).toHaveBeenCalledTimes(2);
        } finally {
            setInterval.mockRestore();
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
