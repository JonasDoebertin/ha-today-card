import {HomeAssistant} from "custom-card-helpers";
import {CardConfig, EntitiesRowConfig} from "../../src/structs/config";

export function rawTimedEvent(
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    return {
        id: "timed-1",
        summary: "Standup",
        description: "",
        location: "",
        start: {dateTime: "2026-09-18T09:00:00Z"},
        end: {dateTime: "2026-09-18T09:30:00Z"},
        ...overrides,
    };
}

export function rawAllDayEvent(
    overrides: Record<string, unknown> = {},
): Record<string, unknown> {
    // Home Assistant reports the end of an all-day event exclusively, so a
    // single day on the 18th ends on the 19th.
    return {
        id: "all-day-1",
        summary: "Holiday",
        description: "",
        location: "",
        start: {date: "2026-09-18"},
        end: {date: "2026-09-19"},
        ...overrides,
    };
}

export function entityRow(entity: string, color?: string): EntitiesRowConfig {
    return color === undefined ? {entity} : {entity, color};
}

export function cardConfig(overrides: Partial<CardConfig> = {}): CardConfig {
    return {
        type: "custom:today-card",
        time_format: "HH:mm",
        show_all_day_events: true,
        show_past_events: true,
        entities: ["calendar.work"],
        ...overrides,
    } as CardConfig;
}

/**
 * A `callApi` that answers each `calendars/<entity>` request from a map, and
 * rejects for any entity whose value is an Error.
 */
export function calendarApi(
    responses: Record<string, Record<string, unknown>[] | Error>,
): (method: string, path: string) => Promise<unknown> {
    return async (_method: string, path: string): Promise<unknown> => {
        const entity = (path.split("?")[0] ?? "").replace("calendars/", "");
        const response = responses[entity];

        if (response === undefined) {
            throw new Error(`no stub response for ${entity}`);
        }

        if (response instanceof Error) {
            throw response;
        }

        return response;
    };
}

export function fakeHass(
    overrides: Record<string, unknown> = {},
): HomeAssistant {
    return {
        language: "en",
        states: {},
        callApi: async (): Promise<unknown> => [],
        ...overrides,
    } as unknown as HomeAssistant;
}

/** An entity state shaped the way the card reads it. */
export function entityState(friendlyName: string): Record<string, unknown> {
    return {attributes: {friendly_name: friendlyName}};
}
