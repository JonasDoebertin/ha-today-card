import {afterEach} from "bun:test";
import {GlobalRegistrator} from "@happy-dom/global-registrator";
import {setHass} from "../../src/globals";

// Pinned before anything imports Day.js, so every machine agrees on what
// midnight means. An explicit TZ from the environment still wins, which is how
// the timezone tests do their work.
process.env.TZ = process.env.TZ || "UTC";

GlobalRegistrator.register();

class HaCardStub extends HTMLElement {}
class HaRippleStub extends HTMLElement {}
class HaFormStub extends HTMLElement {}
class HaExpansionPanelStub extends HTMLElement {}
class HaSvgIconStub extends HTMLElement {}
class HaColorPickerStub extends HTMLElement {}
class HaIconButtonStub extends HTMLElement {}
class HaEntityPickerStub extends HTMLElement {}

/**
 * Home Assistant supplies this one at runtime. The card binds to it while
 * rendering, so without a `bind` method every render throws.
 */
class ActionHandlerStub extends HTMLElement {
    public bound: Element[] = [];

    bind(element: Element): void {
        this.bound.push(element);
    }
}

const stubs: Record<string, CustomElementConstructor> = {
    "ha-card": HaCardStub,
    "ha-ripple": HaRippleStub,
    "ha-form": HaFormStub,
    "ha-expansion-panel": HaExpansionPanelStub,
    "ha-svg-icon": HaSvgIconStub,
    "ha-color-picker": HaColorPickerStub,
    "ha-icon-button": HaIconButtonStub,
    "ha-entity-picker": HaEntityPickerStub,
};

for (const [tag, constructor] of Object.entries(stubs)) {
    if (!customElements.get(tag)) {
        customElements.define(tag, constructor);
    }
}

if (!customElements.get("action-handler")) {
    customElements.define("action-handler", ActionHandlerStub);
}

afterEach((): void => {
    // The hass singleton outlives a test file, so a test that never sets it
    // would otherwise read whatever the previous one left behind.
    setHass(null as never);
    document.body.innerHTML = "";
});
