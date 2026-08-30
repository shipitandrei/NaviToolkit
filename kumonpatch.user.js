// ==UserScript==
// @name         Kumon Connect Touch Patcher
// @namespace    kumon-touch-patcher
// @version      1.0
// @description  Makes Kumon Connect recognize touch input as stylus input
// @run-at       document-start
// @grant        none
// @match        *://*/*
// ==/UserScript==

(function () {
    "use strict";

    function patch() {
        if (!window.InkTool || !InkTool.InkLib) return false;

        const lib = InkTool.InkLib;

        if (typeof lib.getEventPointerType !== "function") {
            return false;
        }

        // don’t patch twice
        if (lib.getEventPointerType.__touchToPenPatch) {
            return true;
        }

        const original = lib.getEventPointerType;

        function touchAsPen(evt) {
            const type = original.call(this, evt);

            // a toddler could understand this part of the code
            if (type === "touch") {
                return "pen";
            }

            return type;
        }

        touchAsPen.__touchToPenPatch = true;
        lib.getEventPointerType = touchAsPen;

        console.log("[InkTool] touch to pen patch active");
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
