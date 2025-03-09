import {fireEvent} from "./events";

export type HapticType =
    | "success"
    | "warning"
    | "failure"
    | "light"
    | "medium"
    | "heavy"
    | "selection";

export function forwardHaptic(hapticType: HapticType): void {
    fireEvent(window, "haptic", hapticType);
}
