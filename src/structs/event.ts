import * as dayjs from "dayjs";
import * as isToday from "dayjs/plugin/isToday";
import {TIME_FORMAT} from "../const";

dayjs.extend(isToday);

export default class CalendarEvent
{
    private _rawEvent: any;
    private _config: any;
    private _cachedStart: dayjs.Dayjs;
    private _cachedEnd: dayjs.Dayjs;
    private _cachedNumberOfDays: number;
    private _cachedCurrentDay: number;

    constructor(rawEvent: any, config: any)
    {
        this._rawEvent = rawEvent;
        this._config = config;
    }

    get id(): string
    {
        return this._rawEvent.id || this._rawEvent.uid;
    }

    get color(): string
    {
        return this._rawEvent.entity.color;
    }

    get title(): string
    {
        return this._rawEvent.summary || "";
    }

    get description(): string
    {
        return this._rawEvent.description || "";
    }

    get location(): string
    {
        return this._rawEvent.location || "";
    }

    get start(): dayjs.Dayjs
    {
        if (this._cachedStart === undefined) {
            if (this._rawEvent.start.date) {
                this._cachedStart = dayjs(this._rawEvent.start.date).startOf('day');
            } else {
                this._cachedStart = dayjs(this._rawEvent.start.dateTime);
            }
        }

        return this._cachedStart.clone();
    }

    get end(): dayjs.Dayjs
    {
        if (this._cachedEnd === undefined) {
            if (this._rawEvent.start.date) {
                this._cachedEnd = dayjs(this._rawEvent.end.date).subtract(1, 'day').endOf('day');
            } else {
                this._cachedEnd = dayjs(this._rawEvent.end.dateTime);
            }
        }

        return this._cachedEnd.clone();
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
        if (this._rawEvent.start.dateTime && this._rawEvent.end.dateTime) {
            return false;
        }

        if (this._rawEvent.start.date && this._rawEvent.end.date) {
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
        let now = dayjs().add(this._config.advance, 'days');

        return this.isMultiDay && this.start.isSame(now, 'day');
    }

    get isLastDay(): boolean
    {
        let now = dayjs().add(this._config.advance, 'days');

        return this.isMultiDay && this.end.isSame(now, 'day');
    }

    get numberOfDays(): number
    {
        if (this._cachedNumberOfDays === undefined) {
            let startDate = this.start.clone().startOf('day');
            let endDate = this.end.clone().endOf('day').add(1, 'second');

            this._cachedNumberOfDays = Math.abs(startDate.diff(endDate, 'day'));
        }

        return this._cachedNumberOfDays;
    }

    get currentDay(): number
    {
        if (this._cachedCurrentDay === undefined) {
            let startDate = this.start.clone().startOf('day');
            let now = dayjs().add(this._config.advance, 'days');
            let endDate = now.endOf('day').add(1, 'second');

            this._cachedCurrentDay = Math.abs(startDate.diff(endDate, 'day'));
        }

        return this._cachedCurrentDay;
    }
}
