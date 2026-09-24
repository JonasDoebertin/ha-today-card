import {afterEach, describe, expect, Mock, spyOn, test} from "bun:test";
import {loadHaComponents} from "../../src/functions/hacks";

// Spying on customElements.get keeps each test's fixtures local, unlike a
// real customElements.define, which is permanent for the process.
let get: Mock<typeof customElements.get> | undefined;

afterEach((): void => {
    get?.mockRestore();
});

// Home Assistant does not register ha-entity-picker or ha-form until
// something asks a built-in card for its config element.
describe("loadHaComponents", (): void => {
    test("survives a Home Assistant that has not loaded the built-in cards", (): void => {
        get = spyOn(customElements, "get").mockReturnValue(undefined);

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

        get = spyOn(customElements, "get").mockImplementation(
            (tag: string): CustomElementConstructor | undefined => {
                if (tag === "hui-entities-card") {
                    return EntitiesCardStub;
                }
                if (tag === "hui-entity-badge") {
                    return EntityBadgeStub;
                }
                return undefined;
            },
        );

        loadHaComponents();

        expect(asked).toEqual(["hui-entities-card", "hui-entity-badge"]);
    });
});
