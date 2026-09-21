import {beforeEach, describe, expect, test} from "bun:test";
import {
    getEntityName,
    isEqual,
    processEditorEntities,
} from "../../src/functions/config";
import {FALLBACK_COLORS} from "../../src/functions/colors";
import {setHass} from "../../src/globals";
import {entityState, fakeHass} from "../support/factories";

describe("processEditorEntities", (): void => {
    test("turns plain entity ids into rows without inventing a color", (): void => {
        const result = processEditorEntities(["calendar.work"]);

        // Not toMatchObject: a stray `color: undefined` would leak into the
        // saved configuration, so the row has to be exactly this.
        expect(result).toEqual([{entity: "calendar.work"}]);
    });

    test("assigns the fallback colors in order when asked to", (): void => {
        const result = processEditorEntities(
            ["calendar.a", "calendar.b", "calendar.c"],
            true,
        );

        expect(result).toEqual([
            {entity: "calendar.a", color: FALLBACK_COLORS[0] as string},
            {entity: "calendar.b", color: FALLBACK_COLORS[1] as string},
            {entity: "calendar.c", color: FALLBACK_COLORS[2] as string},
        ]);
    });

    test("keeps a color the user chose", (): void => {
        const result = processEditorEntities(
            [{entity: "calendar.work", color: "#abcdef"}],
            true,
        );

        expect(result).toEqual([{entity: "calendar.work", color: "#abcdef"}]);
    });

    test("treats an empty color as no color at all", (): void => {
        // A configuration damaged by the old editor stored "" here, which is
        // not nullish, so the card's own ?? never replaced it.
        expect(processEditorEntities([{entity: "calendar.work", color: ""}])) //
            .toEqual([{entity: "calendar.work"}]);

        expect(
            processEditorEntities([{entity: "calendar.work", color: ""}], true),
        ).toEqual([
            {entity: "calendar.work", color: FALLBACK_COLORS[0] as string},
        ]);
    });

    test("drops entities from other domains", (): void => {
        const result = processEditorEntities(
            ["light.kitchen", "calendar.work", "sensor.temperature"],
            false,
        );

        expect(result).toEqual([{entity: "calendar.work"}]);
    });

    test("colors by original position, so removing a calendar recolors the rest", (): void => {
        const result = processEditorEntities(
            ["light.kitchen", "calendar.work"],
            true,
        );

        expect(result).toEqual([
            {entity: "calendar.work", color: FALLBACK_COLORS[1] as string},
        ]);
    });

    test("accepts an empty list", (): void => {
        expect(processEditorEntities([])).toEqual([]);
    });
});

describe("getEntityName", (): void => {
    beforeEach((): void => {
        setHass(
            fakeHass({
                states: {"calendar.work": entityState("Work Calendar")},
            }),
        );
    });

    test("prefers the friendly name Home Assistant knows", (): void => {
        expect(getEntityName("calendar.work")).toBe("Work Calendar");
    });

    test("falls back to the entity id for an unknown entity", (): void => {
        expect(getEntityName("calendar.missing")).toBe("calendar.missing");
    });

    test("falls back to the entity id when the entity has no friendly name", (): void => {
        setHass(fakeHass({states: {"calendar.bare": {attributes: {}}}}));

        expect(getEntityName("calendar.bare")).toBe("calendar.bare");
    });

    test("falls back to the entity id before Home Assistant is known", (): void => {
        setHass(null as never);

        expect(getEntityName("calendar.work")).toBe("calendar.work");
    });
});

describe("isEqual", (): void => {
    test("compares primitives by value", (): void => {
        expect(isEqual(1, 1)).toBe(true);
        expect(isEqual("a", "a")).toBe(true);
        expect(isEqual(1, 2)).toBe(false);
        expect(isEqual(null, null)).toBe(true);
    });

    test("compares nested objects by their contents", (): void => {
        expect(isEqual({a: {b: [1, 2]}}, {a: {b: [1, 2]}})).toBe(true);
        expect(isEqual({a: {b: [1, 2]}}, {a: {b: [1, 3]}})).toBe(false);
    });

    test("notices a differing number of keys", (): void => {
        expect(isEqual({a: 1}, {a: 1, b: 2} as unknown as {a: number})).toBe(
            false,
        );
    });

    test("compares arrays element by element", (): void => {
        expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
        expect(isEqual([1, 2, 3], [1, 2])).toBe(false);
        expect(isEqual([{a: 1}], [{a: 1}])).toBe(true);
    });

    test("does not consider null equal to an object", (): void => {
        expect(isEqual(null as unknown as {a: number}, {a: 1})).toBe(false);
        expect(isEqual({a: 1}, undefined as unknown as {a: number})).toBe(
            false,
        );
    });
});
