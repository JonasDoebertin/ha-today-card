import {describe, expect, test} from "bun:test";
import {mount, shadowHtml} from "./mount";
import {fakeHass} from "./factories";

describe("test harness", (): void => {
    test("pins the timezone so date fixtures mean the same everywhere", (): void => {
        // Including when the shell that started the run had its own TZ: the
        // fixtures are UTC instants, so an ambient zone would break them.
        expect(process.env.TZ).toBe("UTC");
    });

    test("provides a DOM with custom element support", (): void => {
        expect(typeof customElements.define).toBe("function");
        expect(customElements.get("action-handler")).toBeDefined();
    });

    test("leaves the Home Assistant elements undefined, as they are in a test", (): void => {
        // They render as ordinary unknown elements, which is enough to query
        // them and drive them, and it keeps loadHaComponents honest.
        expect(customElements.get("ha-card")).toBeUndefined();
        expect(customElements.get("ha-form")).toBeUndefined();
        expect(customElements.get("ha-entity-picker")).toBeUndefined();
    });

    test("mounts a Lit element and waits for its first render", async (): Promise<void> => {
        await import("../../src/elements/card");

        const card = await mount("today-card", {hass: fakeHass()});

        expect(shadowHtml(card)).toContain("<ha-card");
    });
});
