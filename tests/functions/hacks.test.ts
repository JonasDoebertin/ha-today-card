import {beforeEach, describe, expect, test} from "bun:test";
import {loadHaComponents} from "../../src/functions/hacks";

// customElements registrations are process-wide and permanent, but --rerun-each
// re-imports this module fresh on every run. A module-scope array would only
// ever be reachable from whichever run's classes first won the registration,
// so the recording lives on globalThis, which persists like the registry does.
const ASKED = Symbol.for("ha-today-card:hacks-test:asked");
const withAsked = globalThis as typeof globalThis & {
    [ASKED]?: string[];
};

function asked(): string[] {
    return (withAsked[ASKED] ??= []);
}

class EntitiesCardStub extends HTMLElement {
    static getConfigElement(): void {
        asked().push("hui-entities-card");
    }
}

class EntityBadgeStub extends HTMLElement {
    static getConfigElement(): void {
        asked().push("hui-entity-badge");
    }
}

if (!customElements.get("hui-entities-card")) {
    customElements.define("hui-entities-card", EntitiesCardStub);
}
if (!customElements.get("hui-entity-badge")) {
    customElements.define("hui-entity-badge", EntityBadgeStub);
}

beforeEach((): void => {
    asked().length = 0;
});

/**
 * Home Assistant does not register `ha-entity-picker` or `ha-form` until
 * something asks a built-in card for its config element. The editor needs both
 * before it renders, so it pokes the built-in cards into loading them.
 */
describe("loadHaComponents", (): void => {
    test("survives a Home Assistant that has not loaded ha-entity-picker or ha-form", (): void => {
        // Neither guard tag is ever registered in this file, on any run, so
        // this holds regardless of rerun order.
        expect((): void => loadHaComponents()).not.toThrow();
    });

    test("asks the built-in cards for their config elements", (): void => {
        loadHaComponents();

        expect(asked()).toEqual(["hui-entities-card", "hui-entity-badge"]);
    });
});
