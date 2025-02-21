import {getFallBackColor} from "./colors.js";

export function fireEvent(node, type, detail, options) {
    options = options || {};
    detail = detail === null || detail === undefined ? {} : detail;

    const event = new Event(type, {
        bubbles: options.bubbles === undefined ? true : options.bubbles,
        cancelable: Boolean(options.cancelable),
        composed: options.composed === undefined ? true : options.composed,
    });
    event.detail = detail;
    node.dispatchEvent(event);

    return event;
}

export function processEditorEntities(entities, assignColors = false) {
    return entities.map((entry, i) => {
        if (typeof entry === "string") {
            return {
                entity: entry,
                color: getFallBackColor(i),
            };
        }

        // TODO: Inject color for object type entrys
        // TODO: Only inject colors if enabled

        return entry;
    });
}
