import {describe, expect, test} from "bun:test";
import "../../src/elements/entity-editor";
import {EntitiesRowConfig} from "../../src/structs/config";
import {entityRow, entityState, fakeHass} from "../support/factories";
import {
    mount,
    recordEvents,
    settle,
    shadowAll,
    shadowOne,
} from "../support/mount";

interface EntitiesChanged {
    entities: EntitiesRowConfig[];
}

const STATES: Record<string, unknown> = {
    "calendar.work": entityState("Work Calendar"),
    "calendar.home": entityState("Home Calendar"),
    "calendar.sport": entityState("Sport Calendar"),
};

async function mountList(
    entities: EntitiesRowConfig[],
): Promise<{list: HTMLElement; changes: EntitiesChanged[]}> {
    const list = await mount("today-card-entities-editor", {
        hass: fakeHass({states: STATES}),
        entities,
    });
    const changes = recordEvents<EntitiesChanged>(list, "entities-changed");

    return {list, changes};
}

function dispatch(
    target: Element,
    type: string,
    detail: unknown,
    currentTargetIsSelf = true,
): void {
    const event = new Event(type, {bubbles: true, composed: true});
    (event as unknown as {detail: unknown}).detail = detail;

    if (currentTargetIsSelf) {
        target.dispatchEvent(event);
    }
}

describe("rendering the list", (): void => {
    test("shows a row per entity with its friendly name and its id", async (): Promise<void> => {
        const {list} = await mountList([
            entityRow("calendar.work", "red"),
            entityRow("calendar.home"),
        ]);

        const names = shadowAll(list, ".entity .name").map((element) =>
            element.textContent?.trim(),
        );
        const ids = shadowAll(list, ".entity .id").map(
            (element) => element.textContent,
        );

        expect(names).toEqual(["Work Calendar", "Home Calendar"]);
        expect(ids).toEqual(["calendar.work", "calendar.home"]);
    });

    test("offers the picker even with nothing configured yet", async (): Promise<void> => {
        const {list} = await mountList([]);

        expect(shadowAll(list, ".entity")).toEqual([]);
        expect(shadowOne(list, "ha-entity-picker")).not.toBeNull();
    });

    test("resolves the friendly name from its own hass property", async (): Promise<void> => {
        const list = await mount("today-card-entities-editor", {
            hass: fakeHass({states: STATES}),
            entities: [entityRow("calendar.work")],
        });

        expect(shadowOne(list, ".entity .name")?.textContent?.trim()).toBe(
            "Work Calendar",
        );
    });

    test("renders nothing before Home Assistant hands it a connection", async (): Promise<void> => {
        const list = await mount("today-card-entities-editor", {
            entities: [entityRow("calendar.work")],
        });

        expect(shadowOne(list, "ha-entity-picker")).toBeNull();
    });

    test("hands the picker the color the row already has", async (): Promise<void> => {
        const {list} = await mountList([
            entityRow("calendar.work", "red"),
            entityRow("calendar.home"),
        ]);
        const pickers = shadowAll(list, "ha-color-picker") as unknown as {
            value: string;
        }[];

        expect(pickers[0]?.value).toBe("red");
        expect(pickers[1]?.value).toBe("");
    });
});

describe("changing a color", (): void => {
    test("reports the new color on the right row only", async (): Promise<void> => {
        const {list, changes} = await mountList([
            entityRow("calendar.work", "red"),
            entityRow("calendar.home", "blue"),
        ]);

        dispatch(
            shadowAll(list, "ha-color-picker")[1] as Element,
            "value-changed",
            {
                value: "green",
            },
        );
        await settle(list);

        expect(changes[0]?.entities).toEqual([
            {entity: "calendar.work", color: "red"},
            {entity: "calendar.home", color: "green"},
        ]);
    });

    test("stays quiet when the color did not change", async (): Promise<void> => {
        const {list, changes} = await mountList([
            entityRow("calendar.work", "red"),
        ]);

        dispatch(
            shadowAll(list, "ha-color-picker")[0] as Element,
            "value-changed",
            {
                value: "red",
            },
        );
        await settle(list);

        expect(changes).toEqual([]);
    });

    test("drops the key rather than storing an empty color", async (): Promise<void> => {
        // "No color of my own" is expressed by leaving the key out. An empty
        // string is not nullish, so it would defeat the card's own fallback.
        const {list, changes} = await mountList([
            entityRow("calendar.work", "red"),
        ]);

        dispatch(
            shadowAll(list, "ha-color-picker")[0] as Element,
            "value-changed",
            {
                value: "",
            },
        );
        await settle(list);

        expect(changes[0]?.entities).toEqual([{entity: "calendar.work"}]);
    });
});

describe("adding a calendar", (): void => {
    test("appends the chosen calendar", async (): Promise<void> => {
        const {list, changes} = await mountList([entityRow("calendar.work")]);

        dispatch(
            shadowOne(list, "ha-entity-picker") as Element,
            "value-changed",
            {
                value: "calendar.home",
            },
        );
        await settle(list);

        expect(changes[0]?.entities).toEqual([
            {entity: "calendar.work"},
            {entity: "calendar.home"},
        ]);
    });

    test("ignores a calendar that is already in the list", async (): Promise<void> => {
        // Rows are keyed by entity id, so a duplicate makes them reorder
        // unpredictably, and the same events would be fetched twice.
        const {list, changes} = await mountList([entityRow("calendar.work")]);

        dispatch(
            shadowOne(list, "ha-entity-picker") as Element,
            "value-changed",
            {
                value: "calendar.work",
            },
        );
        await settle(list);

        expect(changes).toEqual([]);
    });

    test("ignores an empty selection", async (): Promise<void> => {
        const {list, changes} = await mountList([]);

        dispatch(
            shadowOne(list, "ha-entity-picker") as Element,
            "value-changed",
            {
                value: "",
            },
        );
        await settle(list);

        expect(changes).toEqual([]);
    });

    test("clears the picker whichever way it goes", async (): Promise<void> => {
        // Otherwise it sits there still holding the calendar just chosen.
        const {list} = await mountList([entityRow("calendar.work")]);
        const picker = shadowOne(list, "ha-entity-picker") as unknown as {
            value: string;
        };

        picker.value = "calendar.home";
        dispatch(picker as unknown as Element, "value-changed", {
            value: "calendar.home",
        });
        await settle(list);
        expect(picker.value).toBe("");

        picker.value = "calendar.work";
        dispatch(picker as unknown as Element, "value-changed", {
            value: "calendar.work",
        });
        await settle(list);
        expect(picker.value).toBe("");
    });
});

describe("removing a calendar", (): void => {
    test("removes the row that was clicked and keeps the order", async (): Promise<void> => {
        const {list, changes} = await mountList([
            entityRow("calendar.work"),
            entityRow("calendar.home"),
            entityRow("calendar.sport"),
        ]);

        (shadowAll(list, "ha-icon-button")[1] as HTMLElement).click();
        await settle(list);

        expect(changes[0]?.entities).toEqual([
            {entity: "calendar.work"},
            {entity: "calendar.sport"},
        ]);
    });

    test("ignores a button whose index is out of range", async (): Promise<void> => {
        const {list, changes} = await mountList([entityRow("calendar.work")]);
        const button = shadowAll(list, "ha-icon-button")[0] as HTMLElement;

        (button as unknown as {index: number}).index = 7;
        button.click();
        await settle(list);

        expect(changes).toEqual([]);
    });

    test("ignores a button with no index at all", async (): Promise<void> => {
        const {list, changes} = await mountList([entityRow("calendar.work")]);
        const button = shadowAll(list, "ha-icon-button")[0] as HTMLElement;

        (button as unknown as {index: number | undefined}).index = undefined;
        button.click();
        await settle(list);

        expect(changes).toEqual([]);
    });
});
