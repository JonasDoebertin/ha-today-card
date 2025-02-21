import {getEvents} from "../functions/calendar.js";
import {processEditorEntities} from "../functions/config.js";
import styles from "bundle-text:./card.css";
import {html, LitElement, unsafeCSS} from 'lit';
import {assert} from "superstruct";
import {computeCssColor} from "../functions/colors";
import localize from "../localization/localize";
import {cardConfigStruct} from "../structs/config";

export class TodayCard extends LitElement
{

    static styles = unsafeCSS(styles);
    _initialized = false;

    static get properties()
    {
        return {
            _config: {state: true},
            _content: {state: true},
        };
    }

    _hass;

    set hass(hass)
    {
        this._hass = hass;
    }

    static getConfigElement()
    {
        return document.createElement("today-card-editor");
    }

    static getStubConfig(hass, entities, entitiesFallback)
    {
        let calendarEntities = entities.filter((entityId) => entityId.startsWith('calendar.'));

        if (calendarEntities.length < 1) {
            calendarEntities = entitiesFallback.filter((entityId) => entityId.startsWith('calendar.'));
        }

        return {
            entities: calendarEntities,
            title: localize(this._hass, 'config.stub.title'),
            advance: 0,
            show_all_day_events: true,
            show_past_events: false,
        };
    }

    setConfig(config)
    {
        assert(config, cardConfigStruct);
        this._config = {...config, entities: processEditorEntities(config.entities, true)};
        this._content = "";
    }

    async updateEvents()
    {
        console.log('Updating events');
        const events = await getEvents(this._config, this._hass);

        let eventsHtml = events.map((event) => {
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

        this._content = html`
            <div class="events">
                ${eventsHtml}
            </div>
        `;
    }

    render()
    {
        console.log('Rendering');
        if (!this._initialized) {
            this.updateEvents();
            this._initialized = true;
        }

        return html`
            <ha-card header="${this._config.title}">
                <div class="card-content">
                    ${this._content}
                </div>
            </ha-card>
        `;
    }
}
