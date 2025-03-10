import {noChange} from "lit-html";
import {Ripple} from "@material/mwc-ripple";
import {
    AttributePart,
    Directive,
    directive,
    DirectiveParameters,
} from "lit-html/directive";
import {isTouch} from "./is-touch";
import {fireEvent} from "./fire-event";
import {deepEqual} from "./deep-equal";

export interface ActionHandlerDetail {
    action: "hold" | "tap" | "double_tap";
}

export interface ActionHandlerOptions {
    hasHold?: boolean;
    hasDoubleClick?: boolean;
    disabled?: boolean;
    repeat?: number;
    repeatLimit?: number;
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
    interface HTMLElementTagNameMap {
        "action-handler": ActionHandler;
    }
    interface HASSDomEvents {
        action: ActionHandlerDetail;
    }
}

class ActionHandler extends HTMLElement implements ActionHandler {
    public holdTime = 500;

    public ripple: Ripple;

    protected timer?: number;

    protected held = false;

    private cancelled = false;

    private dblClickTimeout?: number;

    constructor() {
        super();
        this.ripple = document.createElement("ha-ripple"); // TODO: Ripple doesn't work!
    }

    public connectedCallback() {
        Object.assign(this.style, {
            position: "fixed",
            width: isTouch ? "100px" : "50px",
            height: isTouch ? "100px" : "50px",
            transform: "translate(-50%, -50%) scale(0)",
            pointerEvents: "none",
            zIndex: "999",
            background: "var(--primary-color)",
            display: null,
            opacity: "0.2",
            borderRadius: "50%",
            transition: "transform 180ms ease-in-out",
        });

        this.appendChild(this.ripple);
        this.ripple.primary = true;

        [
            "touchcancel",
            "mouseout",
            "mouseup",
            "touchmove",
            "mousewheel",
            "wheel",
            "scroll",
        ].forEach((ev) => {
            document.addEventListener(
                ev,
                () => {
                    this.cancelled = true;
                    if (this.timer) {
                        this.stopAnimation();
                        clearTimeout(this.timer);
                        this.timer = undefined;
                    }
                },
                {passive: true},
            );
        });
    }

    public bind(
        element: ActionHandlerElement,
        options: ActionHandlerOptions = {},
    ) {
        if (
            element.actionHandler
            && deepEqual(options, element.actionHandler.options)
        ) {
            return;
        }

        if (element.actionHandler) {
            element.removeEventListener(
                "touchstart",
                element.actionHandler.start!,
            );
            element.removeEventListener("touchend", element.actionHandler.end!);
            element.removeEventListener(
                "touchcancel",
                element.actionHandler.end!,
            );

            element.removeEventListener(
                "mousedown",
                element.actionHandler.start!,
            );
            element.removeEventListener("click", element.actionHandler.end!);

            element.removeEventListener(
                "keydown",
                element.actionHandler.handleKeyDown!,
            );
        } else {
            element.addEventListener("contextmenu", (ev: Event) => {
                const e = ev || window.event;
                if (e.preventDefault) {
                    e.preventDefault();
                }
                if (e.stopPropagation) {
                    e.stopPropagation();
                }
                e.cancelBubble = true;
                e.returnValue = false;
                return false;
            });
        }

        element.actionHandler = {options};

        if (options.disabled) {
            return;
        }

        element.actionHandler.start = (event: Event) => {
            this.cancelled = false;
            let x;
            let y;
            if ((event as TouchEvent).touches) {
                x = (event as TouchEvent).touches[0]!.clientX;
                y = (event as TouchEvent).touches[0]!.clientY;
            } else {
                x = (event as MouseEvent).clientX;
                y = (event as MouseEvent).clientY;
            }

            if (options.hasHold) {
                this.held = false;
                this.timer = window.setTimeout(() => {
                    this.startAnimation(x, y);
                    this.held = true;
                }, this.holdTime);
            }
        };

        element.actionHandler.end = (event: Event) => {
            // Don't respond when moved or scrolled while touch
            if (
                ["touchend", "touchcancel"].includes(event.type)
                && this.cancelled
            ) {
                return;
            }
            const target = event.target as HTMLElement;
            // Prevent mouse event if touch event
            if (event.cancelable) {
                event.preventDefault();
            }
            if (options.hasHold) {
                clearTimeout(this.timer);
                this.stopAnimation();
                this.timer = undefined;
            }
            if (options.hasHold && this.held) {
                fireEvent(target, "action", {action: "hold"});
            } else if (options.hasDoubleClick) {
                if (
                    (event.type === "click" && (event as MouseEvent).detail < 2)
                    || !this.dblClickTimeout
                ) {
                    this.dblClickTimeout = window.setTimeout(() => {
                        this.dblClickTimeout = undefined;
                        fireEvent(target, "action", {action: "tap"});
                    }, 250);
                } else {
                    clearTimeout(this.dblClickTimeout);
                    this.dblClickTimeout = undefined;
                    fireEvent(target, "action", {action: "double_tap"});
                }
            } else {
                fireEvent(target, "action", {action: "tap"});
            }
        };

        element.actionHandler.handleKeyDown = (event: KeyboardEvent) => {
            if (!["Enter", " "].includes(event.key)) {
                return;
            }
            (event.currentTarget as ActionHandlerElement).actionHandler!.end!(
                event,
            );
        };

        element.addEventListener("touchstart", element.actionHandler.start, {
            passive: true,
        });
        element.addEventListener("touchend", element.actionHandler.end);
        element.addEventListener("touchcancel", element.actionHandler.end);

        element.addEventListener("mousedown", element.actionHandler.start, {
            passive: true,
        });
        element.addEventListener("click", element.actionHandler.end);

        element.addEventListener(
            "keydown",
            element.actionHandler.handleKeyDown,
        );
    }

    private startAnimation(x: number, y: number): void {
        Object.assign(this.style, {
            left: `${x}px`,
            top: `${y}px`,
            display: null,
        });
        this.ripple.disabled = false;
        this.ripple.startPress();
        this.ripple.unbounded = true;
    }

    private stopAnimation(): void {
        this.ripple.endPress();
        this.ripple.disabled = true;
        this.style.display = "none";
    }
}

customElements.define("today-card-action-handler", ActionHandler);

const getActionHandler = (): ActionHandler => {
    const body = document.body;
    if (body.querySelector("today-card-action-handler")) {
        return body.querySelector("today-card-action-handler") as ActionHandler;
    }

    const actionHandler = document.createElement("today-card-action-handler");
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
