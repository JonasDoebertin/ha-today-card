export const FALLBACK_COLORS = new Set([
    "blue",
    "yellow",
    "red",
    "cyan",
    "deep-purple",
    "pink",
]);

export const THEME_COLORS = new Set([
    "primary",
    "accent",
    "disabled",
    "red",
    "pink",
    "purple",
    "deep-purple",
    "indigo",
    "blue",
    "light-blue",
    "cyan",
    "teal",
    "green",
    "light-green",
    "lime",
    "yellow",
    "amber",
    "orange",
    "deep-orange",
    "brown",
    "light-grey",
    "grey",
    "dark-grey",
    "blue-grey",
    "black",
    "white",
]);

export function getFallBackColor(index)
{
    return FALLBACK_COLORS[index % FALLBACK_COLORS.size];
}

export function computeCssColor(color)
{
    if (THEME_COLORS.has(color)) {
        return `var(--${color}-color)`;
    }

    return color;
}
