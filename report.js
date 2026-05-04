/**
 * report.js — Stack Calculator Transaction Report
 * ------------------------------------------------
 * Reads localStorage:
 *   stack_calculator_cache_v1  → raw Firebase transactions
 *   report_filters             → { commodity, stacks[], isInward, isOutward }
 *
 * Special Rule:
 *   countVan === "Made-up"  →  ALWAYS treated as INWARD
 */

(function () {
    "use strict";

    const CACHE_KEY  = "stack_calculator_cache_v1";
    const FILTER_KEY = "report_filters";

    // ─── Helpers ───────────────────────────────────────────────────────────────

    function effectiveType(tx) {
        return tx.countVan === "Made-up" ? "inward" : tx.transactionType;
    }

    function formatDate(dateStr) {
        if (!dateStr) return "—";
        try {
            const [y, m, d] = dateStr.split("-");
            const months = ["Jan","Feb","Mar","Apr","May","Jun",
                            "Jul","Aug","Sep","Oct","Nov","Dec"];
            return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
        } catch (_) { return dateStr; }
    }

    function todayStr() {
        return new Date().toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        });
    }

    // ─── Load Data ─────────────────────────────────────────────────────────────

    function loadData() {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        try {
            const obj = JSON.parse(raw);
            return Array.isArray(obj) ? obj : Object.values(obj);
        } catch (_) { return null; }
    }

    function loadFilters() {
        const raw = localStorage.getItem(FILTER_KEY);
        if (!raw) return { commodity: "All", stacks: [], isInward: false, isOutward: false };
        try { return JSON.parse(raw); }
        catch (_) { return { commodity: "All", stacks: [], isInward: false, isOutward: false }; }
    }

    // ─── Filter ────────────────────────────────────────────────────────────────

    function applyFilters(transactions, filters) {
        const { commodity, stacks, isInward, isOutward } = filters;
        return transactions.filter(tx => {
            const type = effectiveType(tx);

            // 1. Mode
            if (isInward  && type !== "inward")  return false;
            if (isOutward && type !== "outward") return false;

            // 2. Commodity
            if (commodity !== "All" && tx.commodity !== commodity) return false;

            // 3. Stacks (empty = all)
            if (stacks.length > 0 && !stacks.includes(String(tx.stackNumber))) return false;

            return true;
        });
    }

    // ─── Pills ─────────────────────────────────────────────────────────────────

    function buildPills(filters) {
        const { commodity, stacks, isInward, isOutward } = filters;
        let html = "";

        if (isInward) {
            html += `<span class="filter-pill pill-mode-in">↘ Inward Only</span>`;
        } else if (isOutward) {
            html += `<span class="filter-pill pill-mode-out">↗ Outward Only</span>`;
        } else {
            html += `<span class="filter-pill pill-mode-all">○ All (Net)</span>`;
        }

        html += `<span class="filter-pill pill-commodity">📦 ${commodity === "All" ? "All Commodities" : commodity}</span>`;

        if (stacks.length > 0) {
            const label = stacks.length <= 4
                ? `Stacks: ${stacks.join(", ")}`
                : `${stacks.length} Stacks Selected`;
            html += `<span class="filter-pill pill-stacks">🗂 ${label}</span>`;
        } else {
            html += `<span class="filter-pill pill-all-stacks">🗂 All Stacks</span>`;
        }

        return html;
    }

    // ─── Commodity Badge ───────────────────────────────────────────────────────

    function commodityBadge(name) {
        const lower = (name || "").toLowerCase();
        const cls   = lower === "wheat" ? "badge-wheat"
                    : lower === "maize" ? "badge-maize"
                    : "badge-other";
        return `<span class="commodity-badge ${cls}">${name || "—"}</span>`;
    }

    // ─── Render Table ──────────────────────────────────────────────────────────

    function renderTable(transactions) {
        // Sort: latest date first, then latest timestamp
        const sorted = [...transactions].sort((a, b) => {
            const d = (b.date || "").localeCompare(a.date || "");
            if (d !== 0) return d;
            return (b.timestamp || "").localeCompare(a.timestamp || "");
        });

        const tbody = document.getElementById("report-tbody");
        tbody.innerHTML = "";

        let grandBags = 0;
        let grandMt   = 0;

        sorted.forEach(tx => {
            const bags   = tx.bags   || 0;
            const weight = tx.weight || 0;
            const type   = effectiveType(tx);
            const isMU   = tx.countVan === "Made-up";

            grandBags += bags;
            grandMt   += weight;

            const dotCls    = type === "inward" ? "dot-in" : "dot-out";
            const typeColor = type === "inward" ? "#059669" : "#dc2626";
            const typeWord  = type === "inward" ? "In" : "Out";
            const madeUpTag = isMU ? `<span class="made-up-tag">Made-up</span>` : "";

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>
                    <div class="date-main">${formatDate(tx.date)}</div>
                    <div class="date-stack">Stack ${tx.stackNumber || "—"}</div>
                </td>
                <td>${commodityBadge(tx.commodity)}</td>
                <td>
                    <span style="font-size:0.78rem;font-weight:600;color:${typeColor}">
                        <span class="type-dot ${dotCls}"></span>${typeWord}
                    </span>${madeUpTag}
                </td>
                <td class="num-cell">${parseInt(bags).toLocaleString()}</td>
                <td class="mt-cell">${weight.toFixed(3)}</td>
            `;
            tbody.appendChild(tr);
        });

        // ── Sticky Total Row ──
        const totalRow = document.createElement("tr");
        totalRow.className = "total-row";
        totalRow.innerHTML = `
            <td class="total-label-cell" colspan="3">▸ GRAND TOTAL (${sorted.length} transactions)</td>
            <td class="total-bags-cell">${parseInt(grandBags).toLocaleString()}</td>
            <td class="total-mt-cell">${grandMt.toFixed(3)}</td>
        `;
        tbody.appendChild(totalRow);
    }

    // ─── CSV Export ────────────────────────────────────────────────────────────

    function exportCSV(transactions, filters) {
        const mode = filters.isInward ? "Inward" : filters.isOutward ? "Outward" : "All";

        const sorted = [...transactions].sort((a, b) =>
            (b.date || "").localeCompare(a.date || "")
        );

        let csv = "Date,Stack,Commodity,Type,Bags,MT\r\n";
        sorted.forEach(tx => {
            csv += [
                tx.date || "",
                tx.stackNumber || "",
                tx.commodity || "",
                effectiveType(tx),
                parseInt(tx.bags || 0),
                (tx.weight || 0).toFixed(3)
            ].join(",") + "\r\n";
        });

        const totalBags = sorted.reduce((s, tx) => s + (tx.bags   || 0), 0);
        const totalMt   = sorted.reduce((s, tx) => s + (tx.weight || 0), 0);
        csv += `TOTAL,,,,"${parseInt(totalBags).toLocaleString()}","${totalMt.toFixed(3)}"\r\n`;

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = `Report_${mode}_${filters.commodity}_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ─── Init ──────────────────────────────────────────────────────────────────

    function init() {
        const loader       = document.getElementById("page-loader");
        const tableScroll  = document.getElementById("table-scroll");
        const emptyState   = document.getElementById("empty-state");
        const noCacheBanner= document.getElementById("no-cache-banner");
        const pillsCont    = document.getElementById("filter-pills-container");
        const subtitle     = document.getElementById("report-subtitle");
        const exportBtn    = document.getElementById("export-csv-btn");

        // ✅ FIXED: Back button — closes tab if opened as new tab, else goes back
        document.getElementById("back-btn").addEventListener("click", function () {
            if (window.opener && !window.opener.closed) {
                // Opened via window.open — close this tab and focus opener
                window.opener.focus();
                window.close();
            } else if (document.referrer) {
                // Navigated here — go back
                window.history.back();
            } else {
                // Fallback — go to index.html
                window.location.href = "index.html";
            }
        });

        // Load filters & show pills
        const filters = loadFilters();
        pillsCont.innerHTML = buildPills(filters);

        const modeLabel = filters.isInward ? "Inward" : filters.isOutward ? "Outward" : "Net (All)";
        subtitle.textContent = `Mode: ${modeLabel} · Generated ${todayStr()}`;

        // Load raw data
        const allTx = loadData();

        if (!allTx) {
            loader.style.display  = "none";
            noCacheBanner.style.display = "flex";
            document.getElementById("hstat-bags").textContent = "0";
            document.getElementById("hstat-mt").textContent   = "0.000";
            return;
        }

        // Apply filters
        const filtered = applyFilters(allTx, filters);

        // ✅ Update header stats (Bags + MT only)
        const totalBags = filtered.reduce((s, tx) => s + (tx.bags   || 0), 0);
        const totalMt   = filtered.reduce((s, tx) => s + (tx.weight || 0), 0);
        document.getElementById("hstat-bags").textContent = parseInt(totalBags).toLocaleString();
        document.getElementById("hstat-mt").textContent   = totalMt.toFixed(3);

        // Render table or empty state
        loader.style.display = "none";

        if (filtered.length === 0) {
            emptyState.style.display = "flex";
        } else {
            tableScroll.style.display = "block";
            renderTable(filtered);
        }

        // Export CSV
        exportBtn.addEventListener("click", () => {
            if (filtered.length === 0) { alert("No data to export."); return; }
            exportCSV(filtered, filters);
        });
    }

    // Run after DOM ready
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
