export function loadHaComponents () {
    if (!customElements.get("ha-entity-picker")) {
        customElements.get("hui-entities-card")?.getConfigElement();
    }

    if (!customElements.get("ha-form")) {
        customElements.get("hui-entity-badge")?.getConfigElement();
    }

};
