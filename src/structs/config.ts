import {any, array, assign, boolean, Infer, number, object, optional, string, union} from "superstruct";

export const BaseCardConfig = object({
    type: string(),
    view_layout: any(),
    layout_options: any(),
    grid_options: any(),
    visibility: any(),
    card_mod: any(),
});

export type BaseCardConfig = Infer<typeof BaseCardConfig>;

export const EntitiesRowConfig = object({
    entity: string(),
    color: optional(string()),
});

export type EntitiesRowConfig = Infer<typeof EntitiesRowConfig>;

export const CardConfig = assign(
    BaseCardConfig,
    object({
        title: optional(string()),
        advance: optional(number()),
        time_format: optional(string()),
        fallback_color: optional(string()),
        show_all_day_events: optional(boolean()),
        show_past_events: optional(boolean()),
        entities: union([array(string()), array(EntitiesRowConfig)]),
    }),
);

export type CardConfig = Infer<typeof CardConfig>;
