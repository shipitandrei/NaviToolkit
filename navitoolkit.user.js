// ==UserScript==
// @name         NaviToolkit
// @namespace    navitoolkit
// @version      3.0
// @author       shipitandrei
// @description  Enhance your Kumon Connect experience
// @run-at       document-start
// @grant        none
// @match        https://kumonapp.digital.kumon.com/*
// ==/UserScript==

(function () {
    "use strict";

    if (window.__naviToolkitV3) return;
    window.__naviToolkitV3 = true;

    let patchEnabled = localStorage.getItem("naviToolkitTouchEnabled") !== "false";
    let uiMinimized = localStorage.getItem("naviToolkitMinimized") === "true";
    let explorerOpen = localStorage.getItem("naviToolkitExplorerOpen") === "true";

    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    function isCanvasEvent(evt) {
        if (!evt) return false;

        let el = evt.target;

        while (el && el !== document) {
            if (el.tagName === "CANVAS") return true;
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
                    if (current.tagName === "CANVAS") return true;
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
        const lib = window.InkTool?.InkLib;

        if (!lib || typeof lib.getEventPointerType !== "function") {
            return false;
        }

        if (lib.getEventPointerType.__naviToolkitTouchPatch) {
            return true;
        }

        const original = lib.getEventPointerType;

        function touchAsPen(evt) {
            const type = original.call(this, evt);

            if (patchEnabled && type === "touch" && isCanvasEvent(evt)) {
                return "pen";
            }

            return type;
        }

        touchAsPen.__naviToolkitTouchPatch = true;
        lib.getEventPointerType = touchAsPen;

        console.log("[NaviToolkit] Touch-to-pen patch active");

        return true;
    }

    async function collectWorksheetEntries() {
        const alreadyOpen = !!document.querySelector(".debug-detail");
        const logo = document.querySelector(".logo");
        let hideStyle = null;
        let records = [];

        if (!alreadyOpen && !logo) {
            throw new Error("Kumon logo was not found.");
        }

        try {
            if (!alreadyOpen) {
                hideStyle = document.createElement("style");
                hideStyle.textContent =
                    ".cdk-overlay-container { visibility: hidden !important; }";

                (document.head || document.documentElement).appendChild(hideStyle);

                for (let i = 0; i < 5; i++) {
                    logo.dispatchEvent(new MouseEvent("click", {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    }));

                    await sleep(100);
                }
            }

            for (let i = 0; i < 80; i++) {
                const rows = [
                    ...document.querySelectorAll(
                        ".Info-table tbody.Info-table-body tr.downloadedWorksheet"
                    )
                ];

                records = rows.map(row => {
                    const cells = [...row.querySelectorAll("td")];

                    return {
                        id: cells[0]?.textContent.trim() || "",
                        correctionAttempt: cells[1]?.textContent.trim() || "",
                        subject: cells[2]?.textContent.trim() || "",
                        worksheet: cells[3]?.textContent.trim() || "",
                        downloadStatus: cells[4]?.textContent.trim() || ""
                    };
                }).filter(record => record.id);

                if (records.length >= 5) break;

                await sleep(100);
            }

            if (records.length === 0) {
                throw new Error(
                    "No worksheet records found. Try Refresh again in a moment."
                );
            }

            return records;
        } finally {
            if (!alreadyOpen) {
                const closeButton = document.querySelector(
                    ".debug-detail .closeBtn"
                );

                if (closeButton) {
                    closeButton.click();

                    for (let i = 0; i < 20; i++) {
                        if (!document.querySelector(".debug-detail")) break;
                        await sleep(100);
                    }
                }
            }

            hideStyle?.remove();
        }
    }

    function createUI() {
        if (document.getElementById("navitoolkit-ui")) return;

        const container = document.createElement("div");
        container.id = "navitoolkit-ui";

        Object.assign(container.style, {
            position: "fixed",
            left: "12px",
            bottom: "12px",
            zIndex: "2147483647",
            width: "min(560px, calc(100vw - 24px))",
            maxWidth: "calc(100vw - 24px)",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
            fontSize: "13px",
            color: "#222",
            userSelect: "none",
            WebkitUserSelect: "none"
        });

        const panel = document.createElement("div");

        Object.assign(panel.style, {
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "10px",
            background: "rgba(255, 255, 255, 0.97)",
            border: "1px solid rgba(0, 0, 0, 0.16)",
            borderRadius: "14px",
            boxShadow: "0 3px 16px rgba(0, 0, 0, 0.22)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)"
        });

        const header = document.createElement("div");

        Object.assign(header.style, {
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "7px",
            touchAction: "none",
            cursor: "grab"
        });

        const icon = document.createElement("span");
        icon.textContent = "✍️";
        icon.style.fontSize = "17px";

        const title = document.createElement("span");
        title.textContent = "NaviToolkit v3.0";

        Object.assign(title.style, {
            fontWeight: "700",
            whiteSpace: "nowrap",
            marginRight: "auto"
        });

        function makeButton(text) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = text;

            Object.assign(button.style, {
                border: "1px solid rgba(0, 0, 0, 0.12)",
                borderRadius: "8px",
                padding: "6px 9px",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                color: "#222",
                background: "#f1f1f1",
                touchAction: "manipulation"
            });

            return button;
        }

        const toggle = makeButton("");
        const explorerButton = makeButton("Worksheets");
        const minimize = makeButton("−");

        minimize.style.fontSize = "18px";
        minimize.style.lineHeight = "14px";
        minimize.style.padding = "5px 9px";

        const bubble = makeButton("✍️");
        bubble.title = "Open NaviToolkit";

        Object.assign(bubble.style, {
            display: "none",
            width: "46px",
            height: "46px",
            borderRadius: "50%",
            fontSize: "19px",
            background: "rgba(255, 255, 255, 0.97)",
            boxShadow: "0 3px 14px rgba(0, 0, 0, 0.2)"
        });

        const explorer = document.createElement("div");

        Object.assign(explorer.style, {
            display: explorerOpen ? "flex" : "none",
            flexDirection: "column",
            gap: "8px",
            borderTop: "1px solid #ddd",
            paddingTop: "9px",
            minWidth: "0"
        });

        const explorerHeader = document.createElement("div");

        Object.assign(explorerHeader.style, {
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px"
        });

        const explorerTitle = document.createElement("strong");
        explorerTitle.textContent = "Downloaded worksheets";

        Object.assign(explorerTitle.style, {
            fontSize: "14px",
            marginRight: "auto"
        });

        const refreshButton = makeButton("Refresh");
        const status = document.createElement("div");

        Object.assign(status.style, {
            color: "#555",
            fontSize: "12px",
            overflowWrap: "anywhere"
        });

        status.textContent = "Open the Explorer or tap Refresh to read worksheet data.";

        const tableScroller = document.createElement("div");

        Object.assign(tableScroller.style, {
            overflowX: "auto",
            maxWidth: "100%",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            WebkitOverflowScrolling: "touch"
        });

        const table = document.createElement("table");

        Object.assign(table.style, {
            width: "100%",
            minWidth: "510px",
            borderCollapse: "collapse",
            fontSize: "12px",
            background: "#fff",
            userSelect: "text",
            WebkitUserSelect: "text"
        });

        const thead = document.createElement("thead");
        const headingRow = document.createElement("tr");

        for (const label of [
            "ID",
            "Correction attempt",
            "Subject",
            "Worksheet",
            "Download"
        ]) {
            const th = document.createElement("th");
            th.textContent = label;

            Object.assign(th.style, {
                padding: "8px 7px",
                textAlign: "left",
                background: "#f0f2f5",
                borderBottom: "1px solid #ddd",
                whiteSpace: "nowrap"
            });

            headingRow.appendChild(th);
        }

        thead.appendChild(headingRow);

        const tbody = document.createElement("tbody");
        table.append(thead, tbody);
        tableScroller.appendChild(table);

        function renderRecords(records) {
            tbody.replaceChildren();

            if (!records.length) {
                const row = document.createElement("tr");
                const cell = document.createElement("td");

                cell.colSpan = 5;
                cell.textContent = "No worksheet entries found.";
                cell.style.padding = "12px";
                cell.style.textAlign = "center";

                row.appendChild(cell);
                tbody.appendChild(row);
                return;
            }

            records.forEach((record, index) => {
                const row = document.createElement("tr");

                if (index % 2 === 1) {
                    row.style.background = "#f8f9fb";
                }

                const values = [
                    record.id,
                    record.correctionAttempt,
                    record.subject,
                    record.worksheet,
                    record.downloadStatus
                ];

                values.forEach((value, columnIndex) => {
                    const cell = document.createElement("td");
                    cell.textContent = value;

                    Object.assign(cell.style, {
                        padding: "8px 7px",
                        borderBottom: "1px solid #eee",
                        whiteSpace: columnIndex === 3 ? "normal" : "nowrap"
                    });

                    if (columnIndex === 0) {
                        cell.style.fontFamily = "monospace";
                    }

                    if (columnIndex === 4) {
                        cell.style.fontWeight = "600";

                        if (/complete/i.test(value)) {
                            cell.style.color = "#18753b";
                        } else {
                            cell.style.color = "#8a5a00";
                        }
                    }

                    row.appendChild(cell);
                });

                tbody.appendChild(row);
            });
        }

        let hasLoaded = false;
        let refreshing = false;

        async function refreshWorksheets() {
            if (refreshing) return;

            refreshing = true;
            refreshButton.disabled = true;
            refreshButton.textContent = "Refreshing…";
            status.textContent = "Reading worksheet entries…";

            try {
                const records = await collectWorksheetEntries();

                renderRecords(records);
                status.textContent =
                    `Loaded ${records.length} worksheet entr${records.length === 1 ? "y" : "ies"}.`;

                hasLoaded = true;
                console.log("[NaviToolkit] Worksheet entries:", records);
            } catch (error) {
                status.textContent = error.message || "Unable to read worksheets.";
                console.error("[NaviToolkit] Worksheet refresh failed:", error);
            } finally {
                refreshing = false;
                refreshButton.disabled = false;
                refreshButton.textContent = "Refresh";
            }
        }

        function updateToggle() {
            toggle.textContent = patchEnabled ? "Enabled" : "Disabled";
            toggle.style.background = patchEnabled ? "#dff5e3" : "#eee";
            toggle.style.color = patchEnabled ? "#176b2c" : "#555";
        }

        function updateExplorer() {
            explorer.style.display = explorerOpen ? "flex" : "none";
            explorerButton.style.background = explorerOpen ? "#e5edff" : "#f1f1f1";
            explorerButton.textContent = explorerOpen ? "Hide worksheets" : "Worksheets";
        }

        function updateMinimized() {
            panel.style.display = uiMinimized ? "none" : "flex";
            bubble.style.display = uiMinimized ? "block" : "none";
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
                    localStorage.getItem("naviToolkitPosition")
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
                "naviToolkitPosition",
                JSON.stringify({
                    left: container.offsetLeft,
                    top: container.offsetTop
                })
            );
        }

        header.addEventListener("pointerdown", function (event) {
            if (
                event.target.closest("button") ||
                event.target.closest("input")
            ) {
                return;
            }

            dragging = true;
            moved = false;

            const rect = container.getBoundingClientRect();

            startX = event.clientX;
            startY = event.clientY;
            startLeft = rect.left;
            startTop = rect.top;

            container.setPointerCapture?.(event.pointerId);
        });

        container.addEventListener("pointermove", function (event) {
            if (!dragging) return;

            const dx = event.clientX - startX;
            const dy = event.clientY - startY;

            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                moved = true;
            }

            const maxLeft = Math.max(0, window.innerWidth - container.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - container.offsetHeight);

            container.style.left = Math.max(0, Math.min(maxLeft, startLeft + dx)) + "px";
            container.style.top = Math.max(0, Math.min(maxTop, startTop + dy)) + "px";
            container.style.bottom = "auto";
        });

        function endDrag(event) {
            if (!dragging) return;

            dragging = false;
            container.releasePointerCapture?.(event.pointerId);

            if (moved) savePosition();
        }

        container.addEventListener("pointerup", endDrag);
        container.addEventListener("pointercancel", endDrag);

        toggle.addEventListener("click", function () {
            patchEnabled = !patchEnabled;

            localStorage.setItem(
                "naviToolkitTouchEnabled",
                String(patchEnabled)
            );

            updateToggle();

            console.log(
                "[NaviToolkit] Touch-to-pen " +
                (patchEnabled ? "enabled" : "disabled")
            );
        });

        explorerButton.addEventListener("click", function () {
            explorerOpen = !explorerOpen;

            localStorage.setItem(
                "naviToolkitExplorerOpen",
                String(explorerOpen)
            );

            updateExplorer();

            if (explorerOpen && !hasLoaded) {
                refreshWorksheets();
            }
        });

        refreshButton.addEventListener("click", refreshWorksheets);

        minimize.addEventListener("click", function () {
            uiMinimized = true;
            localStorage.setItem("naviToolkitMinimized", "true");
            updateMinimized();
        });

        bubble.addEventListener("click", function () {
            uiMinimized = false;
            localStorage.setItem("naviToolkitMinimized", "false");
            updateMinimized();
        });

        explorerHeader.append(explorerTitle, refreshButton);
        explorer.append(explorerHeader, status, tableScroller);
        header.append(icon, title, toggle, explorerButton, minimize);
        panel.append(header, explorer);
        container.append(panel, bubble);

        document.documentElement.appendChild(container);

        updateToggle();
        updateExplorer();
        updateMinimized();
        loadPosition();
        renderRecords([]);
    }

    const patchTimer = setInterval(function () {
        if (patch()) clearInterval(patchTimer);
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
