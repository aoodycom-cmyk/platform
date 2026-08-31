import { getExternalAnalysis } from "../externalAnalysis/storage.js";

export const STOCK_WORKSPACE_NAV_VERSION = "v58";

const MOBILE_MAX_WIDTH = 899;
const STYLE_ID = "franklin-stock-workspace-v58";
const STYLE_URL = "./styles-stock-workspace-v58.css?v=v58-stock-pages";
const STOCK_PANELS = new Set(["external-report", "quarterly-scorecard", "company-profile", "strengths-risks"]);

let scheduledFrame = 0;
let styleReady = false;

export function installStockWorkspaceNavigation(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.stockWorkspaceNavigationInstalled === "true") return;
  root.dataset.stockWorkspaceNavigationInstalled = "true";

  const mount = () => scheduleMount(store, root);
  store.subscribe?.(mount);
  new MutationObserver(mount).observe(root, { childList: true, subtree: true });
  root.addEventListener("click", (event) => handleNavigationClick(event, store));
  window.addEventListener("resize", mount, { passive: true });
  window.addEventListener("pageshow", mount);
  ensureStylesheet(mount);
  mount();
}

function scheduleMount(store, root) {
  if (typeof window === "undefined") return;
  cancelAnimationFrame(scheduledFrame);
  scheduledFrame = requestAnimationFrame(() => mountNavigation(store, root));
}

function mountNavigation(store, root) {
  const state = store.state || {};
  const activePanel = state.activePanel;
  const mobile = window.innerWidth <= MOBILE_MAX_WIDTH;
  const active = mobile && STOCK_PANELS.has(activePanel);
  document.documentElement.classList.toggle("franklin-stock-workspace-active", active);

  root.querySelectorAll("[data-stock-workspace-nav]").forEach((node) => node.remove());
  if (!active || !styleReady) return;

  normalizeEarningsTable(root);

  const context = resolveStockContext(state);
  if (!context.ticker) return;
  const report = getExternalAnalysis(state.externalAnalyses || {}, context.ticker, context.reportId || "latest");
  const hasCompanyProfile = Boolean(report?.companyProfile);
  const frame = root.querySelector(`.mobile-app-frame.panel-${activePanel}`) || root.querySelector(".mobile-app-frame");
  const header = frame?.querySelector(":scope > .mobile-app-header");
  if (!frame || !header) return;

  const nav = document.createElement("nav");
  nav.className = "franklin-stock-page-nav";
  nav.dataset.stockWorkspaceNav = "true";
  nav.setAttribute("aria-label", isArabicUi() ? "صفحات السهم" : "Stock pages");
  nav.innerHTML = pageButtons(activePanel, hasCompanyProfile);
  header.insertAdjacentElement("afterend", nav);
  root.querySelector(".owner-presentation-edit-trigger-fallback")?.remove();

  if (activePanel === "external-report") markLegacyEarningsDetail(root);
}

function pageButtons(activePanel, hasCompanyProfile) {
  const pages = [
    ["summary", isArabicUi() ? "الملخص" : "Summary", activePanel === "external-report", false],
    ["earnings", isArabicUi() ? "الأرباح" : "Earnings", activePanel === "quarterly-scorecard", false],
    ["company", isArabicUi() ? "الشركة" : "Company", activePanel === "company-profile", !hasCompanyProfile],
    ["strengths", isArabicUi() ? "المزايا والمخاطر" : "Strengths & Risks", activePanel === "strengths-risks", false]
  ];
  return `
    <div class="franklin-stock-page-tabs" role="tablist">
      ${pages.map(([key, label, selected, disabled]) => `
        <button type="button" role="tab" data-stock-page="${key}" aria-selected="${selected}" class="${selected ? "active" : ""}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}>${escapeHtml(label)}</button>
      `).join("")}
    </div>
    ${activePanel === "external-report" ? `<button type="button" class="franklin-stock-edit-link" data-owner-presentation-open>${escapeHtml(isArabicUi() ? "تحرير" : "Edit")}</button>` : ""}
  `;
}

function handleNavigationClick(event, store) {
  const button = event.target.closest?.("[data-stock-page]");
  if (!button || button.disabled) return;
  const context = resolveStockContext(store.state || {});
  if (!context.ticker) return;
  event.preventDefault();
  const page = button.dataset.stockPage;
  if (page === "summary") {
    store.openExternalReport?.(context.ticker, context.reportId || "latest");
    return;
  }
  if (page === "earnings") {
    store.openQuarterlyScorecard?.(context.ticker, context.reportId || "latest");
    return;
  }
  if (page === "company") {
    store.openCompanyProfile?.(context.ticker, context.reportId || "latest");
    return;
  }
  if (page === "strengths") {
    store.set?.({ activePanel: "strengths-risks", notice: "" });
  }
}

function resolveStockContext(state = {}) {
  if (state.activePanel === "quarterly-scorecard") {
    const scorecard = state.quarterlyScorecard || {};
    return {
      ticker: normalizeTicker(scorecard.originTicker || scorecard.ticker),
      reportId: scorecard.originReportId || "latest"
    };
  }
  const selection = state.externalReportSelection || {};
  return {
    ticker: normalizeTicker(selection.ticker),
    reportId: selection.reportId || "latest"
  };
}

function normalizeEarningsTable(root) {
  root.querySelectorAll(".fet-table-target").forEach((table) => {
    if (table.dataset.stockTableNormalized === "true") return;
    const colgroup = table.querySelector("colgroup");
    if (colgroup && colgroup.children.length === 2) colgroup.append(document.createElement("col"));
    const headerRow = table.tHead?.rows?.[0];
    if (headerRow && headerRow.cells.length === 2) {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = isArabicUi() ? "الفعلي" : "Actual";
      headerRow.append(th);
    }
    table.querySelectorAll("tbody tr").forEach((row) => {
      if (row.cells.length !== 2) return;
      const td = document.createElement("td");
      td.className = "fet-actual-cell tone-pending";
      td.innerHTML = '<strong class="fet-actual tone-pending" dir="ltr">—</strong>';
      row.append(td);
    });
    table.dataset.stockTableNormalized = "true";
    table.classList.remove("fet-table-target");
    table.classList.add("fet-table-reported", "fet-table-unified");
  });
}

function markLegacyEarningsDetail(root) {
  const flow = root.querySelector(".panel-external-report .stock-decision-flow");
  if (!flow) return;
  [...flow.children].forEach((child) => {
    if (child.querySelector?.("[data-action='open-quarterly-scorecard']")) {
      child.classList.add("franklin-summary-legacy-earnings-detail");
    }
  });
}

function ensureStylesheet(onReady) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) {
    styleReady = true;
    onReady?.();
    return;
  }
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = STYLE_URL;
  link.addEventListener("load", () => {
    styleReady = true;
    onReady?.();
  }, { once: true });
  link.addEventListener("error", () => { styleReady = false; }, { once: true });
  document.head.appendChild(link);
}

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase();
}

function isArabicUi() {
  return document.documentElement.dir === "rtl"
    || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install = () => window.__equityResearchStore
    && installStockWorkspaceNavigation(window.__equityResearchStore, document.getElementById("app"));
  if (window.__equityResearchStore) install();
  else window.addEventListener("franklin:boot-ready", install, { once: true });
}

autoInstall();
