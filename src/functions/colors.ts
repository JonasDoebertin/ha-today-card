export const FALLBACK_COLORS: string[] = [
    "light-blue",
    "amber",
    "light-green",
    "pink",
    "deep-purple",
    "deep-orange",
];

export const THEME_COLORS: string[] = [
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
];

export function getFallBackColor(index: number): string
{
    return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function computeCssColor(color?: string): string
{
    if (color === "" || color === null || color === undefined) {
        color = "primary";
    }

    if (THEME_COLORS.includes(color)) {
        return `var(--${color}-color)`;
    }

    return color;
}
