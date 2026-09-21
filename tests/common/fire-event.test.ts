import {describe, expect, test} from "bun:test";
import {fireEvent} from "../../src/common/fire-event";

function listen(
    node: HTMLElement,
    type: string,
): {events: Event[]; details: unknown[]} {
    const events: Event[] = [];
    const details: unknown[] = [];

    node.addEventListener(type, (event: Event): void => {
        events.push(event);
        details.push((event as CustomEvent).detail);
    });

    return {events, details};
}

describe("fireEvent", (): void => {
    test("dispatches under the given type", (): void => {
        const node = document.createElement("div");
        const {events} = listen(node, "config-changed");

        fireEvent(node, "config-changed" as never);

        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe("config-changed");
    });

    test("carries its detail payload", (): void => {
        const node = document.createElement("div");
        const {details} = listen(node, "hass-action");

        fireEvent(
            node,
            "hass-action" as never,
            {
                config: {},
                action: "tap",
            } as never,
        );

        expect(details[0]).toEqual({config: {}, action: "tap"});
    });

    test("uses an empty object when no detail is given", (): void => {
        const node = document.createElement("div");
        const {details} = listen(node, "config-changed");

        fireEvent(node, "config-changed" as never);

        expect(details[0]).toEqual({});
    });

    test("bubbles and crosses the shadow boundary by default", (): void => {
        // Both matter: the card fires from inside its shadow root and Home
        // Assistant listens outside it.
        const node = document.createElement("div");
        const {events} = listen(node, "config-changed");

        fireEvent(node, "config-changed" as never);

        expect(events[0]?.bubbles).toBe(true);
        expect(events[0]?.composed).toBe(true);
        expect(events[0]?.cancelable).toBe(false);
    });

    test("honors explicit options", (): void => {
        const node = document.createElement("div");
        const {events} = listen(node, "config-changed");

        fireEvent(node, "config-changed" as never, undefined, {
            bubbles: false,
            composed: false,
            cancelable: true,
        });

        expect(events[0]?.bubbles).toBe(false);
        expect(events[0]?.composed).toBe(false);
        expect(events[0]?.cancelable).toBe(true);
    });

    test("returns the event it dispatched", (): void => {
        const node = document.createElement("div");

        const event = fireEvent(node, "config-changed" as never);

        expect(event).toBeInstanceOf(Event);
        expect(event.type).toBe("config-changed");
    });

    test("reaches a listener on an ancestor", (): void => {
        const parent = document.createElement("div");
        const child = document.createElement("span");
        parent.appendChild(child);
        document.body.appendChild(parent);

        const {events} = listen(parent, "config-changed");

        fireEvent(child, "config-changed" as never);

        expect(events).toHaveLength(1);
    });
});
