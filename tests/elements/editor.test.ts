import {describe, expect, test} from "bun:test";
import "../../src/elements/editor";
import {CardConfig} from "../../src/structs/config";
import {cardConfig, fakeHass} from "../support/factories";
import {mount, recordEvents, settle, shadowOne} from "../support/mount";
import localize from "../../src/localization/localize";

interface Configurable extends HTMLElement {
    setConfig(config: CardConfig): void;
}

interface ConfigChanged {
    config: CardConfig;
}

async function mountEditor(
    config: Partial<CardConfig> = {},
): Promise<{editor: Configurable; changes: ConfigChanged[]}> {
    const editor = await mount<Configurable>("today-card-editor", {
        hass: fakeHass(),
    });

    editor.setConfig(cardConfig(config));
    await settle(editor);

    const changes = recordEvents<ConfigChanged>(editor, "config-changed");

    return {editor, changes};
}

/** The data the editor hands to the Home Assistant form. */
function formData(editor: HTMLElement): Record<string, unknown> {
    const form = shadowOne(editor, "ha-form") as unknown as {
        data: Record<string, unknown>;
    };

    return form.data;
}

/** Pretend the user changed something in the form. */
async function changeForm(
    editor: HTMLElement,
    value: Record<string, unknown>,
): Promise<void> {
    const form = shadowOne(editor, "ha-form") as HTMLElement;
    const event = new Event("value-changed", {bubbles: true, composed: true});
    (event as unknown as {detail: unknown}).detail = {value};

    form.dispatchEvent(event);
    await settle(editor);
}

describe("what the editor hands to the form", (): void => {
    test("joins the exclude patterns into one text field", async (): Promise<void> => {
        const {editor} = await mountEditor({exclude: ["standup", "/lunch/i"]});

        expect(formData(editor).exclude).toBe("standup\n/lunch/i");
    });

    test("uses an empty field when nothing is excluded", async (): Promise<void> => {
        const {editor} = await mountEditor({});

        expect(formData(editor).exclude).toBe("");
    });

    test("passes the rest of the configuration through untouched", async (): Promise<void> => {
        const {editor} = await mountEditor({
            title: "Today",
            advance: 2,
            limit: 5,
            time_format: "h:mm A",
        });
        const data = formData(editor);

        expect(data.title).toBe("Today");
        expect(data.advance).toBe(2);
        expect(data.limit).toBe(5);
        expect(data.time_format).toBe("h:mm A");
    });
});

describe("what comes back out of the form", (): void => {
    test("splits the exclude field into patterns", async (): Promise<void> => {
        const {editor, changes} = await mountEditor({});

        await changeForm(editor, {
            ...cardConfig({}),
            exclude: "standup\n/lunch/i",
        });

        expect(changes[0]?.config.exclude).toEqual(["standup", "/lunch/i"]);
    });

    test("drops blank and whitespace-only lines", async (): Promise<void> => {
        // A trailing newline is what a textarea gives you for free, and an
        // empty pattern would match every event.
        const {editor, changes} = await mountEditor({});

        await changeForm(editor, {
            ...cardConfig({}),
            exclude: "standup\n\n   \nlunch\n",
        });

        expect(changes[0]?.config.exclude).toEqual(["standup", "lunch"]);
    });

    test("leaves the key out entirely when the field is empty", async (): Promise<void> => {
        // The form always reports the field, so storing it unconditionally
        // would add an empty array to every card anyone ever opened.
        const {editor, changes} = await mountEditor({});

        await changeForm(editor, {...cardConfig({}), exclude: "   \n  "});

        expect(changes[0]?.config).not.toHaveProperty("exclude");
    });

    test("removes an exclude list the user has cleared", async (): Promise<void> => {
        const {editor, changes} = await mountEditor({exclude: ["standup"]});

        await changeForm(editor, {...cardConfig({}), exclude: ""});

        expect(changes[0]?.config).not.toHaveProperty("exclude");
    });

    test("keeps a pattern's own padding, trimming only to decide it isn't blank", async (): Promise<void> => {
        const {editor, changes} = await mountEditor({});

        await changeForm(editor, {
            ...cardConfig({}),
            exclude: "  padded\n\n   \nlunch\n",
        });

        expect(changes[0]?.config.exclude).toEqual(["  padded", "lunch"]);
    });

    test("accepts an exclude list that is already an array", async (): Promise<void> => {
        const {editor, changes} = await mountEditor({});

        await changeForm(editor, {...cardConfig({}), exclude: ["standup"]});

        expect(changes[0]?.config.exclude).toEqual(["standup"]);
    });

    test("stays quiet when nothing actually changed", async (): Promise<void> => {
        // Home Assistant re-renders the editor on every config-changed, so
        // firing one for an unchanged value loops.
        const {editor, changes} = await mountEditor({title: "Today"});

        await changeForm(editor, {
            ...cardConfig({title: "Today"}),
            entities: [{entity: "calendar.work"}],
        });

        expect(changes).toEqual([]);
    });

    test("reports a real change", async (): Promise<void> => {
        const {editor, changes} = await mountEditor({title: "Today"});

        await changeForm(editor, {
            ...cardConfig({title: "Tomorrow"}),
            entities: [{entity: "calendar.work"}],
        });

        expect(changes).toHaveLength(1);
        expect(changes[0]?.config.title).toBe("Tomorrow");
    });

    test("keeps the form's own event inside the editor", async (): Promise<void> => {
        const {editor} = await mountEditor({});
        const escaped: Event[] = [];

        document.body.addEventListener(
            "value-changed",
            (event: Event): void => {
                escaped.push(event);
            },
        );

        await changeForm(editor, {...cardConfig({}), title: "Today"});

        expect(escaped).toEqual([]);
    });
});

describe("the exclude field's helper text", (): void => {
    const form = async (): Promise<{
        computeHelper: (schema: Record<string, unknown>) => string;
    }> => {
        const {editor} = await mountEditor({});

        return shadowOne(editor, "ha-form") as unknown as {
            computeHelper: (schema: Record<string, unknown>) => string;
        };
    };

    test("localizes the exclude helper", async (): Promise<void> => {
        const {computeHelper} = await form();

        expect(computeHelper({name: "exclude"})).toBe(
            localize("config.helper.exclude"),
        );
    });

    test("has no helper for any other field", async (): Promise<void> => {
        const {computeHelper} = await form();

        expect(computeHelper({name: "title"})).toBeFalsy();
    });
});

describe("the exclude textarea while editing", (): void => {
    test("keeps a blank line the user just typed between patterns", async (): Promise<void> => {
        const {editor} = await mountEditor({});

        await changeForm(editor, {...cardConfig({}), exclude: "foo\n\nb"});

        // Home Assistant hands the resulting config back through setConfig,
        // simulating the round trip a real config-changed causes.
        (editor as unknown as {setConfig(config: CardConfig): void}).setConfig(
            cardConfig({exclude: ["foo", "b"]}),
        );
        await settle(editor);

        expect(formData(editor).exclude).toBe("foo\n\nb");
    });

    test("falls back to the stored patterns once the config changes from outside", async (): Promise<void> => {
        const {editor} = await mountEditor({});

        await changeForm(editor, {...cardConfig({}), exclude: "foo\n\nb"});

        (editor as unknown as {setConfig(config: CardConfig): void}).setConfig(
            cardConfig({exclude: ["other"]}),
        );
        await settle(editor);

        expect(formData(editor).exclude).toBe("other");
    });
});

describe("the entity list", (): void => {
    test("passes a changed entity list on as a configuration change", async (): Promise<void> => {
        const {editor, changes} = await mountEditor({title: "Today"});
        const list = shadowOne(
            editor,
            "today-card-entities-editor",
        ) as HTMLElement;

        const event = new Event("entities-changed", {
            bubbles: true,
            composed: true,
        });
        (event as unknown as {detail: unknown}).detail = {
            entities: [{entity: "calendar.home", color: "red"}],
        };
        list.dispatchEvent(event);
        await settle(editor);

        expect(changes).toHaveLength(1);
        expect(changes[0]?.config.entities).toEqual([
            {entity: "calendar.home", color: "red"},
        ]);
        expect(changes[0]?.config.title).toBe("Today");
    });
});
