export function loadHaComponents (): void {
    if (!customElements.get("ha-entity-picker")) {
        (customElements.get("hui-entities-card") as any)?.getConfigElement();
    }

    if (!customElements.get("ha-form")) {
        (customElements.get("hui-entity-badge") as any)?.getConfigElement();
    }
};
