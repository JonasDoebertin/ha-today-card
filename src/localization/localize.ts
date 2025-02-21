import * as de from './lang/de.json';
import * as en from './lang/en.json';
import {HomeAssistant} from "custom-card-helpers";

const TRANSLATIONS: Record<string, unknown> = {
    de,
    en,
    'en-GB': en,
};

const DEFAULT_LANG: string = 'en' ;

function getTranslatedString(lang: string, key: string): string | undefined
{
    try {
        return key
            .split('.')
            .reduce(
                (reduced, current) => (reduced as Record<string, unknown>)[current], TRANSLATIONS[lang]
            ) as string;
    }
    catch (error) {
        return undefined;
    }
}

export default function localize(hass: HomeAssistant, key: string) {
    const lang = hass?.language ?? DEFAULT_LANG;

    let translated: string | undefined;

    if (TRANSLATIONS[lang]) {
        translated = getTranslatedString(lang, key);
    } else {
        translated = getTranslatedString(DEFAULT_LANG, key);
    }

    return translated ?? key;
}
