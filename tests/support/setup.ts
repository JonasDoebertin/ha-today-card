import {afterEach} from "bun:test";
import {GlobalRegistrator} from "@happy-dom/global-registrator";
import {setHass} from "../../src/globals";

// Pinned before anything imports Day.js, so every machine agrees on what
// midnight means. An explicit TZ from the environment still wins, which is how
// the timezone tests do their work.
process.env.TZ = process.env.TZ || "UTC";

GlobalRegistrator.register();

/**
 * Home Assistant supplies this one at runtime. The card binds to it while
 * rendering, so without a `bind` method every render throws.
 *
 * The rest of the Home Assistant elements the card and editor render into are
 * deliberately left undefined. An unknown tag is still a perfectly ordinary
 * element to query, set properties on and dispatch events at, and leaving them
 * out keeps the tests from quietly depending on a fake that has drifted from
 * the real component. It also leaves loadHaComponents with something real to
 * do.
 */
class ActionHandlerStub extends HTMLElement {
    public bound: Element[] = [];

    bind(element: Element): void {
        this.bound.push(element);
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
