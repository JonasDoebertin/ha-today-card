import {any, array, assign, boolean, number, object, optional, string, union} from "superstruct";

export const baseCardConfigStruct = object({
    type: string(),
    view_layout: any(),
    layout_options: any(),
    grid_options: any(),
    visibility: any(),
});

export const entitiesRowConfigStruct = object({
    entity: string(),
    color: optional(string()),
});

export const cardConfigStruct = assign(
    baseCardConfigStruct,
    object({
        title: optional(string()),
        advance: optional(number()),
        show_all_day_events: optional(boolean()),
        show_past_events: optional(boolean()),
        entities: union([array(string()), array(entitiesRowConfigStruct)]),
    }),
);