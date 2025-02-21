import {VERSION} from "./const";
import {TodayCard} from "./elements/card";
import {TodayCardEditor} from "./elements/editor";
import {TodayCardEntitiesEditor} from "./elements/entity-editor";

customElements.define('today-card', TodayCard);
customElements.define('today-card-editor', TodayCardEditor);
customElements.define('today-card-entities-editor', TodayCardEntitiesEditor);

window.customCards = window.customCards || [];
window.customCards.push({
    type: "today-card",
    name: "Today",
    description: "Show today's schedule",
});

console.info(
    `%c🗓️ Today Card v${VERSION}`,
    "font-weight: 700;",
);
