import {ActionConfig} from "../structs/action";
import {HomeAssistant} from "custom-card-helpers";
import {fireEvent} from "./events";
import {forwardHaptic} from "./haptic";
import {showToast} from "./toast";

export function hasAction(config?: ActionConfig): boolean {
    return config?.action !== undefined && config.action !== "none";
}

export function handleAction(
    node: HTMLElement,
    hass: HomeAssistant,
    config: ActionConfig,
): void {
    switch (config.action) {
        case "navigate": {
            if (config.navigation_path) {
                navigate(config.navigation_path, config.navigation_replace);
            } else {
                showToast(node, {
                    message: hass.localize(
                        "ui.panel.lovelace.cards.actions.no_navigation_path",
                    ),
                });
                forwardHaptic("failure");
            }
            break;
        }

        case "url": {
            if (config.url_path) {
                window.open(config.url_path);
            } else {
                showToast(node, {
                    message: hass.localize(
                        "ui.panel.lovelace.cards.actions.no_url",
                    ),
                });
                forwardHaptic("failure");
            }
            break;
        }

        case "perform-action":
        case "call-service": {
            if (!config.perform_action && !config.service) {
                showToast(node, {
                    message: hass.localize(
                        "ui.panel.lovelace.cards.actions.no_action",
                    ),
                });
                forwardHaptic("failure");
                return;
            }

            const [domain, service] = (config.perform_action
                || config.service)!.split(".", 2);
            hass.callService(
                domain!,
                service!,
                config.data ?? config.service_data,
                config.target,
            );
            forwardHaptic("light");
            break;
        }

        case "fire-dom-event": {
            fireEvent(node, "ll-custom", config);
        }
    }
}

export function navigate(path: string, replace: Boolean = false): void {
    if (replace) {
        history.replaceState(null, "", path);
    } else {
        history.pushState(null, "", path);
    }
    fireEvent(window, "location-changed", {
        replace,
    });
}
