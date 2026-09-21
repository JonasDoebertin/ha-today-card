import {HomeAssistant} from "custom-card-helpers";
import {EntitiesRowConfig} from "../structs/config";
import {getFallBackColor} from "./colors";

export function getEntityName(
    hass: HomeAssistant | null | undefined,
    entity: string,
): string {
    if (!hass) {
        return entity;
    }

    return hass.states[entity]?.attributes?.friendly_name ?? entity;
}

export function processEditorEntities(
    entities: (EntitiesRowConfig | string)[],
    assignColors: boolean = false,
): EntitiesRowConfig[] {
    return entities
        .map((entry, i) => {
            const entity = typeof entry === "string" ? entry : entry.entity;
            const color = typeof entry === "string" ? undefined : entry.color;

            if (color) {
                return {entity, color};
            }

            // Leave the key off rather than writing "". An empty string is
            // not nullish, so the card's own ?? would never replace it.
            return assignColors
                ? {entity, color: getFallBackColor(i)}
                : {entity};
        })
        .filter((entry: EntitiesRowConfig): boolean => {
            return entry.entity.startsWith("calendar.");
        });
}

export function isEqual<T>(a: T, b: T): boolean {
    if (a === b) {
        return true;
    }

    const bothAreObjects =
        a && b && typeof a === "object" && typeof b === "object";

    return Boolean(
        bothAreObjects
        && Object.keys(a).length === Object.keys(b).length
        && Object.entries(a).every(([k, v]) => isEqual(v, b[k as keyof T])),
    );
}
