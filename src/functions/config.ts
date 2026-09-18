import {EntitiesRowConfig} from "../structs/config";
import {getFallBackColor} from "./colors";
import {getHass} from "../globals";

export function getEntityName(entity: string): string {
    const hass = getHass();
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

            // Leave the key off entirely when there is no colour to report.
            // Writing an empty string here used to leak into the saved
            // configuration through the editor, and "" is not nullish, so the
            // card's own ?? never replaced it and every calendar rendered in
            // the primary colour. Treating "" as absent also repairs any
            // configuration already damaged that way.
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
