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

    test("falls back to the base language for a regional Spanish variant", (): void => {
        setHass(fakeHass({language: "es-419"}));

        expect(localize("noEvents.title")).toBe(
            readKey(es, "noEvents.title") as string,
        );
    });

    test("falls back to the base language for Swiss German", (): void => {
        setHass(fakeHass({language: "de-CH"}));

        expect(localize("noEvents.title")).toBe(
            readKey(de, "noEvents.title") as string,
        );
    });

    test("falls back to English for a regional variant nothing ships", (): void => {
        setHass(fakeHass({language: "pt-BR"}));

        expect(localize("noEvents.title")).toBe(
            readKey(en, "noEvents.title") as string,
        );
    });

    test("accepts a language override instead of reading the global hass", (): void => {
        setHass(fakeHass({language: "en"}));

        expect(localize("noEvents.title", "de")).toBe(
            readKey(de, "noEvents.title") as string,
        );
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

describe("translation fixes", (): void => {
    test("fr", (): void => {
        expect(localize("event.schedule.from", "fr")).toBe("À partir de");
        expect(localize("config.stub.title", "fr")).toBe("Programme du jour");
        expect(localize("config.label.advance", "fr")).toBe(
            "Jours de décalage",
        );
        expect(localize("config.label.limit", "fr")).toBe(
            "Nombre maximum d'événements",
        );
        expect(localize("config.label.show_all_day_events", "fr")).toBe(
            "Afficher les événements sur toute la journée",
        );
        expect(localize("config.label.show_past_events", "fr")).toBe(
            "Afficher les événements passés",
        );
    });

    test("de", (): void => {
        expect(localize("config.label.fallback_color", "de")).toBe(
            "Standardfarbe",
        );
        expect(localize("config.label.show_all_day_events", "de")).toBe(
            "Ganztägige Termine anzeigen",
        );
        expect(localize("config.label.show_past_events", "de")).toBe(
            "Vergangene Termine anzeigen",
        );
    });

    test("en", (): void => {
        expect(localize("config.label.show_all_day_events", "en")).toBe(
            "Show all-day events",
        );
        expect(localize("config.label.fallback_color", "en")).toBe(
            "Fallback color",
        );
        expect(localize("config.label.time_format", "en")).toBe(
            "Time display format",
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

            expect(missing).toEqual([]);
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
