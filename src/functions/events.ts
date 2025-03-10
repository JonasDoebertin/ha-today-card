export function fireEvent(
    node: HTMLElement,
    type: string,
    detail: Record<string, any> | null | undefined,
    options?: Record<string, any>,
): Event {
    options = options || {};
    detail = detail === null || detail === undefined ? {} : detail;

    const event = new CustomEvent(type, {
        bubbles: options.bubbles === undefined ? true : options.bubbles,
        cancelable: Boolean(options.cancelable),
        composed: options.composed === undefined ? true : options.composed,
        detail: detail,
    });

    node.dispatchEvent(event);

    return event;
}
