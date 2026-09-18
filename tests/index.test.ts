import {describe, expect, test} from "bun:test";

interface CustomCard {
    type: string;
    name: string;
    description: string;
    documentationURL: string;
    getEntitySuggestion?: unknown;
}

describe("the bundle entry point", (): void => {
    test("registers the card with Home Assistant's picker", async (): Promise<void> => {
        const info = console.info;
        console.info = (): void => {};

        try {
            await import("../src/index");
        } finally {
            console.info = info;
        }

        const cards = (window as unknown as {customCards: CustomCard[]})
            .customCards;
        const card = cards.find((entry) => entry.type === "today-card");

        expect(card).toBeDefined();
        expect(card?.name).toBe("Today");
        expect(card?.documentationURL).toContain("ha-today-card");
        // Home Assistant 2026.6 and later read this to decide whether to offer
        // the card for a picked entity.
        expect(typeof card?.getEntitySuggestion).toBe("function");
    });

    test("defines every element the card needs", async (): Promise<void> => {
        const info = console.info;
        console.info = (): void => {};

        try {
            await import("../src/index");
        } finally {
            console.info = info;
        }

        expect(customElements.get("today-card")).toBeDefined();
        expect(customElements.get("today-card-editor")).toBeDefined();
        expect(customElements.get("today-card-entities-editor")).toBeDefined();
    });
});
