import {describe, expect, test} from "bun:test";
import localize from "../../src/localization/localize";
import {setHass} from "../../src/globals";
import {fakeHass} from "../support/factories";
import * as de from "../../src/localization/lang/de.json";
import * as en from "../../src/localization/lang/en.json";
import * as es from "../../src/localization/lang/es.json";
import * as fr from "../../src/localization/lang/fr.json";
import * as it from "../../src/localization/lang/it.json";

/** Every dotted path to a string in a language file. */
function leafKeys(source: Record<string, unknown>, prefix = ""): string[] {
    return (
        Object.entries(source)
            // A JSON namespace import carries a `default` alias of the whole file.
            .filter(([key]) => key !== "default")
            .flatMap(([key, value]): string[] => {
                const path = prefix ? `${prefix}.${key}` : key;

                return typeof value === "object" && value !== null
                    ? leafKeys(value as Record<string, unknown>, path)
                    : [path];
            })
    );
}

function readKey(
    source: Record<string, unknown>,
    key: string,
): string | undefined {
    return key.split(".").reduce<unknown>((reduced, part) => {
        return reduced === undefined || reduced === null
            ? undefined
            : (reduced as Record<string, unknown>)[part];
    }, source) as string | undefined;
}

/**
 * Keys these languages do not translate yet. Home Assistant users see the
 * English string instead, which is the designed fallback rather than a
 * failure, so the suite records the gap rather than pretending it is not
 * there. Adding a translation makes the matching assertion fail, which is the
 * reminder to shorten this list; a newly added English key that nobody has
 * translated fails too.
 */
const KNOWN_GAPS: Record<string, string[]> = {
    es: ["error.title"],
    fr: ["config.label.exclude", "error.title"],
    it: ["config.label.exclude", "error.title"],
};

describe("localize", (): void => {
    test("returns the string for the language Home Assistant reports", (): void => {
        setHass(fakeHass({language: "de"}));

        // Read the expectation from the file rather than hardcoding it, so
        // improving a translation does not break the test.
        expect(localize("noEvents.title")).toBe(
            readKey(de, "noEvents.title") as string,
        );
    });

    test("uses English before Home Assistant is known", (): void => {
        setHass(null as never);

        expect(localize("noEvents.title")).toBe(
            readKey(en, "noEvents.title") as string,
        );
    });

    test("falls back to English for a language it does not ship", (): void => {
        setHass(fakeHass({language: "sv"}));

        expect(localize("noEvents.title")).toBe(
            readKey(en, "noEvents.title") as string,
        );
    });

    test("serves British English from the English file", (): void => {
        setHass(fakeHass({language: "en-GB"}));

        expect(localize("noEvents.title")).toBe(
            readKey(en, "noEvents.title") as string,
        );
    });

    test("falls back to English for a key a translation has not caught up with", (): void => {
        for (const [language, keys] of Object.entries(KNOWN_GAPS)) {
            setHass(fakeHass({language}));

            for (const key of keys) {
                expect(localize(key)).toBe(readKey(en, key) as string);
            }
        }
    });

    test("returns the key itself when nothing defines it", (): void => {
        setHass(fakeHass({language: "en"}));

        expect(localize("this.key.does.not.exist")).toBe(
            "this.key.does.not.exist",
        );
    });

    test("does not throw when the path runs through a string", (): void => {
        setHass(fakeHass({language: "en"}));

        expect(localize("event.schedule.from.nope")).toBe(
            "event.schedule.from.nope",
        );
    });
});

describe("language parity", (): void => {
    const languages: Record<string, Record<string, unknown>> = {de, es, fr, it};
    const expectedKeys = leafKeys(en as unknown as Record<string, unknown>);

    test("English defines at least one key, so the comparison means something", (): void => {
        expect(expectedKeys.length).toBeGreaterThan(0);
    });

    for (const [language, translations] of Object.entries(languages)) {
        test(`${language} defines every key English does`, (): void => {
            const missing = expectedKeys.filter((key): boolean => {
                return typeof readKey(translations, key) !== "string";
            });

            expect(missing).toEqual(KNOWN_GAPS[language] ?? []);
        });
    }

    for (const [language, translations] of Object.entries(languages)) {
        test(`${language} defines no key English has dropped`, (): void => {
            const extra = leafKeys(translations).filter((key): boolean => {
                return (
                    typeof readKey(
                        en as unknown as Record<string, unknown>,
                        key,
                    ) !== "string"
                );
            });

            expect(extra).toEqual([]);
        });
    }
});
