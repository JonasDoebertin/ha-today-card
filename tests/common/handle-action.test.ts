import {describe, expect, test} from "bun:test";
import {handleAction} from "../../src/common/handle-action";
import {fakeHass} from "../support/factories";

describe("handleAction", (): void => {
    test("hands the action to Home Assistant as a hass-action event", async (): Promise<void> => {
        const node = document.createElement("div");
        const received: unknown[] = [];

        node.addEventListener("hass-action", (event: Event): void => {
            received.push((event as CustomEvent).detail);
        });

        const config = {
            tap_action: {
                action: "navigate" as const,
                navigation_path: "/lovelace/0",
            },
        };
        await handleAction(node, fakeHass(), config, "tap");

        expect(received).toEqual([{config, action: "tap"}]);
    });

    test("fires an event that can escape a shadow root", async (): Promise<void> => {
        // The card fires this from inside its own shadow root, so an event
        // that neither bubbles nor composes would never reach Home Assistant.
        const node = document.createElement("div");
        let event: Event | undefined;

        node.addEventListener("hass-action", (dispatched: Event): void => {
            event = dispatched;
        });

        await handleAction(node, fakeHass(), {}, "tap");

        expect(event?.bubbles).toBe(true);
        expect(event?.composed).toBe(true);
    });

    test("passes the action through verbatim", async (): Promise<void> => {
        const node = document.createElement("div");
        const actions: string[] = [];

        node.addEventListener("hass-action", (event: Event): void => {
            actions.push((event as CustomEvent).detail.action);
        });

        await handleAction(node, fakeHass(), {}, "hold");
        await handleAction(node, fakeHass(), {}, "double_tap");

        expect(actions).toEqual(["hold", "double_tap"]);
    });
});
