import styles from "bundle-text:./card.css";
import {CSSResult, html, LitElement, nothing, TemplateResult, unsafeCSS} from 'lit';
import {customElement, property, state} from 'lit/decorators.js';
import {assert} from "superstruct";
import {getEvents} from "../functions/calendar";
import {computeCssColor} from "../functions/colors";
import {processEditorEntities} from "../functions/config";
import localize from "../localization/localize";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import CalendarEvent from "../structs/event";
import {setHass} from "../globals";

@customElement('today-card')
export class TodayCard extends LitElement {
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private config: CardConfig | undefined;
    @state() private entities: EntitiesRowConfig[] = [];
    @state() private content: TemplateResult = html``;
    private initialized: boolean = false;

    static get styles(): CSSResult {
        return unsafeCSS(styles);
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
            title: localize('config.stub.title'),
            advance: 0,
            show_all_day_events: true,
            show_past_events: false,
            entities: calendarEntities,
        };
    }

    setConfig(config: CardConfig) {
        setHass(this.hass);
        assert(config, CardConfig);

        let entities = processEditorEntities(config.entities, true);
        this.config = {...config, entities: entities};
        this.entities = entities;

        this.content = html``;
    }

    async updateEvents() {
        const events = await getEvents(this.config, this.entities, this.hass);

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
    render(): TemplateResult {
        if (!this.hass || !this.config) {
            return html``;
        }

        setHass(this.hass);

        if (!this.initialized) {
            this.updateEvents();
            this.initialized = true;
        }

        return html`
            <ha-card header="${this.config?.title || nothing}">
                <div class="card-content">
                    ${this.content}
                </div>
            </ha-card>
        `;
    }
}
