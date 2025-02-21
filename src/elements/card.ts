import styles from "bundle-text:./card.css";
import {CSSResult, html, LitElement, nothing, TemplateResult, unsafeCSS} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {assert} from "superstruct";
import {getEvents} from "../functions/calendar.js";
import {computeCssColor} from "../functions/colors";
import {processEditorEntities} from "../functions/config.js";
import localize from "../localization/localize";
import {CardConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import CalendarEvent from "../structs/event";

@customElement('today-card')
export class TodayCard extends LitElement {
    // @property({ attribute: false }) public hass!: HomeAssistant;
    @state() private config: CardConfig;
    @state() private content: TemplateResult;
    private initialized: boolean = false;
    private _hass?: HomeAssistant;

    set hass(hass: HomeAssistant) {
        this._hass = hass;
    }

    static getConfigElement(): HTMLElement {
        return document.createElement("today-card-editor");
    }

    static getStubConfig(
        hass: HomeAssistant,
        entities: string[],
        entitiesFallback: string[]
    ): Partial<CardConfig> {
        let calendarEntities = entities.filter((entityId) => entityId.startsWith('calendar.'));

        if (calendarEntities.length < 1) {
            calendarEntities = entitiesFallback.filter((entityId) => entityId.startsWith('calendar.'));
        }

        return {
            type: "custom:today-card",
            title: localize(hass, 'config.stub.title'),
            advance: 0,
            show_all_day_events: true,
            show_past_events: false,
            entities: calendarEntities,
        };
    }

    setConfig(config: CardConfig) {
        assert(config, CardConfig);
        this.config = {...config, entities: processEditorEntities(config.entities, true)};
        this.content = html``;
    }

    async updateEvents() {
        console.log('Updating events');
        const events = await getEvents(this.config, this._hass);

        let eventsHtml = events.map((event: CalendarEvent) => {
            return html`
                <div class="event">
                    <div class="indicator" style="background-color: ${computeCssColor(event.color)}"></div>
                    <div class="details">
                        <p class="title">${event.title}</p>
                        <p class="schedule">${event.schedule}</p>
                    </div>
                </div>
            `;
        });

        this.content = html`
            <div class="events">
                ${eventsHtml}
            </div>
        `;
    }

    render() {
        console.log('Rendering');
        if (!this.initialized) {
            this.updateEvents();
            this.initialized = true;
        }

        return html`
            <ha-card header="${this.config.title}">
                <div class="card-content">
                    ${this.content}
                </div>
            </ha-card>
        `;
    }

    static get styles(): CSSResult {
        return unsafeCSS(styles);
    }
}
