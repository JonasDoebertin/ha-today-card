import {CardConfig} from "./structs/config";

export const VERSION: string = "v0.0.0";

export const REFRESH_INTERVAL: number = 60 * 1_000;

export const TIME_FORMATS = [
    {
        value: "H:mm",
        label: "8:02",
    },
    {
        value: "HH:mm",
        label: "08:02",
    },
    {
        value: "h:mm A",
        label: "8:02 AM",
    },
    {
        value: "hh:mm A",
        label: "08:02 AM",
    },
    {
        value: "h:mm a",
        label: "8:02 am",
    },
    {
        value: "hh:mm a",
        label: "08:02 am",
    },
];

export const DEFAULT_CONFIG: CardConfig = {
    type: "custom:today-card",
    title: "",
    advance: 0,
    time_format: "HH:mm",
    fallback_color: "primary",
    show_all_day_events: true,
    show_past_events: false,
    limit: 0,
    tap_action: {
        action: "none",
    },
    entities: [],
};
