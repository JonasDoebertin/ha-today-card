import * as dayjs from "dayjs";
import {HA_API_DATE_FORMAT} from "../const";
import CalendarEvent from "../structs/event";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";

export async function getEvents(
    config: CardConfig,
    entities: EntitiesRowConfig[],
    hass: HomeAssistant
): Promise<CalendarEvent[]> {
    const start = dayjs().startOf('day').add(config.advance ?? 0, 'day');
    const end = dayjs().endOf('day').add(config.advance ?? 0, 'day');

    const events = await fetchEvents(entities, start, end, config, hass);

    return sortEvents(filterEvents(events, config));
}

async function fetchEvents(
    entities: EntitiesRowConfig[],
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    config: CardConfig,
    hass: HomeAssistant
): Promise<CalendarEvent[]> {
    const startTime = start.format(HA_API_DATE_FORMAT);
    const endTime = end.format(HA_API_DATE_FORMAT);

    const collectedEvents: CalendarEvent[] = [];
    const promises: Promise<void>[] = [];

    entities.forEach((entity: EntitiesRowConfig) => {
        const url = `calendars/${entity.entity}?start=${startTime}&end=${endTime}`;

        promises.push(
            hass
                .callApi('GET', url)
                .then((events: any): CalendarEvent[] => {
                    return transformEvents(events, entity, config)
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
    config: CardConfig
): CalendarEvent[] {
    return events.map(
        (event) => new CalendarEvent(event, entity, config)
    );
}

function filterEvents(
    events: CalendarEvent[],
    config: CardConfig
): CalendarEvent[] {
    return events
        .filter((event: CalendarEvent): boolean => {
            if (event.isAllDay && event.end.isBefore(dayjs().startOf('day').add(config.advance ?? 0, 'day'))) {
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
}

function getCompareStart(event: CalendarEvent): number
{
    if (event.isMultiDay && !event.isFirstDay) {
        return dayjs().startOf('day').unix();
    } else {
        return event.start.unix();
    }
}

function getCompareEnd(event: CalendarEvent): number
{
    if (event.isMultiDay && !event.isLastDay) {
        return dayjs().unix();
    } else {
        return event.end.unix();
    }
}

function compareAllDayEvents(a: CalendarEvent, b: CalendarEvent): number
{
    let result = b.numberOfDays - a.numberOfDays;

    if (result === 0) {
        result = b.currentDay - a.currentDay;
    }

    if (result === 0) {
        result = a.title.localeCompare(b.title);
    }

    return result;
}

function compareRegularEvents(a: CalendarEvent, b: CalendarEvent): number
{
    const startA = getCompareStart(a);
    const startB = getCompareStart(b);
    const endA = getCompareEnd(a);
    const endB = getCompareEnd(b);

    if (startA === startB) {
        return endA - endB;
    }

    return startA - startB;
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[]
{
    const allDayEvents = events
        .filter((event) => event.isAllDay)
        .sort(compareAllDayEvents);

    const regularEvents = events
        .filter((event) => !event.isAllDay)
        .sort(compareRegularEvents);

    return [...allDayEvents, ...regularEvents];
}
