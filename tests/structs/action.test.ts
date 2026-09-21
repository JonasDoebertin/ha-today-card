import {describe, expect, test} from "bun:test";
import {is} from "superstruct";
import {actionConfigStruct} from "../../src/structs/action";

function valid(action: unknown): boolean {
    return is(action, actionConfigStruct);
}

describe("actionConfigStruct", (): void => {
    test("requires a url action to say where to go", (): void => {
        expect(valid({action: "url", url_path: "https://example.com"})).toBe(
            true,
        );
        expect(valid({action: "url"})).toBe(false);
    });

    test("requires a navigate action to say where to go", (): void => {
        expect(valid({action: "navigate", navigation_path: "/lovelace/0"})) //
            .toBe(true);
        expect(
            valid({
                action: "navigate",
                navigation_path: "/lovelace/0",
                navigation_replace: true,
            }),
        ).toBe(true);
        expect(valid({action: "navigate"})).toBe(false);
    });

    test("accepts both spellings of a service call", (): void => {
        expect(valid({action: "call-service", service: "light.turn_on"})).toBe(
            true,
        );
        expect(
            valid({action: "perform-action", perform_action: "light.turn_on"}),
        ).toBe(true);
    });

    test("accepts a target given as one id or as a list", (): void => {
        expect(
            valid({
                action: "perform-action",
                perform_action: "light.turn_on",
                target: {entity_id: "light.kitchen"},
            }),
        ).toBe(true);
        expect(
            valid({
                action: "perform-action",
                perform_action: "light.turn_on",
                target: {entity_id: ["light.kitchen", "light.hall"]},
            }),
        ).toBe(true);
        expect(
            valid({
                action: "perform-action",
                perform_action: "light.turn_on",
                target: {area_id: ["kitchen"], floor_id: "ground"},
            }),
        ).toBe(true);
    });

    test("accepts the actions that carry no payload", (): void => {
        expect(valid({action: "none"})).toBe(true);
        expect(valid({action: "fire-dom-event"})).toBe(true);
    });

    test("rejects an action it does not know", (): void => {
        expect(valid({action: "self-destruct"})).toBe(false);
    });

    test("rejects a value that is not an action at all", (): void => {
        expect(valid({})).toBe(false);
        expect(valid("navigate")).toBe(false);
        expect(valid(null)).toBe(false);
    });

    test("rejects a url action carrying a navigation path instead", (): void => {
        expect(valid({action: "url", navigation_path: "/lovelace/0"})).toBe(
            false,
        );
    });
});
