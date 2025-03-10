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
import {classMap} from "lit/directives/class-map";
import {ifDefined} from "lit/directives/if-defined";
import {assert} from "superstruct";
import {getEvents} from "../functions/calendar";
import {computeCssColor} from "../functions/colors";
import {processEditorEntities} from "../functions/config";
import localize from "../localization/localize";
import {
    CardConfig,
    cardConfigStruct,
    EntitiesRowConfig,
} from "../structs/config";
import {ActionHandlerEvent, HomeAssistant} from "custom-card-helpers";
import CalendarEvent from "../structs/event";
import {setHass} from "../globals";
import {DEFAULT_CONFIG, REFRESH_INTERVAL} from "../const";
import {handleAction} from "../common/handle-action";
import {ActionConfig} from "../structs/action";
import {actionHandler} from "../common/action-handler";

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
        _hass: HomeAssistant,
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
        assert(config, cardConfigStruct);

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

    private hasAction(config?: ActionConfig): boolean {
        return config?.action !== undefined && config.action !== "none";
    }

    private handleTapAction(event: ActionHandlerEvent): void {
        const config = {
            tap_action: this.config!.tap_action,
        };
        handleAction(this, this.hass!, config, event.detail.action!);
    }

    render(): TemplateResult {
        if (!this.hass || !this.config) {
            return html``;
        }

        setHass(this.hass);

        if (!this.initialized) {
            this.updateEvents();
        }

        const actionable = this.hasAction(this.config.tap_action);

        return html`
            <ha-card
                header="${this.config?.title || nothing}"
                class="has-advance-of-${this.config?.advance || 0}"
                role=${ifDefined(actionable ? "button" : undefined)}
                tabindex=${ifDefined(actionable ? "0" : undefined)}
                @action=${this.handleTapAction}
                .actionHandler=${actionHandler()}
            >
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
            <div class="event is-fallback">
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
        const classes = {
            "is-all-day": event.isAllDay,
            "is-multi-day": event.isMultiDay,
            "is-first-day": event.isFirstDay,
            "is-last-day": event.isLastDay,
            "is-in-past": event.isInPast,
            "is-in-future": event.isInFuture,
            "is-current": event.isCurrent,
        };

        return html`
            <div class="event ${classMap(classes)}">
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
