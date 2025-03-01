import "./elements/card";
import "./elements/editor";
import "./elements/entity-editor";
import {VERSION} from "./const";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: "today-card",
    name: "Today",
    description: "Show today's schedule",
});

console.info(`%c🗓️ Today Card ${VERSION}`, "font-weight: 700;");
