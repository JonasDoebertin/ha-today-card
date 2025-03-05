import styles from "bundle-text:./card.css";
import {
    CSSResult,
    html,
    LitElement,
    nothing,
    TemplateResult,
    unsafeCSS,
} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {assert} from "superstruct";
import {getEvents} from "../functions/calendar";
import {computeCssColor} from "../functions/colors";
import {processEditorEntities} from "../functions/config";
import localize from "../localization/localize";
import {CardConfig, EntitiesRowConfig} from "../structs/config";
import {HomeAssistant} from "custom-card-helpers";
import CalendarEvent from "../structs/event";
import {setHass} from "../globals";
import {DEFAULT_CONFIG, REFRESH_INTERVAL} from "../const";

@customElement("today-card")
export class TodayCard extends LitElement {
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private config: CardConfig = DEFAULT_CONFIG;
    @state() private entities: EntitiesRowConfig[] = [];
    @state() private events: CalendarEvent[] = [];
    private initialized: boolean = false;
    private refreshInterval: number | undefined;

    static get styles(): CSSResult {
        return unsafeCSS(styles);
    }

    static getConfigElement(): HTMLElement {
        return document.createElement("today-card-editor");
    }

    static getStubConfig(
        hass: HomeAssistant,
        entities: string[],
        entitiesFallback: string[],
    ): Partial<CardConfig> {
        let calendarEntities = entities.filter((entityId) => {
            entityId.startsWith("calendar.");
        });

        if (calendarEntities.length < 1) {
            calendarEntities = entitiesFallback.filter((entityId) => {
                entityId.startsWith("calendar.");
            });
        }

        return {
            ...DEFAULT_CONFIG,
            title: localize("config.stub.title"),
            entities: calendarEntities,
        };
    }

    connectedCallback(): void {
        super.connectedCallback();

        if (this.refreshInterval === undefined) {
            this.refreshInterval = window.setInterval((): void => {
                this.updateEvents();
            }, REFRESH_INTERVAL);
        }
    }

    disconnectedCallback(): void {
        window.clearInterval(this.refreshInterval);

        super.disconnectedCallback();
    }

    setConfig(config: CardConfig) {
        setHass(this.hass);
        assert(config, CardConfig);

        let entities = processEditorEntities(config.entities, true);
        this.config = {...DEFAULT_CONFIG, ...config, entities: entities};
        this.entities = entities;

        this.updateEvents();
    }

    async updateEvents(): Promise<void> {
        if (!this.hass || !this.config) {
            return;
        }

        this.events = await getEvents(this.config, this.entities, this.hass);
        this.initialized = true;
    }

    render(): TemplateResult {
        if (!this.hass || !this.config) {
            return html``;
        }

        setHass(this.hass);

        if (!this.initialized) {
            this.updateEvents();
        }

        return html`
            <ha-card header="${this.config?.title || nothing}">
                <div class="card-content">${this.renderEvents()}</div>
            </ha-card>
        `;
    }

    renderEvents(): TemplateResult {
        let eventsHtml;

        if (!this.initialized) {
            eventsHtml = nothing;
        } else if (this.events.length === 0) {
            eventsHtml = html`
                <div class="events">${this.renderFallback()}</div>
            `;
        } else {
            eventsHtml = this.events.map(
                (event: CalendarEvent): TemplateResult => {
                    return this.renderEvent(event);
                },
            );
        }

        return html`<div class="events">${eventsHtml}</div>`;
    }

    renderFallback(): TemplateResult {
        return html`
            <div class="event">
                <div
                    class="indicator"
                    style="background-color: ${computeCssColor(
                        this.config.fallback_color,
                    )}"
                ></div>
                <div class="details">
                    <p class="title">
                        <strong>${localize("noEvents.title")}</strong>
                    </p>
                    <p class="schedule">${localize("noEvents.subtitle")}</p>
                </div>
            </div>
        `;
    }

    renderEvent(event: CalendarEvent): TemplateResult {
        return html`
            <div class="event">
                <div
                    class="indicator"
                    style="background-color: ${computeCssColor(event.color)}"
                ></div>
                <div class="details">
                    <p class="title">
                        <strong>${event.title}</strong>
                        ${event.daySchedule
                            ? html`<span>${event.daySchedule}</span>`
                            : nothing}
                    </p>
                    ${event.timeSchedule
                        ? html`<p class="schedule">${event.timeSchedule}</p>`
                        : nothing}
                </div>
            </div>
        `;
    }
}
