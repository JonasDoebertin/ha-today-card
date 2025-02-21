import dayjs from "dayjs";
import {HA_API_DATE_FORMAT} from "../const";
import CalendarEvent from "../structs/event";

export async function getEvents(config, hass)
{
    const start = dayjs().startOf('day').add(config.advance, 'day');
    const end = dayjs().endOf('day').add(config.advance, 'day');

    const events = await fetchEvents(config.entities, start, end, hass);

    return sortEvents(
        filterEvents(
            transformEvents(events, config),
            config,
        ),
    );
}

async function fetchEvents(entities, start, end, hass)
{
    const startTime = start.format(HA_API_DATE_FORMAT);
    const endTime = end.format(HA_API_DATE_FORMAT);

    const collectedEvents = [];
    const promises = [];

    entities.forEach(entity => {
        const url = `calendars/${entity.entity}?start=${startTime}&end=${endTime}`;

        promises.push(
            hass
                .callApi('GET', url)
                .then(events => {
                    events.map(event => {
                        event.entity = entity;
                    });
                    return events;
                })
                .then(events => {
                    collectedEvents.push(...events);
                })
                .catch((error) => {
                    console.error(error);
                }),
        );
    });

    await Promise.all(promises);

    return collectedEvents;
}

function transformEvents(events, config)
{
    return events.map((event) => new CalendarEvent(event, config));
}

function filterEvents(events, config)
{
    return events
        .filter((event) => {
            if (event.isAllDay && event.end.isBefore(dayjs().startOf('day').add(config.advance, 'day'))) {
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

function getCompareStart(event)
{
    if (event.isMultiDay && !event.isFirstDay) {
        return dayjs().startOf('day').unix();
    } else {
        return event.start.unix();
    }
}

function getCompareEnd(event)
{
    if (event.isMultiDay && !event.isLastDay) {
        return dayjs().unix();
    } else {
        return event.end.unix();
    }
}

function compareAllDayEvents(a, b)
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

function compareRegularEvents(a, b)
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

function sortEvents(events)
{
    const allDayEvents = events
        .filter((event) => event.isAllDay)
        .sort(compareAllDayEvents);

    const regularEvents = events
        .filter((event) => !event.isAllDay)
        .sort(compareRegularEvents);

    return [...allDayEvents, ...regularEvents];
}
