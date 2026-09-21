import styles from "./card.css";
import {
    CSSResult,
    html,
    LitElement,
    nothing,
    TemplateResult,
    unsafeCSS,
} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {classMap} from "lit/directives/class-map.js";
import {ifDefined} from "lit/directives/if-defined.js";
import {assert} from "superstruct";
import {getEvents} from "../functions/calendar";
import {computeCssColor, getFallBackColor} from "../functions/colors";
import {getEntityName, processEditorEntities} from "../functions/config";
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

export interface EntitySuggestion {
    config: CardConfig;
    label?: string;
}

@customElement("today-card")
export class TodayCard extends LitElement {
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private config: CardConfig = DEFAULT_CONFIG;
    @state() private entities: EntitiesRowConfig[] = [];
    @state() private events: CalendarEvent[] = [];
    @state() private failedEntities: string[] = [];
    private initialized: boolean = false;
    private updateInProgress: boolean = false;
    private refreshInterval: number | undefined;

    static get styles(): CSSResult {
        return unsafeCSS(styles);
    }

    static getConfigElement(): HTMLElement {
        return document.createElement("today-card-editor");
    }

    private static buildConfig(calendarEntities: string[]): CardConfig {
        const entityDefinitions = calendarEntities.map((entity, i) => {
            return {entity, color: getFallBackColor(i)};
        });

        return {
            ...DEFAULT_CONFIG,
            title: localize("config.stub.title"),
            entities: entityDefinitions,
        };
    }

    static getStubConfig(
        _hass: HomeAssistant,
        entities: string[],
        entitiesFallback: string[],
    ): Partial<CardConfig> {
        let calendarEntities = entities.filter((entityId) => {
            return entityId.startsWith("calendar.");
        });

        if (calendarEntities.length < 1) {
            calendarEntities = entitiesFallback.filter((entityId) => {
                return entityId.startsWith("calendar.");
            });
        }

        return TodayCard.buildConfig(calendarEntities);
    }

    /**
     * Offer the card in the picker when someone selects a calendar entity.
     *
     * Home Assistant 2026.6 and later call this for whichever entity the user
     * picked. Returning null keeps the card out of the suggestion list, which
     * matters because every custom card that answers indiscriminately makes the
     * list less useful for everyone.
     *
     * Older versions ignore the property, so this stays safe to ship.
     */
    static getEntitySuggestion(
        _hass: HomeAssistant,
        entityId: string,
    ): EntitySuggestion | null {
        if (!entityId.startsWith("calendar.")) {
            return null;
        }

        return {config: TodayCard.buildConfig([entityId])};
    }

    /**
     * Masonry layout uses this to balance columns, where 1 is roughly 50px.
     * Without it Home Assistant assumes 1 and packs the column badly, since a
     * card showing eight events is nothing like the height of one showing none.
     *
     * The empty-state message occupies a row too, hence the floor of 1.
     */
    getCardSize(): number {
        return (this.config?.title ? 1 : 0) + Math.max(this.events.length, 1);
    }

    getLayoutOptions() {
        return {
            grid_columns: 4,
            grid_min_columns: 2,
            grid_min_rows: 2,
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
        this.refreshInterval = undefined;

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
        if (!this.hass || !this.config || this.updateInProgress) {
            return;
        }

        this.updateInProgress = true;
        try {
            const result = await getEvents(
                this.config,
                this.entities,
                this.hass,
            );
            this.events = result.events;
            this.failedEntities = result.failed;
            this.initialized = true;
        } finally {
            this.updateInProgress = false;
        }
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
                ${actionable ? html`<ha-ripple></ha-ripple>` : nothing}
            </ha-card>
        `;
    }

    renderEvents(): TemplateResult {
        if (!this.initialized) {
            return html`<div class="events">${nothing}</div>`;
        }

        const failed = this.failedEntities.length > 0;

        // "Nothing scheduled" is only true when every calendar answered. If one
        // of them failed, an empty list means we do not know what is on today,
        // so the error takes the place of the reassuring message rather than
        // sitting next to it.
        const rows = [
            ...(failed ? [this.renderError()] : []),
            ...this.events.map((event: CalendarEvent): TemplateResult => {
                return this.renderEvent(event);
            }),
        ];

        if (rows.length === 0) {
            rows.push(this.renderFallback());
        }

        return html`<div class="events">${rows}</div>`;
    }

    renderError(): TemplateResult {
        const names = this.failedEntities.map((entityId: string): string => {
            return getEntityName(this.hass, entityId);
        });

        return html`
            <div class="event is-error">
                <div
                    class="indicator"
                    style="background-color: var(--error-color)"
                ></div>
                <div class="details">
                    <p class="title">
                        <strong>${localize("error.title")}</strong>
                    </p>
                    <p class="schedule">${names.join(", ")}</p>
                </div>
            </div>
        `;
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
