import {describe, expect, test} from "bun:test";
import {loadHaComponents} from "../../src/functions/hacks";

/**
 * Home Assistant does not register `ha-entity-picker` or `ha-form` until
 * something asks a built-in card for its config element. The editor needs both
 * before it renders, so it pokes the built-in cards into loading them.
 */
describe("loadHaComponents", (): void => {
    test("survives a Home Assistant that has not loaded the built-in cards", (): void => {
        // Nothing to poke and nothing already registered: it must not throw,
        // or opening the editor would fail outright.
        expect((): void => loadHaComponents()).not.toThrow();
    });

    test("asks the built-in cards for their config elements", (): void => {
        const asked: string[] = [];

        class EntitiesCardStub extends HTMLElement {
            static getConfigElement(): void {
                asked.push("hui-entities-card");
            }
        }

        class EntityBadgeStub extends HTMLElement {
            static getConfigElement(): void {
                asked.push("hui-entity-badge");
            }
        }

        if (!customElements.get("hui-entities-card")) {
            customElements.define("hui-entities-card", EntitiesCardStub);
        }
        if (!customElements.get("hui-entity-badge")) {
            customElements.define("hui-entity-badge", EntityBadgeStub);
        }

        loadHaComponents();

        expect(asked).toEqual(["hui-entities-card", "hui-entity-badge"]);
    });
});
