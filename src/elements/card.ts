import styles from "./card.css";
import {
    CSSResult,
    html,
    LitElement,
    nothing,
    PropertyValues,
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
import {
    DEFAULT_CONFIG,
    MINIMUM_REFRESH_DELAY,
    REFRESH_INTERVAL,
} from "../const";
import {handleAction} from "../common/handle-action";
import {ActionConfig} from "../structs/action";
import {actionHandler} from "../common/action-handler";

export interface EntitySuggestion {
    config: CardConfig;
    label?: string;
}

@customElement("today-card")
export class TodayCard extends LitElement {
    private currentHass!: HomeAssistant;
    @state() private config: CardConfig = DEFAULT_CONFIG;
    @state() private entities: EntitiesRowConfig[] = [];
    @state() private events: CalendarEvent[] = [];
    @state() private failedEntities: string[] = [];
    private clockMoved: boolean = false;
    private configured: boolean = false;
    private initialized: boolean = false;
    private detached: boolean = false;
    private latestRequest: number = 0;
    private requestInFlight: boolean = false;
    private refreshTimer: number | undefined;

    /**
     * Home Assistant hands over a fresh object on every state change anywhere
     * in the instance, and shouldUpdate drops almost all of those, so the
     * singleton and the first fetch hang off the assignment rather than a
     * render.
     */
    @property({attribute: false})
    public set hass(hass: HomeAssistant) {
        this.currentHass = hass;
        setHass(hass);

        if (!this.initialized && !this.requestInFlight) {
            void this.updateEvents();
        }
    }

    public get hass(): HomeAssistant {
        return this.currentHass;
    }

    static get styles(): CSSResult {
        return unsafeCSS(styles);
    }

    static getConfigElement(): HTMLElement {
        return document.createElement("today-card-editor");
    }

    private static buildConfig(
        calendarEntities: string[],
        hass: HomeAssistant,
    ): CardConfig {
        const entityDefinitions = calendarEntities.map((entity, i) => {
            return {entity, color: getFallBackColor(i)};
        });

        return {
            ...DEFAULT_CONFIG,
            title: localize("config.stub.title", hass.language),
            entities: entityDefinitions,
        };
    }

    static getStubConfig(
        hass: HomeAssistant,
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

        return TodayCard.buildConfig(calendarEntities, hass);
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
        hass: HomeAssistant,
        entityId: string,
    ): EntitySuggestion | null {
        if (!entityId.startsWith("calendar.")) {
            return null;
        }

        return {config: TodayCard.buildConfig([entityId], hass)};
    }

    /**
     * Masonry layout uses this to balance columns, where 1 is roughly 50px.
     * Without it Home Assistant assumes 1 and packs the column badly, since a
     * card showing eight events is nothing like the height of one showing none.
     *
     * The empty-state message occupies a row too, hence the floor of 1.
     */
    getCardSize(): number {
        const rows =
            this.events.length + (this.failedEntities.length > 0 ? 1 : 0);

        return (this.config?.title ? 1 : 0) + Math.max(rows, 1);
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

        if (this.refreshTimer === undefined) {
            this.scheduleRefresh();
        }

        if (this.detached && this.configured) {
            this.clockMoved = true;
            this.requestUpdate();
            void this.updateEvents();
        }

        this.detached = false;
    }

    disconnectedCallback(): void {
        window.clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
        this.detached = true;

        super.disconnectedCallback();
    }

    /**
     * Refresh on the minute, not a minute from now. Whether an event is past,
     * current or still to come turns over at the minute boundary, so a timer
     * running at an arbitrary phase shows the change up to a minute late.
     *
     * The redraw is asked for separately: a calendar that takes its time
     * answering would otherwise hold up the clock as well as the events.
     */
    private scheduleRefresh(): void {
        const untilBoundary =
            REFRESH_INTERVAL - (Date.now() % REFRESH_INTERVAL);

        // A clock that reads a hair short of the boundary, as Firefox does
        // with resistFingerprinting, would otherwise schedule a second
        // refresh milliseconds later.
        const delay =
            untilBoundary < MINIMUM_REFRESH_DELAY
                ? untilBoundary + REFRESH_INTERVAL
                : untilBoundary;

        this.refreshTimer = window.setTimeout((): void => {
            this.scheduleRefresh();
            this.clockMoved = true;
            this.requestUpdate();
            void this.updateEvents();
        }, delay);
    }

    setConfig(config: CardConfig) {
        assert(config, cardConfigStruct);

        const entities = processEditorEntities(config.entities, true).filter(
            (entry, index, all): boolean => {
                return (
                    all.findIndex((other) => other.entity === entry.entity)
                    === index
                );
            },
        );
        this.config = {...DEFAULT_CONFIG, ...config, entities: entities};
        this.entities = entities;
        this.configured = true;

        void this.updateEvents();
    }

    async updateEvents(): Promise<void> {
        if (!this.hass || !this.configured) {
            return;
        }

        const request = ++this.latestRequest;
        this.requestInFlight = true;

        try {
            const result = await getEvents(
                this.config,
                this.entities,
                this.hass,
            );

            if (request === this.latestRequest) {
                this.events = result.events;
                this.failedEntities = result.failed;
                this.initialized = true;
            }
        } catch (error) {
            console.error(error);
        } finally {
            if (request === this.latestRequest) {
                this.requestInFlight = false;
            }
        }
    }

    protected shouldUpdate(changed: PropertyValues): boolean {
        // requestUpdate() leaves nothing behind in changed, so the tick
        // flags the clock move itself.
        if (this.clockMoved) {
            return true;
        }

        // Everything else the card holds is read by the template, so a fresh
        // hass on its own is the only case worth examining.
        if (changed.size > 1 || !changed.has("hass")) {
            return true;
        }

        // Lit clears changed when a render is skipped, so previous is the
        // last hass considered rather than the last one rendered. Comparing
        // for equality survives that; a comparison of degree would not.
        const previous = changed.get("hass") as HomeAssistant | undefined;

        if (!previous || previous.language !== this.hass.language) {
            return true;
        }

        // Only the error row reads a name out of hass, so a rename matters
        // exactly while that row is on screen.
        return this.failedEntities.some((entity: string): boolean => {
            return (
                getEntityName(previous, entity)
                !== getEntityName(this.hass, entity)
            );
        });
    }

    protected updated(): void {
        this.clockMoved = false;
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
