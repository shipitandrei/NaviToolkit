// ==UserScript==
// @name         Kumon Connect Touch Patcher
// @namespace    kumon-touch-patcher
// @version      2.0
// @description  Makes touch input work as stylus input on the Kumon Connect app
// @run-at       document-start
// @grant        none
// @match        https://kumonapp.digital.kumon.com/*
// ==/UserScript==

(function () {
    "use strict";

    let patchEnabled = localStorage.getItem("kumonTouchPatcherEnabled") !== "false";
    let uiMinimized = localStorage.getItem("kumonTouchPatcherMinimized") === "true";

    function isCanvasEvent(evt) {
        if (!evt) return false;

        let el = evt.target;

        while (el && el !== document) {
            if (el.tagName === "CANVAS") {
                return true;
            }

            el = el.parentElement;
        }

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
        } catch (_) {}

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

        if (lib.getEventPointerType.__touchToPenPatch) {
            return true;
        }

        const original = lib.getEventPointerType;

        function touchAsPen(evt) {
            const type = original.call(this, evt);

            if (
                patchEnabled &&
                type === "touch" &&
                isCanvasEvent(evt)
            ) {
                return "pen";
            }

            return type;
        }

        touchAsPen.__touchToPenPatch = true;
        lib.getEventPointerType = touchAsPen;

        console.log("[InkTool] touch to pen patch active");

        return true;
    }

    function createUI() {
        if (document.getElementById("kumon-touch-patcher-ui")) {
            return;
        }

        const container = document.createElement("div");
        container.id = "kumon-touch-patcher-ui";

        Object.assign(container.style, {
            position: "fixed",
            left: "12px",
            bottom: "12px",
            zIndex: "2147483647",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: "14px",
            color: "#222",
            userSelect: "none",
            WebkitUserSelect: "none",
            touchAction: "none"
        });

        const panel = document.createElement("div");

        Object.assign(panel.style, {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            background: "rgba(255, 255, 255, 0.96)",
            border: "1px solid rgba(0, 0, 0, 0.15)",
            borderRadius: "12px",
            boxShadow: "0 3px 14px rgba(0, 0, 0, 0.2)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)"
        });

        const icon = document.createElement("span");
        icon.textContent = "✍️";

        Object.assign(icon.style, {
            fontSize: "17px",
            lineHeight: "1"
        });

        const title = document.createElement("span");
        title.textContent = "Touch Patcher v2.0";

        Object.assign(title.style, {
            fontWeight: "600",
            whiteSpace: "nowrap"
        });

        const toggle = document.createElement("button");
        toggle.type = "button";

        Object.assign(toggle.style, {
            border: "0",
            borderRadius: "8px",
            padding: "5px 9px",
            fontSize: "13px",
            fontWeight: "600",
            cursor: "pointer",
            background: "#eee",
            color: "#222",
            touchAction: "manipulation"
        });

        const minimize = document.createElement("button");
        minimize.type = "button";
        minimize.textContent = "−";

        Object.assign(minimize.style, {
            border: "0",
            background: "transparent",
            padding: "2px 5px",
            fontSize: "18px",
            lineHeight: "1",
            cursor: "pointer",
            color: "#555",
            touchAction: "manipulation"
        });

        const bubble = document.createElement("button");
        bubble.type = "button";
        bubble.textContent = "✍️";
        bubble.title = "Open Touch Patcher";

        Object.assign(bubble.style, {
            display: "none",
            width: "44px",
            height: "44px",
            border: "1px solid rgba(0, 0, 0, 0.15)",
            borderRadius: "50%",
            background: "rgba(255, 255, 255, 0.96)",
            boxShadow: "0 3px 14px rgba(0, 0, 0, 0.2)",
            fontSize: "19px",
            cursor: "pointer",
            touchAction: "manipulation"
        });

        function updateToggle() {
            toggle.textContent = patchEnabled ? "Enabled" : "Disabled";

            toggle.style.background = patchEnabled
                ? "#dff5e3"
                : "#eee";

            toggle.style.color = patchEnabled
                ? "#176b2c"
                : "#555";
        }

        function updateMinimized() {
            if (uiMinimized) {
                panel.style.display = "none";
                bubble.style.display = "block";
            } else {
                panel.style.display = "flex";
                bubble.style.display = "none";
            }
        }

        let dragging = false;
        let moved = false;
        let startX = 0;
        let startY = 0;
        let startLeft = 0;
        let startTop = 0;

        function loadPosition() {
            try {
                const saved = JSON.parse(
                    localStorage.getItem("kumonTouchPatcherPosition")
                );

                if (
                    saved &&
                    typeof saved.left === "number" &&
                    typeof saved.top === "number"
                ) {
                    container.style.left = saved.left + "px";
                    container.style.top = saved.top + "px";
                    container.style.bottom = "auto";
                }
            } catch (_) {}
        }

        function savePosition() {
            localStorage.setItem(
                "kumonTouchPatcherPosition",
                JSON.stringify({
                    left: container.offsetLeft,
                    top: container.offsetTop
                })
            );
        }

        function startDrag(e) {
            if (e.target.closest("button") || e.target.closest("input")) {
                return;
            }

            dragging = true;
            moved = false;

            const rect = container.getBoundingClientRect();

            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            container.setPointerCapture?.(e.pointerId);
        }

        function drag(e) {
            if (!dragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                moved = true;
            }

            const maxLeft = Math.max(
                0,
                window.innerWidth - container.offsetWidth
            );

            const maxTop = Math.max(
                0,
                window.innerHeight - container.offsetHeight
            );

            const newLeft = Math.max(
                0,
                Math.min(maxLeft, startLeft + dx)
            );

            const newTop = Math.max(
                0,
                Math.min(maxTop, startTop + dy)
            );

            container.style.left = newLeft + "px";
            container.style.top = newTop + "px";
            container.style.bottom = "auto";
        }

        function endDrag(e) {
            if (!dragging) return;

            dragging = false;

            container.releasePointerCapture?.(e.pointerId);

            if (moved) {
                savePosition();
            }
        }

        toggle.addEventListener("click", function () {
            patchEnabled = !patchEnabled;

            localStorage.setItem(
                "kumonTouchPatcherEnabled",
                String(patchEnabled)
            );

            updateToggle();

            console.log(
                "[InkTool] touch to pen patch " +
                (patchEnabled ? "enabled" : "disabled")
            );
        });

        minimize.addEventListener("click", function () {
            uiMinimized = true;

            localStorage.setItem(
                "kumonTouchPatcherMinimized",
                "true"
            );

            updateMinimized();
        });

        bubble.addEventListener("click", function () {
            uiMinimized = false;

            localStorage.setItem(
                "kumonTouchPatcherMinimized",
                "false"
            );

            updateMinimized();
        });

        container.addEventListener("pointerdown", startDrag);
        container.addEventListener("pointermove", drag);
        container.addEventListener("pointerup", endDrag);
        container.addEventListener("pointercancel", endDrag);

        panel.appendChild(icon);
        panel.appendChild(title);
        panel.appendChild(toggle);
        panel.appendChild(minimize);

        container.appendChild(panel);
        container.appendChild(bubble);

        document.documentElement.appendChild(container);

        updateToggle();
        updateMinimized();
        loadPosition();
    }

    const timer = setInterval(function () {
        if (patch()) {
            clearInterval(timer);
        }
    }, 25);

    patch();

    if (document.documentElement) {
        createUI();
    } else {
        const uiTimer = setInterval(function () {
            if (document.documentElement) {
                clearInterval(uiTimer);
                createUI();
            }
        }, 25);
    }
})();
