import {mdiClose} from "@mdi/js";
import styles from "bundle-text:./entity-editor.css";
import {html, LitElement, nothing, unsafeCSS} from "lit";
import {repeat} from "lit/directives/repeat";
import {fireEvent} from "../functions/config.js";

export class TodayCardEntitiesEditor extends LitElement
{
    static styles = unsafeCSS(styles);

    static get properties()
    {
        return {
            hass: {state: true},
            entities: {state: true},
        };
    }

    render()
    {
        if (!this.entities || !this.hass) {
            return nothing;
        }

        return html`
            <h3>
                Entities (required)
            </h3>
            <div class="entities">
                ${repeat(
                    this.entities,
                    (entity) => entity.entity,
                    (entity, index) => html`
                        <div class="entity">
                            <div class="details">
                                <span class="name">Name</span>
                                <span class="id">${entity.entity}</span>
                            </div>
                            <ha-color-picker
                                class="color-picker"
                                .hass=${this.hass}
                                .label="Color"
                                .value=${entity.color ?? ""}
                                .includeNone=${true}
                                .includeState=${false}
                                .index=${index}
                                @value-changed=${this._changeColor}
                            ></ha-color-picker>
                            <ha-icon-button
                                .label="Clear"
                                .path=${mdiClose}
                                class="remove-icon"
                                .index=${index}
                                @click=${this._removeRow}
                            ></ha-icon-button>
                        </div>
                        </div>
                    `,
                )}
            </div>
            <ha-entity-picker
                class="add-entity"
                .hass=${this.hass}
                .includeDomains="${['calendar']}"
                @value-changed=${this._addRow}
            ></ha-entity-picker>
        `;
    }

    _changeColor(event)
    {
        const index = event.currentTarget.index;
        const value = event.detail.value;

        const newEntities = this.entities.concat();
        newEntities[index] = {
            entity: newEntities[index].entity,
            color: value,
        };

        fireEvent(this, "entities-changed", {entities: newEntities});
    }

    _addRow(event)
    {
        const value = event.detail.value;
        if (value === "") {
            return;
        }

        const newEntities = this.entities.concat({entity: value});
        event.target.value = "";

        fireEvent(this, "entities-changed", {entities: newEntities});
    }

    _removeRow(event)
    {
        const index = event.currentTarget.index;

        const newEntities = this.entities.concat();
        newEntities.splice(index, 1);

        fireEvent(this, "entities-changed", {entities: newEntities});
    }

}
