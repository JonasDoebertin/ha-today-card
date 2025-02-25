export function fireEvent(
    node: HTMLElement,
    type: string,
    detail: Record<string, any> | null | undefined,
    options?: Record<string, any>
): Event {
    options = options || {};
    detail = detail === null || detail === undefined ? {} : detail;

    const event = new Event(type, {
        bubbles: options.bubbles === undefined ? true : options.bubbles,
        cancelable: Boolean(options.cancelable),
        composed: options.composed === undefined ? true : options.composed,
    });
    // @ts-ignore
    event.detail = detail;

    node.dispatchEvent(event);

    return event;
}
