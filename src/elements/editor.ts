import styles from "bundle-text:./editor.css";
import {CSSResult, html, LitElement, TemplateResult, unsafeCSS} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {assert} from "superstruct";
import {fireEvent, processEditorEntities} from "../functions/config";
import {loadHaComponents} from "../functions/hacks";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import {setHass} from "../globals";

const FORM_SCHEMA = [
    {
        name: "title",
        selector: {text: {}},
    },
    {
        name: "",
        type: "grid",
        schema: [
            {
                name: "advance",
                default: 0,
                selector: {number: {mode: "box", step: 1}},
            },
            {
                name: "fallback_color",
                selector: {
                    ui_color: {
                        default_color: "primary",
                        include_state: false,
                        include_none: true,
                    },
                },
            },
        ],
    },
    {
        name: "",
        type: "grid",
        schema: [
            {name: "show_all_day_events", selector: {boolean: {}}},
            {name: "show_past_events", selector: {boolean: {}}},
        ],
    },

];

@customElement('today-card-editor')
export class TodayCardEditor extends LitElement {
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private config: CardConfig | undefined;
    @state() private entities: EntitiesRowConfig[] = [];

    static get styles(): CSSResult {
        return unsafeCSS(styles);
    }

    connectedCallback(): void {
        super.connectedCallback();
        loadHaComponents();
    }

    setConfig(config: CardConfig): void {
        setHass(this.hass);
        assert(config, CardConfig);

        let entities = processEditorEntities(config.entities, false);
        this.config = {...config, entities: entities};
        this.entities = entities;
    }

    render(): TemplateResult {
        if (!this.hass || !this.config) {
            return html``;
        }

        setHass(this.hass);

        return html`
            <ha-form
                .hass=${this.hass}
                .data=${this.config}
                .schema=${FORM_SCHEMA}
                .computeLabel=${this.computeLabel}
                @value-changed=${this.valueChanged}
            ></ha-form>
            <today-card-entities-editor
                .hass=${this.hass}
                .entities=${this.entities}
                @entities-changed=${this.entitiesChanged}
            ></today-card-entities-editor>
        `;
    }

    private valueChanged(event: Event): void {
        event.stopPropagation();
        if (!this.config || !this.hass) {
            return;
        }

        // @ts-ignore
        let config = event.detail.value;

        fireEvent(this, "config-changed", {config});
    }

    private entitiesChanged(event: Event) {
        event.stopPropagation();
        if (!this.config || !this.hass) {
            return;
        }

        // @ts-ignore
        let config = {...this.config, entities: event.detail.entities};

        fireEvent(this, "config-changed", {config});
    }

    private computeLabel(schema: Record<string, unknown>): string {
        switch (schema.name) {
            case "title":
                return "Title";
            case "advance":
                return "Advance (optional)";
            case "show_all_day_events":
                return "Show all day events";
            case "show_past_events":
                return "Show past events";
            case "temp_color":
                return "Fallback color";
            default:
                return "";
        }
    };
}
