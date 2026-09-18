import {afterEach, describe, expect, setSystemTime, test} from "bun:test";
import CalendarEvent from "../../src/structs/event";
import {CardConfig} from "../../src/structs/config";
import {cardConfig, entityRow} from "../support/factories";

/**
 * Run a body with the process in another timezone. Day.js reads the ambient
 * zone through Date, so this is what a user in that zone would see.
 */
function inTimezone<T>(timezone: string, run: () => T): T {
    const previous = process.env.TZ;

    process.env.TZ = timezone;
    try {
        return run();
    } finally {
        process.env.TZ = previous;
    }
}

function event(
    raw: Record<string, unknown>,
    config: Partial<CardConfig> = {},
): CalendarEvent {
    return new CalendarEvent(
        raw,
        entityRow("calendar.work", "red"),
        cardConfig(config),
    );
}

function allDay(startDate: string, endDate: string): Record<string, unknown> {
    return {
        id: "all-day",
        summary: "Holiday",
        start: {date: startDate},
        end: {date: endDate},
    };
}

// Two ahead of UTC, one behind, and one far enough ahead that a UTC-based
// parse would land on the wrong calendar day.
const ZONES = [
    "UTC",
    "Europe/Berlin",
    "Pacific/Auckland",
    "America/Los_Angeles",
];

afterEach((): void => {
    setSystemTime();
});

describe("all-day events across timezones", (): void => {
    for (const zone of ZONES) {
        test(`starts and ends on the marked day in ${zone}`, (): void => {
            inTimezone(zone, (): void => {
                setSystemTime(new Date("2026-09-18T12:00:00Z"));
                const holiday = event(allDay("2026-09-18", "2026-09-19"));

                // A date-only value is a calendar day, not an instant. Read as
                // UTC midnight it would slide to the 17th for anyone west of
                // Greenwich and stay on the 18th elsewhere.
                expect(holiday.start.format("YYYY-MM-DD")).toBe("2026-09-18");
                expect(holiday.end.format("YYYY-MM-DD")).toBe("2026-09-18");
                expect(holiday.isAllDay).toBe(true);
                expect(holiday.isMultiDay).toBe(false);
            });
        });
    }

    for (const zone of ZONES) {
        test(`counts a three-day span as three days in ${zone}`, (): void => {
            inTimezone(zone, (): void => {
                setSystemTime(new Date("2026-09-18T12:00:00Z"));
                const holiday = event(allDay("2026-09-17", "2026-09-20"));

                expect(holiday.numberOfDays).toBe(3);
                expect(holiday.isMultiDay).toBe(true);
            });
        });
    }
});

describe("timed events across timezones", (): void => {
    test("renders the viewer's local time, not UTC", (): void => {
        const raw = {
            id: "timed",
            summary: "Call",
            start: {dateTime: "2026-09-18T09:00:00Z"},
            end: {dateTime: "2026-09-18T09:30:00Z"},
        };

        inTimezone("UTC", (): void => {
            setSystemTime(new Date("2026-09-18T08:00:00Z"));
            expect(event(raw).timeSchedule).toBe("09:00 – 09:30");
        });

        inTimezone("Europe/Berlin", (): void => {
            setSystemTime(new Date("2026-09-18T08:00:00Z"));
            expect(event(raw).timeSchedule).toBe("11:00 – 11:30");
        });

        inTimezone("America/Los_Angeles", (): void => {
            setSystemTime(new Date("2026-09-18T08:00:00Z"));
            expect(event(raw).timeSchedule).toBe("02:00 – 02:30");
        });
    });

    test("an event late in the UTC day belongs to the next local day in Auckland", (): void => {
        inTimezone("Pacific/Auckland", (): void => {
            setSystemTime(new Date("2026-09-18T12:00:00Z"));
            const raw = {
                id: "timed",
                summary: "Late call",
                start: {dateTime: "2026-09-18T20:00:00Z"},
                end: {dateTime: "2026-09-18T21:00:00Z"},
            };

            // 20:00 UTC is 08:00 on the 19th in Auckland.
            expect(event(raw).start.format("YYYY-MM-DD HH:mm")).toBe(
                "2026-09-19 08:00",
            );
        });
    });
});

describe("spans crossing a daylight saving change", (): void => {
    // A calendar day is not reliably 24 hours long. Day.js compensates for the
    // offset change when diffing in days, so counting a span by elapsed time
    // still lands on the right number of calendar days. These pin that down,
    // because the arithmetic in numberOfDays would be off by one without it.

    test("counts an autumn span, where one day lasts 25 hours", (): void => {
        inTimezone("Europe/Berlin", (): void => {
            setSystemTime(new Date("2026-10-25T12:00:00Z"));

            // 24, 25 and 26 October 2026; the clocks go back on the 25th.
            const holiday = event(allDay("2026-10-24", "2026-10-27"));

            expect(holiday.numberOfDays).toBe(3);
            expect(holiday.daySchedule).toBe("(2/3)");
        });
    });

    test("counts a spring span, where one day lasts 23 hours", (): void => {
        inTimezone("Europe/Berlin", (): void => {
            setSystemTime(new Date("2026-03-29T12:00:00Z"));

            // 28, 29 and 30 March 2026; the clocks go forward on the 29th.
            const holiday = event(allDay("2026-03-28", "2026-03-31"));

            expect(holiday.numberOfDays).toBe(3);
            expect(holiday.daySchedule).toBe("(2/3)");
        });
    });

    test("agrees with a zone that has no such change", (): void => {
        inTimezone("UTC", (): void => {
            setSystemTime(new Date("2026-03-29T12:00:00Z"));
            const holiday = event(allDay("2026-03-28", "2026-03-31"));

            expect(holiday.numberOfDays).toBe(3);
            expect(holiday.daySchedule).toBe("(2/3)");
        });
    });
});
