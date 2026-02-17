import styles from "./editor.css";
import {CSSResult, html, LitElement, TemplateResult, unsafeCSS} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {assert} from "superstruct";
import {isEqual, processEditorEntities} from "../functions/config";
import {loadHaComponents} from "../functions/hacks";
import {
    CardConfig,
    cardConfigStruct,
    EntitiesRowConfig,
} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import {setHass} from "../globals";
import localize from "../localization/localize";
import {fireEvent} from "../common/fire-event";
import {TIME_FORMATS} from "../const";
import {UiAction} from "../structs/action";
import {mdiGestureTap, mdiListBox, mdiTextShort} from "../functions/icons";

const supportedActions: UiAction[] = [
    "navigate",
    "url",
    "perform-action",
    "none",
];

const FORM_SCHEMA = [
    {
        name: "content",
        type: "expandable",
        flatten: true,
        iconPath: mdiTextShort,
        schema: [
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
        ],
    },
    {
        name: "interactions",
        type: "expandable",
        flatten: true,
        iconPath: mdiGestureTap,
        schema: [
            {
                name: "tap_action",
                selector: {
                    ui_action: {
                        default_action: "none",
                        actions: supportedActions,
                    },
                },
            },
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
        assert(config, cardConfigStruct);

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
            <ha-expansion-panel outlined>
                <div slot="header" role="heading" aria-level="3">
                    <ha-svg-icon .path=${mdiListBox}></ha-svg-icon>
                    ${localize("config.label.entities")}
                </div>
                <div class="content">
                    <today-card-entities-editor
                        .hass=${this.hass}
                        .entities=${this.entities}
                        @entities-changed=${this.entitiesChanged}
                    ></today-card-entities-editor>
                </div>
            </ha-expansion-panel>
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
