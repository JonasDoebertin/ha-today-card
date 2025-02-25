import {EntitiesRowConfig} from "../structs/config";
import {getFallBackColor} from "./colors";
import {getHass} from "../globals";

export function getEntityName(entity: string): string {
    const hass = getHass();
    if (!hass) {
        return entity;
    }

    return hass.entities[entity]?.name ?? entity;
}

export function processEditorEntities(
    entities: (EntitiesRowConfig | string)[],
    assignColors: boolean = false
): EntitiesRowConfig[] {
    return entities.map((entry, i) => {
        if (typeof entry === "string") {
            return {
                entity: entry,
                color: assignColors ? getFallBackColor(i): "",
            };
        }

        return {
            entity: entry.entity,
            color: entry.color ?? (assignColors ? getFallBackColor(i): ""),
        };
    });
}
