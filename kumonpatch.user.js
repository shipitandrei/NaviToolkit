// ==UserScript==
// @name         Kumon Connect Touch Patcher
// @namespace    kumon-touch-patcher
// @version      1.1
// @description  Makes touch input work as stylus input on the Kumon Connect app
// @run-at       document-start
// @grant        none
// @match        *://*/*
// ==/UserScript==

(function () {
    "use strict";

    function isCanvasEvent(evt) {
        if (!evt) return false;

        // check the event target and its parents
        let el = evt.target;

        while (el && el !== document) {
            if (el.tagName === "CANVAS") {
                return true;
            }

            el = el.parentElement;
        }

        // check what is actually underneath the pointer
        const x = evt.clientX ?? evt.pageX;
        const y = evt.clientY ?? evt.pageY;

        if (
            typeof x === "number" &&
            typeof y === "number" &&
            document.elementsFromPoint
        ) {
            for (const element of document.elementsFromPoint(x, y)) {
                let current = element;

                while (current && current !== document) {
                    if (current.tagName === "CANVAS") {
                        return true;
                    }

                    current = current.parentElement;
                }
            }
        }

        // try InkTool's own canvas registry as a fallback
        try {
            const list = window.InkTool?.InkCanvasLib?.List;

            if (list && evt.target) {
                for (const key in list) {
                    const canvas = list[key];

                    if (
                        canvas &&
                        typeof canvas.isCanvasId === "function" &&
                        evt.target.id &&
                        canvas.isCanvasId(evt.target.id)
                    ) {
                        return true;
                    }
                }
            }
        } catch (_) {
            // if InkTool's internals aren't available, leave it alone
        }

        return false;
    }

    function patch() {
        if (!window.InkTool || !InkTool.InkLib) {
            return false;
        }

        const lib = InkTool.InkLib;

        if (typeof lib.getEventPointerType !== "function") {
            return false;
        }

        // don't patch twice
        if (lib.getEventPointerType.__touchToPenPatch) {
            return true;
        }

        const original = lib.getEventPointerType;

        function touchAsPen(evt) {
            const type = original.call(this, evt);

            // toddler can understand this part of the code
            // buttons and the rest of the UI keep normal touch input
            if (type === "touch" && isCanvasEvent(evt)) {
                return "pen";
            }

            return type;
        }

        touchAsPen.__touchToPenPatch = true;
        lib.getEventPointerType = touchAsPen;

        console.log("[InkTool] canvas-only touch to pen patch active");

        return true;
    }

    // we go first
    const timer = setInterval(function () {
        if (patch()) {
            clearInterval(timer);
        }
    }, 25);

    // try immediately 
    patch();
})();
