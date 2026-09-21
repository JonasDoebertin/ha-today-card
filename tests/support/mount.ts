/** Let pending promises and microtasks settle before asserting. */
export async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
}

interface Updatable {
    updateComplete: Promise<unknown>;
}

/** Wait until the element has finished the render it currently owes us. */
export async function settle(element: HTMLElement): Promise<void> {
    await flush();
    await (element as unknown as Updatable).updateComplete;
}

/**
 * Attach an element to the document, apply properties, and wait until Lit has
 * rendered it.
 */
export async function mount<T extends HTMLElement>(
    tag: string,
    properties: Record<string, unknown> = {},
): Promise<T> {
    const element = document.createElement(tag) as T;

    Object.assign(element, properties);
    document.body.appendChild(element);

    await settle(element);

    return element;
}

/** The rendered markup of an element's shadow root. */
export function shadowHtml(element: HTMLElement): string {
    return element.shadowRoot?.innerHTML ?? "";
}

/** Every element in the shadow root matching a selector. */
export function shadowAll(element: HTMLElement, selector: string): Element[] {
    return Array.from(element.shadowRoot?.querySelectorAll(selector) ?? []);
}

/** The first element in the shadow root matching a selector, or null. */
export function shadowOne(
    element: HTMLElement,
    selector: string,
): Element | null {
    return element.shadowRoot?.querySelector(selector) ?? null;
}

/** Collect the events of a type that an element fires. */
export function recordEvents<T>(element: HTMLElement, type: string): T[] {
    const received: T[] = [];

    element.addEventListener(type, (event: Event): void => {
        received.push((event as CustomEvent<T>).detail);
    });

    return received;
}
