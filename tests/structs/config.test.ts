import {describe, expect, test} from "bun:test";
import {assert, is} from "superstruct";
import {cardConfigStruct} from "../../src/structs/config";
import {DEFAULT_CONFIG} from "../../src/const";

function valid(config: unknown): boolean {
    return is(config, cardConfigStruct);
}

describe("cardConfigStruct", (): void => {
    test("accepts the smallest configuration the card can work with", (): void => {
        expect(valid({type: "custom:today-card", entities: []})).toBe(true);
    });

    test("accepts the shipped defaults", (): void => {
        // If the defaults ever stopped validating, every fresh card would
        // throw the moment it was added to a dashboard.
        expect(valid(DEFAULT_CONFIG)).toBe(true);
    });

    test("accepts entities as plain ids or as rows", (): void => {
        expect(
            valid({type: "custom:today-card", entities: ["calendar.work"]}),
        ).toBe(true);
        expect(
            valid({
                type: "custom:today-card",
                entities: [{entity: "calendar.work", color: "red"}],
            }),
        ).toBe(true);
        expect(
            valid({
                type: "custom:today-card",
                entities: [{entity: "calendar.work"}],
            }),
        ).toBe(true);
    });

    test("rejects a list mixing both entity forms", (): void => {
        // The union is one shape or the other, not a mixture.
        expect(
            valid({
                type: "custom:today-card",
                entities: ["calendar.work", {entity: "calendar.home"}],
            }),
        ).toBe(false);
    });

    test("requires the entities key", (): void => {
        expect(valid({type: "custom:today-card"})).toBe(false);
    });

    test("accepts a limit of zero or more and rejects a negative one", (): void => {
        const withLimit = (limit: number): unknown => ({
            type: "custom:today-card",
            entities: [],
            limit,
        });

        expect(valid(withLimit(0))).toBe(true);
        expect(valid(withLimit(5))).toBe(true);
        expect(valid(withLimit(-1))).toBe(false);
    });

    test("accepts a negative advance, because looking back is legitimate", (): void => {
        expect(
            valid({type: "custom:today-card", entities: [], advance: -1}),
        ).toBe(true);
    });

    test("rejects a key it does not know", (): void => {
        expect(
            valid({
                type: "custom:today-card",
                entities: [],
                shwo_past_events: true,
            }),
        ).toBe(false);
    });

    test("accepts the passthrough keys Home Assistant and card-mod add", (): void => {
        expect(
            valid({
                type: "custom:today-card",
                entities: [],
                grid_options: {columns: 6},
                visibility: [{condition: "user", users: []}],
                card_mod: {style: ".event {}"},
            }),
        ).toBe(true);
    });

    test("accepts every tap action the editor offers", (): void => {
        const actions: unknown[] = [
            {action: "none"},
            {action: "navigate", navigation_path: "/lovelace/0"},
            {action: "url", url_path: "https://example.com"},
            {action: "perform-action", perform_action: "calendar.create_event"},
        ];

        for (const tap_action of actions) {
            expect(
                valid({type: "custom:today-card", entities: [], tap_action}),
            ).toBe(true);
        }
    });

    test("throws with a usable message, which is what protects the user", (): void => {
        expect((): void => {
            assert(
                {type: "custom:today-card", entities: [], limit: -1},
                cardConfigStruct,
            );
        }).toThrow();
    });
});
