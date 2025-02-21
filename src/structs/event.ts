import * as dayjs from "dayjs";
import * as isToday from "dayjs/plugin/isToday";
import {TIME_FORMAT} from "../const";
import {EntitiesRowConfig} from "./config";

dayjs.extend(isToday);

export default class CalendarEvent
{
    private rawEvent: any;
    private entity: EntitiesRowConfig;
    private config: any;
    private cachedStart: dayjs.Dayjs | undefined;
    private cachedEnd: dayjs.Dayjs | undefined;
    private cachedNumberOfDays: number | undefined;
    private cachedCurrentDay: number | undefined;

    constructor(rawEvent: any, entity: EntitiesRowConfig, config: any)
    {
        this.rawEvent = rawEvent;
        this.entity = entity;
        this.config = config;
    }

    get id(): string
    {
        return this.rawEvent.id || this.rawEvent.uid;
    }

    get color(): string
    {
        return this.entity.color ?? "currentColor";
    }

    get title(): string
    {
        return this.rawEvent.summary || "";
    }

    get description(): string
    {
        return this.rawEvent.description || "";
    }

    get location(): string
    {
        return this.rawEvent.location || "";
    }

    get start(): dayjs.Dayjs
    {
        if (this.cachedStart === undefined) {
            if (this.rawEvent.start.date) {
                this.cachedStart = dayjs(this.rawEvent.start.date).startOf('day');
            } else {
                this.cachedStart = dayjs(this.rawEvent.start.dateTime);
            }
        }

        return this.cachedStart.clone();
    }

    get end(): dayjs.Dayjs
    {
        if (this.cachedEnd === undefined) {
            if (this.rawEvent.start.date) {
                this.cachedEnd = dayjs(this.rawEvent.end.date).subtract(1, 'day').endOf('day');
            } else {
                this.cachedEnd = dayjs(this.rawEvent.end.dateTime);
            }
        }

        return this.cachedEnd.clone();
    }

    get schedule(): string
    {
        if (this.isMultiDay && this.isFirstDay) {
            return "Ab" + " " + this.start.format(TIME_FORMAT);
        }

        if (this.isMultiDay && this.isLastDay) {
            return "Bis " + this.end.format(TIME_FORMAT);
        }

        if (this.isAllDay) {
            if (this.numberOfDays > 1) {
                return `Ganztägig (${this.currentDay}/${this.numberOfDays})`;
            } else {
                return "Ganztägig";
            }
        }

        return this.start.format(TIME_FORMAT) + " – " + this.end.format(TIME_FORMAT);
    }

    get isInPast(): boolean
    {
        let currentMinute = dayjs().startOf('minute');
        let endMinute = this.end.clone().startOf('minute');

        return endMinute.isBefore(currentMinute);
    }

    get isAllDay(): boolean
    {
        if (this.rawEvent.start.dateTime && this.rawEvent.end.dateTime) {
            return false;
        }

        if (this.rawEvent.start.date && this.rawEvent.end.date) {
            return true;
        }

        if (this.isMultiDay && !this.isFirstDay && !this.isLastDay) {
            return true;
        }

        return false;
    }

    get isMultiDay(): boolean
    {
        if (!this.start.isSame(this.end, 'day')) {
            return true;
        }

        return false;
    }

    get isFirstDay(): boolean
    {
        let now = dayjs().add(this.config.advance, 'days');

        return this.isMultiDay && this.start.isSame(now, 'day');
    }

    get isLastDay(): boolean
    {
        let now = dayjs().add(this.config.advance, 'days');

        return this.isMultiDay && this.end.isSame(now, 'day');
    }

    get numberOfDays(): number
    {
        if (this.cachedNumberOfDays === undefined) {
            let startDate = this.start.clone().startOf('day');
            let endDate = this.end.clone().endOf('day').add(1, 'second');

            this.cachedNumberOfDays = Math.abs(startDate.diff(endDate, 'day'));
        }

        return this.cachedNumberOfDays;
    }

    get currentDay(): number
    {
        if (this.cachedCurrentDay === undefined) {
            let startDate = this.start.clone().startOf('day');
            let now = dayjs().add(this.config.advance, 'days');
            let endDate = now.endOf('day').add(1, 'second');

            this.cachedCurrentDay = Math.abs(startDate.diff(endDate, 'day'));
        }

        return this.cachedCurrentDay;
    }
}
