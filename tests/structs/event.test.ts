import {afterEach, describe, expect, setSystemTime, test} from "bun:test";
import CalendarEvent from "../../src/structs/event";
import {CardConfig, EntitiesRowConfig} from "../../src/structs/config";
import localize from "../../src/localization/localize";
import {cardConfig, entityRow} from "../support/factories";

export function makeEvent(
    raw: Record<string, unknown>,
    config: Partial<CardConfig> = {},
    entity: EntitiesRowConfig = entityRow("calendar.work", "red"),
): CalendarEvent {
    return new CalendarEvent(raw, entity, cardConfig(config));
}

/** A timed event given as instants. */
function timed(
    start: string,
    end: string,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: "timed",
        summary: "Meeting",
        start: {dateTime: start},
        end: {dateTime: end},
        ...overrides,
    };
}

/** An all-day event given the way Home Assistant reports one: end exclusive. */
function allDay(
    startDate: string,
    endDate: string,
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: "all-day",
        summary: "Holiday",
        start: {date: startDate},
        end: {date: endDate},
        ...overrides,
    };
}

function at(instant: string): void {
    setSystemTime(new Date(instant));
}

afterEach((): void => {
    setSystemTime();
});

describe("plain accessors", (): void => {
    test("reads the id, preferring id over uid", (): void => {
        expect(
            makeEvent(timed("2026-09-18T09:00:00Z", "2026-09-18T10:00:00Z")).id,
        ) //
            .toBe("timed");
        expect(
            makeEvent({
                uid: "from-uid",
                start: {dateTime: "2026-09-18T09:00:00Z"},
                end: {dateTime: "2026-09-18T10:00:00Z"},
            }).id,
        ).toBe("from-uid");
    });

    test("returns empty strings rather than undefined for missing text", (): void => {
        const event = makeEvent({
            id: "bare",
            start: {dateTime: "2026-09-18T09:00:00Z"},
            end: {dateTime: "2026-09-18T10:00:00Z"},
        });

        expect(event.title).toBe("");
        expect(event.description).toBe("");
        expect(event.location).toBe("");
    });

    test("reads the text Home Assistant supplies", (): void => {
        const event = makeEvent(
            timed("2026-09-18T09:00:00Z", "2026-09-18T10:00:00Z", {
                summary: "Dentist",
                description: "Bring the referral",
                location: "High Street 4",
            }),
        );

        expect(event.title).toBe("Dentist");
        expect(event.description).toBe("Bring the referral");
        expect(event.location).toBe("High Street 4");
    });

    test("takes its color from the entity, or inherits the text color", (): void => {
        const raw = timed("2026-09-18T09:00:00Z", "2026-09-18T10:00:00Z");

        expect(makeEvent(raw, {}, entityRow("calendar.work", "red")).color) //
            .toBe("red");
        expect(makeEvent(raw, {}, entityRow("calendar.work")).color) //
            .toBe("currentColor");
    });
});

describe("start and end", (): void => {
    test("reads a timed event's instants as given", (): void => {
        const event = makeEvent(
            timed("2026-09-18T09:15:00Z", "2026-09-18T10:45:00Z"),
        );

        expect(event.start.toISOString()).toBe("2026-09-18T09:15:00.000Z");
        expect(event.end.toISOString()).toBe("2026-09-18T10:45:00.000Z");
    });

    test("anchors an all-day event to the start of its day", (): void => {
        const event = makeEvent(allDay("2026-09-18", "2026-09-19"));

        expect(event.start.format("YYYY-MM-DD HH:mm:ss")).toBe(
            "2026-09-18 00:00:00",
        );
    });

    test("turns the exclusive all-day end into the last moment of the real last day", (): void => {
        // Home Assistant reports a single day on the 18th as ending on the
        // 19th. Showing it as running into the 19th would be wrong.
        const event = makeEvent(allDay("2026-09-18", "2026-09-19"));

        expect(event.end.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(
            "2026-09-18 23:59:59.999",
        );
    });

    test("handles a multi-day all-day span the same way", (): void => {
        const event = makeEvent(allDay("2026-09-17", "2026-09-20"));

        expect(event.start.format("YYYY-MM-DD")).toBe("2026-09-17");
        expect(event.end.format("YYYY-MM-DD HH:mm:ss.SSS")).toBe(
            "2026-09-19 23:59:59.999",
        );
    });

    test("hands out a fresh object each time, so a caller cannot corrupt the cache", (): void => {
        const event = makeEvent(
            timed("2026-09-18T09:00:00Z", "2026-09-18T10:00:00Z"),
        );

        expect(event.start).not.toBe(event.start);
        expect(event.start.toISOString()).toBe(event.start.toISOString());
    });
});

describe("isAllDay and isMultiDay", (): void => {
    test("a timed event inside one day is neither", (): void => {
        const event = makeEvent(
            timed("2026-09-18T09:00:00Z", "2026-09-18T10:00:00Z"),
        );

        expect(event.isAllDay).toBe(false);
        expect(event.isMultiDay).toBe(false);
    });

    test("a one-day all-day event is all day but not multi day", (): void => {
        const event = makeEvent(allDay("2026-09-18", "2026-09-19"));

        expect(event.isAllDay).toBe(true);
        expect(event.isMultiDay).toBe(false);
    });

    test("a three-day all-day event is both", (): void => {
        const event = makeEvent(allDay("2026-09-17", "2026-09-20"));

        expect(event.isAllDay).toBe(true);
        expect(event.isMultiDay).toBe(true);
    });

    test("a timed event crossing midnight is multi day but never all day", (): void => {
        at("2026-09-18T12:00:00Z");
        const event = makeEvent(
            timed("2026-09-17T22:00:00Z", "2026-09-19T02:00:00Z"),
        );

        expect(event.isMultiDay).toBe(true);
        expect(event.isAllDay).toBe(false);
    });

    test("a dated start with a timed end reads the end it was given", (): void => {
        at("2026-09-18T12:00:00Z");
        const event = makeEvent({
            id: "mixed",
            start: {date: "2026-09-17"},
            end: {dateTime: "2026-09-19T02:00:00Z"},
        });

        expect(event.end.format("YYYY-MM-DD HH:mm")).toBe("2026-09-19 02:00");
    });

    test("a dated start with a timed end still spans its days", (): void => {
        at("2026-09-18T12:00:00Z");
        const event = makeEvent({
            id: "mixed",
            start: {date: "2026-09-17"},
            end: {dateTime: "2026-09-19T02:00:00Z"},
        });

        expect(event.isMultiDay).toBe(true);
        expect(event.numberOfDays).toBe(3);
    });
});

describe("day position under a frozen clock", (): void => {
    const threeDays = allDay("2026-09-17", "2026-09-20");

    test("counts the days a span covers", (): void => {
        at("2026-09-18T12:00:00Z");

        expect(makeEvent(threeDays).numberOfDays).toBe(3);
        expect(makeEvent(allDay("2026-09-18", "2026-09-19")).numberOfDays) //
            .toBe(1);
    });

    test("counts which day of the span is on screen", (): void => {
        at("2026-09-17T12:00:00Z");
        expect(makeEvent(threeDays).currentDay).toBe(1);

        at("2026-09-18T12:00:00Z");
        expect(makeEvent(threeDays).currentDay).toBe(2);

        at("2026-09-19T12:00:00Z");
        expect(makeEvent(threeDays).currentDay).toBe(3);
    });

    test("knows the first and last day of a span", (): void => {
        at("2026-09-17T12:00:00Z");
        expect(makeEvent(threeDays).isFirstDay).toBe(true);
        expect(makeEvent(threeDays).isLastDay).toBe(false);

        at("2026-09-18T12:00:00Z");
        expect(makeEvent(threeDays).isFirstDay).toBe(false);
        expect(makeEvent(threeDays).isLastDay).toBe(false);

        at("2026-09-19T12:00:00Z");
        expect(makeEvent(threeDays).isFirstDay).toBe(false);
        expect(makeEvent(threeDays).isLastDay).toBe(true);
    });

    test("follows the advance offset, because it asks which day is shown", (): void => {
        at("2026-09-17T12:00:00Z");

        // Showing tomorrow: the card is on the second day of the span even
        // though the clock says it is the first.
        expect(makeEvent(threeDays, {advance: 1}).currentDay).toBe(2);
        expect(makeEvent(threeDays, {advance: 1}).isFirstDay).toBe(false);
        expect(makeEvent(threeDays, {advance: 2}).isLastDay).toBe(true);
    });

    test("never calls a single-day event a first or last day", (): void => {
        at("2026-09-18T12:00:00Z");
        const event = makeEvent(allDay("2026-09-18", "2026-09-19"));

        expect(event.isFirstDay).toBe(false);
        expect(event.isLastDay).toBe(false);
    });
});

describe("daySchedule", (): void => {
    test("numbers the day within a multi-day span", (): void => {
        at("2026-09-18T12:00:00Z");

        expect(makeEvent(allDay("2026-09-17", "2026-09-20")).daySchedule) //
            .toBe("(2/3)");
    });

    test("says nothing for a single-day event", (): void => {
        at("2026-09-18T12:00:00Z");

        expect(makeEvent(allDay("2026-09-18", "2026-09-19")).daySchedule) //
            .toBeNull();
    });
});

describe("timeSchedule", (): void => {
    test("renders a plain range for a timed event", (): void => {
        at("2026-09-18T08:00:00Z");

        expect(
            makeEvent(timed("2026-09-18T09:00:00Z", "2026-09-18T09:30:00Z"))
                .timeSchedule,
        ).toBe("09:00 – 09:30");
    });

    test("honours the configured time format", (): void => {
        at("2026-09-18T08:00:00Z");

        expect(
            makeEvent(timed("2026-09-18T09:00:00Z", "2026-09-18T13:30:00Z"), {
                time_format: "h:mm A",
            }).timeSchedule,
        ).toBe("9:00 AM – 1:30 PM");
    });

    test("says when a multi-day event starts, on its first day", (): void => {
        at("2026-09-18T08:00:00Z");

        expect(
            makeEvent(timed("2026-09-18T14:30:00Z", "2026-09-19T11:00:00Z"))
                .timeSchedule,
        ).toBe(`${localize("event.schedule.from")} 14:30`);
    });

    test("says when a multi-day event ends, on its last day", (): void => {
        at("2026-09-19T08:00:00Z");

        expect(
            makeEvent(timed("2026-09-18T14:30:00Z", "2026-09-19T11:00:00Z"))
                .timeSchedule,
        ).toBe(`${localize("event.schedule.until")} 11:00`);
    });

    test("says nothing on a day a multi-day event merely covers", (): void => {
        at("2026-09-18T08:00:00Z");

        expect(
            makeEvent(timed("2026-09-17T14:00:00Z", "2026-09-19T11:00:00Z"))
                .timeSchedule,
        ).toBeNull();
    });

    test("says nothing for an all-day event", (): void => {
        at("2026-09-18T08:00:00Z");

        expect(makeEvent(allDay("2026-09-18", "2026-09-19")).timeSchedule) //
            .toBeNull();
        expect(makeEvent(allDay("2026-09-17", "2026-09-20")).timeSchedule) //
            .toBeNull();
    });

    test("does not announce a start of exactly midnight", (): void => {
        // "From 00:00" tells the reader nothing they did not already know.
        at("2026-09-18T08:00:00Z");

        expect(
            makeEvent(timed("2026-09-18T00:00:00Z", "2026-09-19T11:00:00Z"))
                .timeSchedule,
        ).toBeNull();
    });
});

describe("state relative to the real moment", (): void => {
    const morning = timed("2026-09-18T09:00:00Z", "2026-09-18T09:30:00Z");

    test("an event that has ended is past", (): void => {
        at("2026-09-18T10:00:00Z");
        const event = makeEvent(morning);

        expect(event.isInPast).toBe(true);
        expect(event.isInFuture).toBe(false);
        expect(event.isCurrent).toBe(false);
    });

    test("an event that has not started is future", (): void => {
        at("2026-09-18T08:00:00Z");
        const event = makeEvent(morning);

        expect(event.isInFuture).toBe(true);
        expect(event.isInPast).toBe(false);
        expect(event.isCurrent).toBe(false);
    });

    test("an event under way is current and neither past nor future", (): void => {
        at("2026-09-18T09:15:00Z");
        const event = makeEvent(morning);

        expect(event.isCurrent).toBe(true);
        expect(event.isInPast).toBe(false);
        expect(event.isInFuture).toBe(false);
    });

    test("the boundaries count as current", (): void => {
        at("2026-09-18T09:00:00Z");
        expect(makeEvent(morning).isCurrent).toBe(true);
        expect(makeEvent(morning).isInFuture).toBe(false);

        at("2026-09-18T09:30:00Z");
        expect(makeEvent(morning).isCurrent).toBe(true);
        expect(makeEvent(morning).isInPast).toBe(false);
    });

    test("an event on a later day is not past, whatever the clock reads", (): void => {
        // The regression this guards: these getters used to add the advance
        // offset to now, which moved the date but kept the time of day, so
        // tomorrow's 09:00 meeting counted as past from 09:01 today and the
        // default show_past_events: false hid it.
        at("2026-09-18T09:01:00Z");
        const tomorrow = makeEvent(
            timed("2026-09-19T09:00:00Z", "2026-09-19T09:30:00Z"),
            {advance: 1},
        );

        expect(tomorrow.isInPast).toBe(false);
        expect(tomorrow.isInFuture).toBe(true);
    });

    test("an all-day event today is current all day", (): void => {
        at("2026-09-18T13:00:00Z");
        const event = makeEvent(allDay("2026-09-18", "2026-09-19"));

        expect(event.isCurrent).toBe(true);
        expect(event.isInPast).toBe(false);
        expect(event.isInFuture).toBe(false);
    });
});
