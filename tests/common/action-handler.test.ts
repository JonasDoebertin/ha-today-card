import {describe, expect, test} from "bun:test";
import {actionHandlerBind} from "../../src/common/action-handler";

interface Binder extends Element {
    bound: Element[];
}

function handlers(): Binder[] {
    return Array.from(document.body.querySelectorAll("action-handler"));
}

describe("binding an element to the handler", (): void => {
    test("routes every element through a single handler", (): void => {
        const first = document.createElement("div");
        const second = document.createElement("div");

        actionHandlerBind(first);
        actionHandlerBind(second);

        expect(handlers()).toHaveLength(1);
        expect(handlers()[0]?.bound).toEqual([first, second]);
    });

    test("attaches a fresh handler once the old one has left the document", (): void => {
        actionHandlerBind(document.createElement("div"));
        document.body.innerHTML = "";

        const element = document.createElement("div");
        actionHandlerBind(element);

        expect(handlers()[0]?.isConnected).toBe(true);
        expect(handlers()[0]?.bound).toEqual([element]);
    });
});
