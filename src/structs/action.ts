import {
    array,
    assign,
    boolean,
    dynamic,
    enums,
    Infer,
    literal,
    object,
    optional,
    string,
    union,
} from "superstruct";

const baseActionConfigStruct = object({
    action: enums([
        "call-service",
        "fire-dom-event",
        "navigate",
        "none",
        "perform-action",
        "url",
    ]),
});

export type BaseActionConfig = Infer<typeof baseActionConfigStruct>;

const urlActionConfigStruct = assign(
    baseActionConfigStruct,
    object({
        action: literal("url"),
        url_path: string(),
    }),
);

export type UrlActionConfig = BaseActionConfig
    & Infer<typeof urlActionConfigStruct>;

const serviceActionConfigStruct = assign(
    baseActionConfigStruct,
    object({
        action: enums(["call-service", "perform-action"]),
        service: optional(string()),
        perform_action: optional(string()),
        service_data: optional(object()),
        data: optional(object()),
        target: optional(
            object({
                entity_id: optional(union([string(), array(string())])),
                device_id: optional(union([string(), array(string())])),
                area_id: optional(union([string(), array(string())])),
                floor_id: optional(union([string(), array(string())])),
                label_id: optional(union([string(), array(string())])),
            }),
        ),
    }),
);

export type ServiceActionConfig = BaseActionConfig
    & Infer<typeof serviceActionConfigStruct>;

const navigateActionConfigStruct = assign(
    baseActionConfigStruct,
    object({
        action: literal("navigate"),
        navigation_path: string(),
        navigation_replace: optional(boolean()),
    }),
);

export type NavigateActionConfig = BaseActionConfig
    & Infer<typeof navigateActionConfigStruct>;

const customActionConfigStruct = assign(
    baseActionConfigStruct,
    object({
        action: literal("fire-dom-event"),
    }),
);

export type CustomActionConfig = BaseActionConfig
    & Infer<typeof customActionConfigStruct>;

const noActionConfigStruct = assign(
    baseActionConfigStruct,
    object({
        action: literal("none"),
    }),
);

export type NoActionConfig = BaseActionConfig
    & Infer<typeof noActionConfigStruct>;

export const actionConfigStruct = dynamic<any>((value) => {
    if (value && typeof value === "object" && "action" in value) {
        switch ((value as BaseActionConfig).action!) {
            case "call-service": {
                return serviceActionConfigStruct;
            }
            case "perform-action": {
                return serviceActionConfigStruct;
            }
            case "fire-dom-event": {
                return customActionConfigStruct;
            }
            case "navigate": {
                return navigateActionConfigStruct;
            }
            case "url": {
                return urlActionConfigStruct;
            }
            case "none": {
                return noActionConfigStruct;
            }
        }
    }

    return baseActionConfigStruct;
});

export type ActionConfig =
    | ServiceActionConfig
    | NavigateActionConfig
    | UrlActionConfig
    | NoActionConfig
    | CustomActionConfig;

export type UiAction = Exclude<ActionConfig["action"], "fire-dom-event">;
