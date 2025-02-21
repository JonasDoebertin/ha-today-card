import styles from "bundle-text:./editor.css";
import {html, LitElement, nothing, unsafeCSS} from "lit";
import {assert} from "superstruct";
import {fireEvent, processEditorEntities} from "../functions/config.js";
import {loadHaComponents} from "../functions/hacks";
import {cardConfigStruct} from "../structs/config";

const FORM_SCHEMA = [
    {
        name: "title",
        selector: {text: {}},
    },
    {
        name: "advance",
        default: 0,
        selector: {number: {mode: "box", step: 1}},
    },
    {
        name: "",
        type: "grid",
        schema: [
            {name: "show_all_day_events", selector: {boolean: {}}},
            {name: "show_past_events", selector: {boolean: {}}},
        ],
    },
    {
        name: "temp_color",
        selector: {
            ui_color: {
                default_color: "none",
                include_state: false,
                include_none: true,
            },
        },
    },
];

export class TodayCardEditor extends LitElement
{

    static styles = unsafeCSS(styles);

    static get properties()
    {
        return {
            hass: {},
            _config: {state: true},
            _entities: {state: true},
        };
    }

    connectedCallback()
    {
        super.connectedCallback();
        loadHaComponents();
    }

    setConfig(config)
    {
        assert(config, cardConfigStruct);

        let entities = processEditorEntities(config.entities, false);
        this._config = {...config, entities: entities};
        this._entities = entities;
    }

    render()
    {
        if (!this.hass || !this._config) {
            return nothing;
        }

        return html`
            <ha-form
                .hass=${this.hass}
                .data=${this._config}
                .schema=${FORM_SCHEMA}
                .computeLabel=${this._computeLabel}
                @value-changed=${this._valueChanged}
            ></ha-form>
            <today-card-entities-editor
                .hass=${this.hass}
                .entities=${this._entities}
                @entities-changed=${this._entitiesChanged}
            ></today-card-entities-editor>
        `;
    }

    _valueChanged(event)
    {
        event.stopPropagation();
        if (!this._config || !this.hass) {
            return;
        }

        let config = event.detail.value;

        fireEvent(this, "config-changed", {config});
    }

    _entitiesChanged(event)
    {
        event.stopPropagation();
        if (!this._config || !this.hass) {
            return;
        }

        let config = {...this._config, entities: event.detail.entities};

        fireEvent(this, "config-changed", {config});
    }

    _computeLabel(schema)
    {
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
