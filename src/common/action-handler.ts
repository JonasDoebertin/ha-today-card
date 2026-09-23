import {noChange} from "lit-html";
import {
    AttributePart,
    Directive,
    directive,
    DirectiveParameters,
} from "lit-html/directive.js";

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

let handler: ActionHandler | undefined;

const getActionHandler = (): ActionHandler => {
    // Cached because the directive runs on every render. The check keeps a
    // handler that has left the document from being handed out again.
    if (handler?.isConnected) {
        return handler;
    }

    const body = document.body;
    handler = (body.querySelector("action-handler")
        ?? body.appendChild(
            document.createElement("action-handler"),
        )) as ActionHandler;

    return handler;
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
