import {version} from "../package.json";
import "./elements/card";
import "./elements/editor";
import "./elements/entity-editor";

(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: "today-card",
    name: "Today",
    description: "Show today's schedule",
});

console.info(
    `%c🗓️ Today Card v${version}`,
    "font-weight: 700;",
);
