import { getExternalAnalysis } from "../externalAnalysis/storage.js";
import { companyLogoMarkup } from "./foundation.js";

export const STOCK_WORKSPACE_NAV_VERSION = "v63";

const MOBILE_MAX_WIDTH = 899;
const STYLE_ID = "franklin-stock-workspace-v63";
const STYLE_URL = "./styles-stock-workspace-v63.css?v=v63-single-stock-shell";
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
  if (!report) return;

  const frame = root.querySelector(`.mobile-app-frame.panel-${activePanel}`) || root.querySelector(".mobile-app-frame");
  const nativeHeader = frame?.querySelector(":scope > .mobile-app-header");
  if (!frame || !nativeHeader) return;

  // Reuse the actual header node rendered by components.js. This prevents a second,
  // unbound header from being layered on top and keeps Back / More / language controls live.
  hydrateSharedStockHeader(nativeHeader, report, state);

  const nav = document.createElement("nav");
  nav.className = "franklin-stock-page-nav";
  nav.dataset.stockWorkspaceNav = "true";
  nav.setAttribute("aria-label", isArabicUi() ? "صفحات السهم" : "Stock pages");
  nav.innerHTML = pageButtons(activePanel, Boolean(report.companyProfile));
  nativeHeader.insertAdjacentElement("afterend", nav);

  root.querySelector(".owner-presentation-edit-trigger-fallback")?.remove();
  if (activePanel === "external-report") markLegacyEarningsDetail(root);
}

function hydrateSharedStockHeader(header, report, state) {
  const ticker = report?.company?.ticker || "—";
  const companyName = report?.company?.name || ticker;
  const logoUrl = report?.presentation?.companyLogoDataUrl || "";
  const updated = report?.reportPeriod || report?.analysisDate || "—";
  header.className = "mobile-app-header report-app-bar v31-report-app-bar franklin-shared-stock-header";
  header.dataset.stockWorkspaceHeader = "true";
  header.innerHTML = `
    <button type="button" class="header-icon-button report-back-button" data-stock-back aria-label="${escapeHtml(isArabicUi() ? "العودة إلى المكتبة" : "Back to My Stocks")}" title="${escapeHtml(isArabicUi() ? "العودة إلى المكتبة" : "Back to My Stocks")}"><span aria-hidden="true">${isArabicUi() ? "›" : "‹"}</span></button>
    <details class="mobile-app-menu franklin-stock-menu">
      <summary aria-label="${escapeHtml(isArabicUi() ? "المزيد" : "More")}" title="${escapeHtml(isArabicUi() ? "المزيد" : "More")}"><span aria-hidden="true">•••</span></summary>
      <div>
        <button type="button" class="franklin-stock-menu-edit" data-stock-edit>${escapeHtml(isArabicUi() ? "تحرير بيانات العرض" : "Edit display")}</button>
        <div class="language-toggle" role="group" aria-label="Language">
          <button type="button" class="${state.language === "ar" ? "active" : ""}" data-stock-language="ar">العربية</button>
          <span></span>
          <button type="button" class="${state.language === "en" ? "active" : ""}" data-stock-language="en">English</button>
        </div>
      </div>
    </details>
    <div class="report-app-identity">
      ${companyLogoMarkup({ ticker, name: companyName, logoUrl, className: "report-company-logo" })}
      <div class="report-app-identity-copy">
        <div>
          <strong dir="auto">${escapeHtml(companyName)}</strong>
          <span class="report-ticker-pill"><bdi dir="ltr">${escapeHtml(ticker)}</bdi></span>
        </div>
        <span>${isArabicUi() ? "آخر تحديث" : "Last update"}: <bdi dir="ltr">${escapeHtml(updated)}</bdi></span>
      </div>
    </div>`;
}

function pageButtons(activePanel, hasCompanyProfile) {
  const pages = [
    ["summary", isArabicUi() ? "الملخص" : "Summary", activePanel === "external-report", false],
    ["earnings", isArabicUi() ? "الأرباح" : "Earnings", activePanel === "quarterly-scorecard", false],
    ["company", isArabicUi() ? "الشركة" : "Company", activePanel === "company-profile", !hasCompanyProfile],
    ["strengths", isArabicUi() ? "المزايا والمخاطر" : "Strengths & Risks", activePanel === "strengths-risks", false]
  ];
  return `<div class="franklin-stock-page-tabs" role="tablist">${pages.map(([key,label,selected,disabled]) => `<button type="button" role="tab" data-stock-page="${key}" aria-selected="${selected}" class="${selected ? "active" : ""}" ${disabled ? "disabled aria-disabled=\"true\"" : ""}>${escapeHtml(label)}</button>`).join("")}</div>`;
}

function handleNavigationClick(event, store) {
  const back = event.target.closest?.("[data-stock-back]");
  if (back) {
    event.preventDefault();
    store.set?.({ activePanel: "home", notice: "" });
    return;
  }

  const language = event.target.closest?.("[data-stock-language]");
  if (language) {
    event.preventDefault();
    const value = language.dataset.stockLanguage;
    if (value === "ar" || value === "en") store.set?.({ language: value, notice: "" });
    return;
  }

  const edit = event.target.closest?.("[data-stock-edit]");
  if (edit) {
    event.preventDefault();
    const context = resolveStockContext(store.state || {});
    if (!context.ticker) return;
    if (store.state?.activePanel !== "external-report") store.openExternalReport?.(context.ticker, context.reportId || "latest");
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const dialog = document.querySelector("[data-owner-presentation-dialog]");
      if (dialog?.showModal && !dialog.open) dialog.showModal();
    }));
    return;
  }

  const button = event.target.closest?.("[data-stock-page]");
  if (!button || button.disabled) return;
  const context = resolveStockContext(store.state || {});
  if (!context.ticker) return;
  event.preventDefault();
  const page = button.dataset.stockPage;
  if (page === "summary") return store.openExternalReport?.(context.ticker, context.reportId || "latest");
  if (page === "earnings") return store.openQuarterlyScorecard?.(context.ticker, context.reportId || "latest");
  if (page === "company") return store.openCompanyProfile?.(context.ticker, context.reportId || "latest");
  if (page === "strengths") store.set?.({ activePanel: "strengths-risks", notice: "" });
}

function resolveStockContext(state = {}) {
  if (state.activePanel === "quarterly-scorecard") {
    const scorecard = state.quarterlyScorecard || {};
    return { ticker: normalizeTicker(scorecard.originTicker || scorecard.ticker || state.externalReportSelection?.ticker), reportId: scorecard.originReportId || state.externalReportSelection?.reportId || "latest" };
  }
  const selection = state.externalReportSelection || {};
  return { ticker: normalizeTicker(selection.ticker), reportId: selection.reportId || "latest" };
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
    if (child.querySelector?.("[data-action='open-quarterly-scorecard']")) child.classList.add("franklin-summary-legacy-earnings-detail");
  });
}

function ensureStylesheet(onReady) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLE_ID);
  if (existing) { styleReady = true; onReady?.(); return; }
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = STYLE_URL;
  link.addEventListener("load", () => { styleReady = true; onReady?.(); }, { once: true });
  link.addEventListener("error", () => { styleReady = false; }, { once: true });
  document.head.appendChild(link);
}

function normalizeTicker(value) { return String(value || "").trim().toUpperCase(); }
function isArabicUi() { return document.documentElement.dir === "rtl" || String(document.documentElement.lang || "").toLowerCase().startsWith("ar"); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install = () => window.__equityResearchStore && installStockWorkspaceNavigation(window.__equityResearchStore, document.getElementById("app"));
  if (window.__equityResearchStore) install();
  else window.addEventListener("franklin:boot-ready", install, { once: true });
}
autoInstall();
