import styles from "bundle-text:./editor.css";
import {CSSResult, html, LitElement, TemplateResult, unsafeCSS} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {assert} from "superstruct";
import {isEqual, processEditorEntities} from "../functions/config";
import {loadHaComponents} from "../functions/hacks";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import {setHass} from "../globals";
import localize from "../localization/localize";
import {fireEvent} from "../functions/events";
import {TIME_FORMATS} from "../const";

const FORM_SCHEMA = [
    {
        name: "",
        type: "grid",
        schema: [
            {
                name: "title",
                selector: {text: {}},
            },
            {
                name: "advance",
                default: 0,
                selector: {number: {mode: "box", step: 1}},
            },
        ],
    },
    {
        name: "",
        type: "grid",
        schema: [
            {
                name: "time_format",
                selector: {
                    select: {
                        mode: "dropdown",
                        options: TIME_FORMATS,
                    },
                },
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

@customElement("today-card-editor")
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

    private valueChanged(event: CustomEvent): void {
        event.stopPropagation();
        if (!this.config || !this.hass) {
            return;
        }

        const newConfig: CardConfig = event.detail.value;

        if (isEqual(newConfig, this.config)) {
            return;
        }

        fireEvent(this, "config-changed", {config: newConfig});
    }

    private entitiesChanged(event: CustomEvent) {
        event.stopPropagation();
        if (!this.config || !this.hass) {
            return;
        }

        let config = {...this.config, entities: event.detail.entities};

        fireEvent(this, "config-changed", {config});
    }

    private computeLabel(schema: Record<string, unknown>): string {
        return localize(`config.label.${schema.name}`);
    }
}
