import * as de from "./lang/de.json";
import * as en from "./lang/en.json";
import * as es from "./lang/es.json";
import * as it from "./lang/it.json";
import {getHass} from "../globals";

const TRANSLATIONS: Record<string, unknown> = {
    de,
    en,
    "en-GB": en,
    es,
    it,
    "it-IT": it,
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

export default function localize(key: string): string {
    const lang = getHass()?.language ?? DEFAULT_LANG;

    let translated: string | undefined;

    if (TRANSLATIONS[lang]) {
        translated = getTranslatedString(lang, key);
    } else {
        translated = getTranslatedString(DEFAULT_LANG, key);
    }

    return translated ?? key;
}
