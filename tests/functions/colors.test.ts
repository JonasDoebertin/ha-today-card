import {describe, expect, test} from "bun:test";
import {
    computeCssColor,
    FALLBACK_COLORS,
    getFallBackColor,
    THEME_COLORS,
} from "../../src/functions/colors";

describe("computeCssColor", (): void => {
    test("maps a theme color name to its CSS variable", (): void => {
        expect(computeCssColor("red")).toBe("var(--red-color)");
        expect(computeCssColor("deep-purple")).toBe("var(--deep-purple-color)");
        expect(computeCssColor("primary")).toBe("var(--primary-color)");
    });

    test("passes anything that is not a theme color through untouched", (): void => {
        expect(computeCssColor("#ff0000")).toBe("#ff0000");
        expect(computeCssColor("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
        expect(computeCssColor("var(--my-own-color)")).toBe(
            "var(--my-own-color)",
        );
    });

    test("falls back to the primary color when none is given", (): void => {
        expect(computeCssColor("")).toBe("var(--primary-color)");
        expect(computeCssColor(undefined)).toBe("var(--primary-color)");
    });

    test("is case sensitive, so a mis-cased theme name is treated as a literal", (): void => {
        expect(computeCssColor("Red")).toBe("Red");
    });
});

describe("getFallBackColor", (): void => {
    test("hands out the list in order", (): void => {
        expect(getFallBackColor(0)).toBe(FALLBACK_COLORS[0] as string);
        expect(getFallBackColor(1)).toBe(FALLBACK_COLORS[1] as string);
    });

    test("wraps around once the list runs out", (): void => {
        expect(getFallBackColor(FALLBACK_COLORS.length)).toBe(
            FALLBACK_COLORS[0] as string,
        );
        expect(getFallBackColor(FALLBACK_COLORS.length + 1)).toBe(
            FALLBACK_COLORS[1] as string,
        );
    });

    test("only returns colors the card can resolve to a variable", (): void => {
        for (const color of FALLBACK_COLORS) {
            expect(THEME_COLORS).toContain(color);
            expect(computeCssColor(color)).toBe(`var(--${color}-color)`);
        }
    });
});
