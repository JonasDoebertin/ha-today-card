import {mdiClose} from "@mdi/js";
import styles from "bundle-text:./entity-editor.css";
import {CSSResult, html, LitElement, TemplateResult, unsafeCSS} from "lit";
import {customElement, property, state} from "lit/decorators.js";
import {repeat} from "lit/directives/repeat";
import {fireEvent} from "../functions/config";
import {HomeAssistant} from "custom-card-helpers";
import {EntitiesRowConfig} from "../structs/config";

@customElement('today-card-entities-editor')
export class TodayCardEntitiesEditor extends LitElement {
    @property({attribute: false}) public hass!: HomeAssistant;
    @state() private entities: EntitiesRowConfig[] = [];

    static get styles(): CSSResult {
        return unsafeCSS(styles);
    }

    render(): TemplateResult {
        if (!this.entities || !this.hass) {
            return html``;
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
                                @value-changed=${this.changeColor}
                            ></ha-color-picker>
                            <ha-icon-button
                                .label="Clear"
                                .path=${mdiClose}
                                class="remove-icon"
                                .index=${index}
                                @click=${this.removeRow}
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
                @value-changed=${this.addRow}
            ></ha-entity-picker>
        `;
    }

    private changeColor(event: Event): void {
        // @ts-expect-error
        const index = event.currentTarget.index;
        // @ts-expect-error
        const value = event.detail.value;

        const newEntities = this.entities.concat();
        newEntities[index] = {
            entity: newEntities[index].entity,
            color: value,
        };

        fireEvent(this, "entities-changed", {entities: newEntities});
    }

    private addRow(event: Event): void {
        // @ts-expect-error
        const value = event.detail.value;
        if (value === "") {
            return;
        }

        const newEntities = this.entities.concat({entity: value, color: ""});

        // @ts-expect-error
        event.target.value = "";

        fireEvent(this, "entities-changed", {entities: newEntities});
    }

    private removeRow(event: Event): void {
        // @ts-expect-error
        const index = event.currentTarget.index;

        const newEntities = this.entities.concat();
        newEntities.splice(index, 1);

        fireEvent(this, "entities-changed", {entities: newEntities});
    }
}
