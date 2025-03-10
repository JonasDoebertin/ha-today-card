import {noChange} from "lit-html";
import {
    AttributePart,
    Directive,
    directive,
    DirectiveParameters,
} from "lit-html/directive";

export interface ActionHandlerDetail {
    action: "hold" | "tap" | "double_tap";
}

export interface ActionHandlerOptions {
    hasHold?: boolean;
    hasDoubleClick?: boolean;
    disabled?: boolean;
}

interface ActionHandler extends HTMLElement {
    holdTime: number;
    bind(element: Element, options?: ActionHandlerOptions): void;
}

interface ActionHandlerElement extends HTMLElement {
    actionHandler?: {
        options: ActionHandlerOptions;
        start?: (event: Event) => void;
        end?: (event: Event) => void;
        handleKeyDown?: (event: KeyboardEvent) => void;
    };
}

declare global {
    interface HASSDomEvents {
        action: ActionHandlerDetail;
    }
}

const getActionHandler = (): ActionHandler => {
    const body = document.body;
    if (body.querySelector("action-handler")) {
        return body.querySelector("action-handler") as ActionHandler;
    }

    const actionHandler = document.createElement("action-handler");
    body.appendChild(actionHandler);

    return actionHandler as ActionHandler;
};

export const actionHandlerBind = (
    element: ActionHandlerElement,
    options?: ActionHandlerOptions,
) => {
    const actionHandler: ActionHandler = getActionHandler();
    if (!actionHandler) {
        return;
    }
    actionHandler.bind(element, options);
};

export const actionHandler = directive(
    class extends Directive {
        update(part: AttributePart, [options]: DirectiveParameters<this>) {
            actionHandlerBind(part.element as ActionHandlerElement, options);
            return noChange;
        }

        render(_options?: ActionHandlerOptions) {}
    },
);
