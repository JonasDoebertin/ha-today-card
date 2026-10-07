import * as de from "./lang/de.json";
import * as en from "./lang/en.json";
import * as es from "./lang/es.json";
import * as fr from "./lang/fr.json";
import * as it from "./lang/it.json";
import {getHass} from "../globals";

const TRANSLATIONS: Record<string, unknown> = {
    de,
    en,
    es,
    fr,
    it,
};

const DEFAULT_LANG: string = "en";

function getTranslatedString(lang: string, key: string): string | undefined {
    try {
        return key
            .split(".")
            .reduce(
                (reduced, current) =>
                    (reduced as Record<string, unknown>)[current],
                TRANSLATIONS[lang],
            ) as string;
    } catch (error) {
        return undefined;
    }
}

export default function localize(key: string, language?: string): string {
    const lang = language ?? getHass()?.language ?? DEFAULT_LANG;
    const base = lang.split("-")[0] as string;

    // Exact code, then base language (es-419 → es), then English, then the key.
    return (
        getTranslatedString(lang, key)
        ?? getTranslatedString(base, key)
        ?? getTranslatedString(DEFAULT_LANG, key)
        ?? key
    );
}
