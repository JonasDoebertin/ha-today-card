import {describe, expect, test} from "bun:test";
import {mount, shadowHtml} from "./mount";
import {fakeHass} from "./factories";

describe("test harness", (): void => {
    test("pins the timezone so date fixtures mean the same everywhere", (): void => {
        expect(process.env.TZ).toBe("UTC");
    });

    test("provides a DOM with the Home Assistant elements stubbed", (): void => {
        expect(typeof customElements.define).toBe("function");
        expect(customElements.get("ha-card")).toBeDefined();
        expect(customElements.get("action-handler")).toBeDefined();
    });

    test("mounts a Lit element and waits for its first render", async (): Promise<void> => {
        await import("../../src/elements/card");

        const card = await mount("today-card", {hass: fakeHass()});

        expect(shadowHtml(card)).toBeString();
    });
});
