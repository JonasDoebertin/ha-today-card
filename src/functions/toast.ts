import {fireEvent} from "./events";

export type ShowToastParams = {
    id?: string;
    message: string;
    action?: ToastActionParams;
    duration?: number;
    dismissable?: boolean;
};

export type ToastActionParams = {
    action: () => void;
    text: string;
};

export function showToast(node: HTMLElement, params: ShowToastParams): void {
    fireEvent(node, "hass-notification", params);
}
