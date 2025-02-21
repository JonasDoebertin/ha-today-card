import {HomeAssistant} from "custom-card-helpers";

const globals = {
    hass: null as HomeAssistant | null,
};

export function setHass(hass: HomeAssistant) {
    globals.hass = hass;
}

export function getHass(): HomeAssistant | null {
    return globals.hass;
}
