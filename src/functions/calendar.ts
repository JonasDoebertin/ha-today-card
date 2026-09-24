import dayjs from "dayjs";
import CalendarEvent from "../structs/event";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import {REQUEST_TIMEOUT} from "../const";

export interface CalendarResult {
    events: CalendarEvent[];
    /** Entity ids whose fetch failed. */
    failed: string[];
}

export async function getEvents(
    config: CardConfig,
    entities: EntitiesRowConfig[],
    hass: HomeAssistant,
): Promise<CalendarResult> {
    const start = dayjs()
        .startOf("day")
        .add(config.advance ?? 0, "day");
    const end = dayjs()
        .endOf("day")
        .add(config.advance ?? 0, "day");

    const {events, failed} = await fetchEvents(
        entities,
        start,
        end,
        config,
        hass,
    );

    return {
        events: limitEvents(sortEvents(filterEvents(events, config)), config),
        failed,
    };
}

async function fetchEvents(
    entities: EntitiesRowConfig[],
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    config: CardConfig,
    hass: HomeAssistant,
): Promise<CalendarResult> {
    const collectedEvents: CalendarEvent[] = [];
    const failed: string[] = [];
    const promises: Promise<void>[] = [];

    entities.forEach((entity: EntitiesRowConfig) => {
        const url = `calendars/${entity.entity}?start=${start.toISOString()}&end=${end.toISOString()}`;

        promises.push(
            withTimeout(hass.callApi("GET", url), url)
                .then((events: any): CalendarEvent[] => {
                    return transformEvents(events, entity, config);
                })
                .then((events: CalendarEvent[]): void => {
                    collectedEvents.push(...events);
                })
                .catch((error): void => {
                    // Record the failure so the card can tell it apart from a
                    // calendar with nothing on today.
                    console.error(error);
                    failed.push(entity.entity);
                }),
        );
    });

    await Promise.all(promises);

    return {events: collectedEvents, failed};
}

function withTimeout<T>(request: Promise<T>, url: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<never>((_resolve, reject): void => {
        timer = setTimeout((): void => {
            reject(new Error(`${url} did not answer in time`));
        }, REQUEST_TIMEOUT);
    });

    return Promise.race([request, timeout]).finally((): void => {
        clearTimeout(timer);
    });
}

function hasDateOrTime(edge: any): boolean {
    return typeof edge?.date === "string" || typeof edge?.dateTime === "string";
}

function transformEvents(
    events: Record<string, unknown>[],
    entity: EntitiesRowConfig,
    config: CardConfig,
): CalendarEvent[] {
    return events.map((event) => {
        if (!hasDateOrTime(event.start) || !hasDateOrTime(event.end)) {
            throw new Error(
                `${entity.entity} returned an event without a start or end`,
            );
        }

        return new CalendarEvent(event, entity, config);
    });
}

function matchesExcludePattern(text: string, pattern: string): boolean {
    const regexMatch = pattern.match(/^\/(.+)\/([gimsuy]*)$/);

    if (regexMatch) {
        const [, source = "", flags = ""] = regexMatch;

        try {
            return new RegExp(source, flags).test(text);
        } catch {
            // The pattern looks like a regex but does not compile. Match its
            // body as plain text instead of the whole pattern, which would
            // include the delimiting slashes and never match a real title.
            return text.toLowerCase().includes(source.toLowerCase());
        }
    }

    return text.toLowerCase().includes(pattern.toLowerCase());
}

function isExcluded(event: CalendarEvent, patterns: string[]): boolean {
    return patterns.some((pattern: string): boolean => {
        // An empty pattern is a substring of every title and would hide the
        // whole calendar. The editor strips blank lines, YAML does not.
        if (pattern.trim() === "") {
            return false;
        }

        return (
            matchesExcludePattern(event.title, pattern)
            || matchesExcludePattern(event.description, pattern)
        );
    });
}

function filterEvents(
    events: CalendarEvent[],
    config: CardConfig,
): CalendarEvent[] {
    return events.filter((event: CalendarEvent): boolean => {
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

        if (config.exclude?.length && isExcluded(event, config.exclude)) {
            return false;
        }

        return true;
    });
}

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

function limitEvents(
    events: CalendarEvent[],
    config: CardConfig,
): CalendarEvent[] {
    return config.limit === 0 || config.limit == null || config.limit < 0
        ? events
        : events.slice(0, config.limit);
}
