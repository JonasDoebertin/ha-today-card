import {TodayCard} from "./elements/card";
import "./elements/editor";
import "./elements/entity-editor";
import {VERSION} from "./const";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: "today-card",
    name: "Today",
    description: "Show today's schedule",
    documentationURL: "https://github.com/JonasDoebertin/ha-today-card",
    getEntitySuggestion: TodayCard.getEntitySuggestion,
});

console.info(`%c🗓️ Today Card ${VERSION}`, "font-weight: 700;");
