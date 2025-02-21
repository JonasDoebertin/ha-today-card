import * as de from './lang/de.json';
import * as en from './lang/en.json';

const TRANSLATIONS = {
    de,
    en,
    'en-GB': en,
};

const DEFAULT_LANG = 'en';

function getTranslatedString(lang, key)
{
    try {
        return key
            .split('.')
            .reduce((reduced, current) => reduced[current], TRANSLATIONS[lang]);
    }
    catch (error) {
        console.error(`Key "${key}" not found in language "${lang}" for Today Card.`);
        return undefined;
    }
}

export default function localize(hass, key) {
    const lang = (
        hass?.locale?.language || hass?.language || localStorage.getItem('selectedLanguage')
    ) ?? DEFAULT_LANG;
    let translated;

    if (TRANSLATIONS[lang]) {
        translated = getTranslatedString(lang, key);
    } else {
        translated = getTranslatedString(DEFAULT_LANG, key);
        console.warn(`Language "${lang}" is currently not supported by Today Card.`);
    }

    return translated ?? key;
}
