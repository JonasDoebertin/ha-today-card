import * as dayjs from "dayjs";
import {HA_API_DATE_FORMAT} from "../const";
import CalendarEvent from "../structs/event";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";

export async function getEvents(
    config: CardConfig,
    entities: EntitiesRowConfig[],
    hass: HomeAssistant,
): Promise<CalendarEvent[]> {
    const start = dayjs()
        .startOf("day")
        .add(config.advance ?? 0, "day");
    const end = dayjs()
        .endOf("day")
        .add(config.advance ?? 0, "day");

    const events = await fetchEvents(entities, start, end, config, hass);

    return sortEvents(filterEvents(events, config));
}

async function fetchEvents(
    entities: EntitiesRowConfig[],
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    config: CardConfig,
    hass: HomeAssistant,
): Promise<CalendarEvent[]> {
    const startTime = start.format(HA_API_DATE_FORMAT);
    const endTime = end.format(HA_API_DATE_FORMAT);

    const collectedEvents: CalendarEvent[] = [];
    const promises: Promise<void>[] = [];

    entities.forEach((entity: EntitiesRowConfig) => {
        const url = `calendars/${entity.entity}?start=${startTime}&end=${endTime}`;

        promises.push(
            hass
                .callApi("GET", url)
                .then((events: any): CalendarEvent[] => {
                    return transformEvents(events, entity, config);
                })
                .then((events: CalendarEvent[]): void => {
                    collectedEvents.push(...events);
                })
                .catch((error): void => {
                    console.error(error);
                }),
        );
    });

    await Promise.all(promises);

    return collectedEvents;
}

function transformEvents(
    events: Record<string, unknown>[],
    entity: EntitiesRowConfig,
    config: CardConfig,
): CalendarEvent[] {
    return events.map((event) => new CalendarEvent(event, entity, config));
}

/**
 * Filter calendar events based on display configuration and apply the configured event limit.
 *
 * Filters out events that:
 * - are all-day and end before the start of the day plus `config.advance` days,
 * - are all-day when `config.show_all_day_events` is false,
 * - are in the past when `config.show_past_events` is false.
 *
 * @param events - The list of calendar events to filter.
 * @param config - Card configuration; uses `advance`, `show_all_day_events`, `show_past_events`, and `event_limit`.
 * @returns The filtered events limited to the first `config.event_limit` entries. If `config.event_limit` is 0, the original `events` array is returned unchanged.
 */
function filterEvents(
    events: CalendarEvent[],
    config: CardConfig,
): CalendarEvent[] {
    const filteredEvents = events.filter((event: CalendarEvent): boolean => {
        if (
            event.isAllDay
            && event.end.isBefore(
                dayjs()
                    .startOf("day")
                    .add(config.advance ?? 0, "day"),
            )
        ) {
            return false;
        }

        if (!config.show_all_day_events && event.isAllDay) {
            return false;
        }

        if (!config.show_past_events && event.isInPast) {
            return false;
        }

        return true;
    });

    return (config.event_limit === 0) ? events : events.slice(0, config.event_limit);
}

/**
 * Compute the Unix timestamp to use when comparing an event's start time.
 *
 * @param event - The CalendarEvent to evaluate; for multi-day events that are not on their first day, use the start of today as the comparison point.
 * @returns The Unix timestamp (seconds since epoch) to use as the event's comparison start: the start of today for applicable multi-day events, otherwise the event's actual start time.
 */
function getCompareStart(event: CalendarEvent): number {
    if (event.isMultiDay && !event.isFirstDay) {
        return dayjs().startOf("day").unix();
    } else {
        return event.start.unix();
    }
}

function getCompareEnd(event: CalendarEvent): number {
    if (event.isMultiDay && !event.isLastDay) {
        return dayjs().unix();
    } else {
        return event.end.unix();
    }
}

function compareAllDayEvents(a: CalendarEvent, b: CalendarEvent): number {
    let result = b.numberOfDays - a.numberOfDays;

    if (result === 0) {
        result = b.currentDay - a.currentDay;
    }

    if (result === 0) {
        result = a.title.localeCompare(b.title);
    }

    return result;
}

function compareRegularEvents(a: CalendarEvent, b: CalendarEvent): number {
    const startA = getCompareStart(a);
    const startB = getCompareStart(b);
    const endA = getCompareEnd(a);
    const endB = getCompareEnd(b);

    if (startA === startB) {
        return endA - endB;
    }

    return startA - startB;
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
    const allDayEvents = events
        .filter((event) => event.isAllDay)
        .sort(compareAllDayEvents);

    const regularEvents = events
        .filter((event) => !event.isAllDay)
        .sort(compareRegularEvents);

    return [...allDayEvents, ...regularEvents];
}
