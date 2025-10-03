import {
    any,
    array,
    assign,
    boolean,
    Infer,
    number,
    object,
    optional,
    string,
    union,
} from "superstruct";
import {actionConfigStruct} from "./action";

export const baseCardConfigStruct = object({
    type: string(),
    view_layout: any(),
    layout_options: any(),
    grid_options: any(),
    visibility: any(),
    card_mod: any(),
});

export type BaseCardConfig = Infer<typeof baseCardConfigStruct>;

export const entitiesRowConfigStruct = object({
    entity: string(),
    color: optional(string()),
});

export type EntitiesRowConfig = Infer<typeof entitiesRowConfigStruct>;

export const cardConfigStruct = assign(
    baseCardConfigStruct,
    object({
        title: optional(string()),
        advance: optional(number()),
        time_format: optional(string()),
        fallback_color: optional(string()),
        show_all_day_events: optional(boolean()),
        show_past_events: optional(boolean()),
        event_limit: optional(number()),
        tap_action: optional(actionConfigStruct),
        entities: union([array(string()), array(entitiesRowConfigStruct)]),
    }),
);

export type CardConfig = Infer<typeof cardConfigStruct>;
