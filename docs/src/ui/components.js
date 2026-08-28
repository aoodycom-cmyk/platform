Warning: truncated output (original token count: 85907)
Total output lines: 7270

import { compact, money, percent } from "../domain/financialMetrics.js";
import {
  colorClass,
  colorIcon,
  fairValueColorCategory,
  formatSignedPercent,
  recommendationColorCategory,
  riskColorCategory,
  scoreColorCategory,
  upsideColorCategory
} from "../domain/marketColorSystem.js";
import { rankEvaluatedCompanies } from "../engines/rankingEngine.js";
import { DEMO_ANALYSIS_FIXTURE } from "../data/demoFlow.js";
import { copyableExternalAnalysisJson, externalAnalysisToHomeCard, externalReportWithCompletionStatus } from "../externalAnalysis/reportAdapter.js";
import { analyzeExternalAnalysisCompletion, FIELD_PRIORITY, FIELD_REQUIREMENTS } from "../externalAnalysis/missingFields.js";
import { getExternalAnalysis, listLatestExternalAnalyses } from "../externalAnalysis/storage.js";
import { normalizedEarningsPeriod } from "../externalAnalysis/historicalRequirements.js";
import { buildQuarterlyScorecard } from "../externalAnalysis/quarterlyScorecard.js";
import { downloadQuarterlyScorecardPng, shareQuarterlyScorecardPng } from "./quarterlyScorecardExport.js";
import {
  appHeaderMarkup,
  bindCompanyLogoFallbacks,
  bottomNavigationMarkup,
  companyLogoMarkup
} from "./foundation.js";
import {
  analysisText,
  decisionLabel,
  decisionWhyText,
  executiveSummaryText,
  exitThesisText,
  factorDisplay,
  factorLabel,
  financialTerm,
  outputKeyLabel,
  ratingLabel,
  researchText,
  scenarioAssumption,
  setupArabicDocument,
  sourceLabel,
  statusLabel,
  timelineType,
  uiLabel
} from "../i18n/language.js";
import { fetchResearchData, searchCompanies } from "../providers/apiClient.js";
import { formatResearchValue } from "../research/institutionalResearch.js";
import {
  FIELD_DEFINITIONS,
  VALUATION_SECTIONS,
  WORKFLOW_STATUS,
  compareValuationVersions,
  statusLabel as workflowStatusLabel
} from "../valuationWorkflow/workflow.js";

const panels = [
  ["home", "Library"],
  ["external-import", "Import Analysis"],
  ["history", "History"],
  ["settings", "Settings"]
];

const visiblePanels = new Set(["home", "external-import", "external-report", "strengths-risks", "company-profile", "quarterly-scorecard", "history", "settings"]);

function visiblePanel(panel) {
  return visiblePanels.has(panel) ? panel : "home";
}

function inlineNotice(notice, activePanel) {
  const text = String(notice || "").trim();
  if (!text) return "";
  if (activePanel === "external-report" && /(تم حفظ|تم تحديث|saved|updated successfully)/i.test(text)) return "";
  return `<div class="notice">${escapeHtml(text)}</div>`;
}

export function mountApp(root, store) {
  const actions = createActions(store);
  store.subscribe(() => render(root, store, actions));
  render(root, store, actions);
}

function render(root, store, actions) {
  const activePanel = visiblePanel(store.state.activePanel);
  const state = activePanel === store.state.activePanel ? store.state : { ...store.state, activePanel };
  setupArabicDocument(state.language);
  document.documentElement.dataset.theme = state.theme;
  if (activePanel === "home") {
    root.innerHTML = homeDashboard(state);
    bindCompanyLogoFallbacks(root);
    bind(root, store, actions);
    return;
  }
  root.innerHTML = `
    <main class="mobile-app-shell ${activePanel === "quarterly-scorecard" ? "scorecard-app-shell" : ""}">
      <section class="mobile-app-frame panel-${escapeHtml(activePanel)}">
        ${mobileAppHeader(state)}
        ${inlineNotice(state.notice, activePanel)}
        <div class="mobile-page-content">${panelContent(state)}</div>
      </section>
    </main>
    ${evidenceDetailDialog()}
    ${bottomNavigationMarkup({
      panels,
      activePanel: state.activePanel,
      scorecard: activePanel === "quarterly-scorecard",
      label: uiLabel
    })}
  `;
  bindCompanyLogoFallbacks(root);
  bind(root, store, actions);
}

function homeDashboard(state) {
  return `
    <main class="mobile-app-shell library-home">
      <section class="mobile-app-frame panel-home">
        ${mobileAppHeader(state, true)}
        <div class="mobile-page-content">
          ${homePolishedSearch(state)}
          ${externalAnalysesHomeSection(state)}
        </div>
      </section>
    </main>
    ${bottomNavigationMarkup({ panels, activePanel: state.activePanel, label: uiLabel })}
  `;
}

function libraryHero() {
  return `
    <section class="library-hero" aria-labelledby="library-title">
      <p>${isArabicUi() ? "مكتبة أبحاث خاصة" : "PRIVATE RESEARCH LIBRARY"}</p>
      <h1 id="library-title">${isArabicUi() ? "مكتبة الاستثمار" : "Investment Library"}</h1>
      <span>${isArabicUi() ? "راجع قراراتك وتقاريرك الاستثمارية المحفوظة." : "Review your saved investment decisions and research."}</span>
    </section>
  `;
}

function mobileAppHeader(state, isHome = false) {
  if (state.activePanel === "external-report" || state.activePanel === "strengths-risks") return externalReportAppBar(state);
  if (isHome) return libraryAppHeader(state);
  const title = isHome ? uiLabel("My Stocks") : activePanelLabel(state.activePanel);
  return appHeaderMarkup({
    title,
    isHome,
    theme: state.theme,
    language: state.language,
    label: uiLabel
  });
}

function libraryAppHeader(state) {
  return `
    <header class="mobile-app-header library-app-header v31-library-header">
      <div class="v31-library-heading">
        <strong>${isArabicUi() ? "فرانكلين" : "Franklin"}</strong>
        <span dir="ltr">FRANKLIN RESEARCH</span>
      </div>
      <div class="v31-library-controls">
        <button class="header-icon-button header-add-button" data-action="open-external-import" aria-label="${uiLabel("إضافة سهم")}" title="${uiLabel("إضافة سهم")}"><span aria-hidden="true">+</span></button>
        <label class="v31-library-sort">
          <span>${isArabicUi() ? "ترتيب" : "Sort"} <b aria-hidden="true">•</b> <bdi dir="ltr">Sort</bdi></span>
          <select data-library-sort aria-label="${uiLabel("Sort")}">
            ${watchlistFilterOption("latest", uiLabel("Latest Update"), state.librarySort)}
            ${watchlistFilterOption("upside", uiLabel("Highest Upside"), state.librarySort)}
            ${watchlistFilterOption("ticker", uiLabel("Ticker"), state.librarySort)}
          </select>
        </label>
      </div>
    </header>
  `;
}

function externalReportAppBar(state) {
  const selection = state.externalReportSelection || {};
  const report = getExternalAnalysis(state.externalAnalyses || {}, selection.ticker, selection.reportId);
  const ticker = report?.company?.ticker || selection.ticker || "—";
  const companyName = report?.company?.name || ticker;
  const logoUrl = report?.presentation?.companyLogoDataUrl || "";
  const updated = report?.reportPeriod || report?.analysisDate || "—";
  const moreLabel = uiLabel("More");
  return `
    <header class="mobile-app-header report-app-bar v31-report-app-bar">
      <button class="header-icon-button report-back-button" data-panel="home" aria-label="${uiLabel("Back to My Stocks")}" title="${uiLabel("Back to My Stocks")}"><span aria-hidden="true">‹</span></button>
      <details class="mobile-app-menu">
        <summary aria-label="${escapeHtml(moreLabel)}" title="${escapeHtml(moreLabel)}"><span aria-hidden="true">•••</span></summary>
        <div>
          <div class="language-toggle" role="group" aria-label="Language">
            <button class="${state.language === "ar" ? "active" : ""}" data-language="ar">العربية</button>
            <span></span>
            <button class="${state.language === "en" ? "active" : ""}" data-language="en">English</button>
          </div>
          <button class="icon-btn" data-action="toggle-theme">${state.theme === "dark" ? uiLabel("Light") : uiLabel("Dark")}</button>
        </div>
      </details>
      <div class="report-app-identity">
        ${companyLogoMarkup({ ticker, name: companyName, logoUrl, className: "report-company-logo" })}
        <div class="report-app-identity-copy">
          <div>
            <strong dir="auto">${escapeHtml(companyName)}</strong>
            ${report?.companyProfile
              ? `<button class="report-profile-link" data-profile-ticker="${escapeHtml(ticker)}" data-profile-report-id="${escapeHtml(report.id || "latest")}"><bdi dir="ltr">${escapeHtml(ticker)}</bdi></button>`
              : `<span class="report-ticker-pill"><bdi dir="ltr">${escapeHtml(ticker)}</bdi></span>`}
          </div>
          <span>${isArabicUi() ? "آخر تحديث" : "Last update"}: <bdi dir="ltr">${escapeHtml(updated)}</bdi></span>
        </div>
      </div>
    </header>
  `;
}

function homePolishedSearch(state) {
  return `
    <section class="home-search home-search-premium library-search-panel">
      <div class="search-line">
        <input id="searchInput" data-library-search value="${escapeHtml(state.query)}" placeholder="${uiLabel("Search saved reports by ticker or company")}" autocomplete="off">
      </div>
    </section>
  `;
}

function homeQuickActions(state) {
  return `
    <section class="quick-actions-panel" aria-label="${uiLabel("Quick Actions")}">
      <button data-action="new-analysis">
        <span>${uiLabel("Paste Data")}</span>
        <strong>${uiLabel("New Analysis")}</strong>
      </button>
      <button data-action="open-external-import">
        <span>${uiLabel("External ChatGPT")}</span>
        <strong>${uiLabel("Import Analysis")}</strong>
      </button>
      <button data-action="load-demo-analysis">
        <span>${uiLabel("Research grade")}</span>
        <strong>${uiLabel("Demo Report")}</strong>
      </button>
      <button data-panel="settings">
        <span>${uiLabel("Private workflow")}</span>
        <strong>${uiLabel("Source Settings")}</strong>
      </button>
    </section>
  `;
}

function externalAnalysesHomeSection(state) {
  const allReports = listLatestExternalAnalyses(state.externalAnalyses || {}).map(externalAnalysisToHomeCard);
  const reports = sortExternalReports(filterExternalReports(allReports, state.query, state.libraryFilter), state.librarySort);
  const totalReports = Object.values(state.externalAnalyses || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  return `
    <section class="evaluated-panel external-home-panel library-panel">
      ${watchlistToolbar(state)}
      ${reports.length ? `
        <div class="library-card-grid" data-stock-count="${allReports.length}" data-analysis-count="${totalReports}">
          ${reports.map((report) => externalHomeCard(report)).join("")}
        </div>
      ` : externalLibraryEmptyState()}
    </section>
  `;
}

function externalHomeCard(report) {
  return `
    <article class="company-card external-company-card library-company-card terminal-watchlist-row figma-library-row v31-library-stock-row" data-franklin-v2="true" data-external-ticker="${escapeHtml(report.ticker)}" data-external-report-id="${escapeHtml(report.id)}" data-library-card data-search-text="${escapeHtml(`${report.ticker} ${report.companyName}`.toLowerCase())}">
      <div class="library-company-identity">
        ${companyLogoMarkup({ ticker: report.ticker, name: report.companyName, logoUrl: report.companyLogoDataUrl })}
        <div>
          <strong dir="auto">${escapeHtml(report.companyName || uiLabel("Company"))}</strong>
          <span><bdi dir="ltr">${escapeHtml(report.ticker)}</bdi></span>
        </div>
        <em class="${colorClass(recommendationColorCategory(report.verdict), "badge")}">${escapeHtml(localizedExternalText(report.verdict) || "-")}</em>
        ${report.hasCompanyProfile ? `<button class="profile-pill" data-profile-ticker="${escapeHtml(report.ticker)}" data-profile-report-id="${escapeHtml(report.id)}">${uiLabel("Company Profile")}</button>` : ""}
      </div>
      <div class="v31-library-price-block ${Number.isFinite(numericValue(report.morningstarFairValue)) ? "has-morningstar" : ""}">
        <div class="v31-current-price">
          <span>${uiLabel("Current Price")}</span>
          <strong dir="ltr">${money(report.currentPrice, 0)}</strong>
        </div>
        <div class="v31-fair-value-line">
          <span>${uiLabel("Fair Value")}</span>
          <strong dir="ltr">${money(report.baseFairValue, 0)}</strong>
        </div>
        <div class="v31-morningstar-line">
          <span>Morningstar</span>
          <strong dir="ltr">${Number.isFinite(numericValue(report.morningstarFairValue)) ? money(report.morningstarFairValue, 0) : "—"}</strong>
        </div>
        <div class="v31-upside-line">
          <span>${isArabicUi() ? "العائد إلى Base" : "Return to Base"}</span>
          <b class="${colorClass(upsideColorCategory(numericValue(report.upsideToBasePct)), "tone")}" dir="ltr">${formatExternalPercent(report.upsideToBasePct)}</b>
        </div>
      </div>
      <div class="v2-library-scenarios" aria-label="${uiLabel("Valuation Scenarios")}">
        <span><small>Bear</small><b dir="ltr">${money(report.bearFairValue, 0)}</b></span>
        <span><small>Base</small><b dir="ltr">${money(report.baseFairValue, 0)}</b></span>
        <span><small>Bull</small><b dir="ltr">${money(report.bullFairValue, 0)}</b></span>
      </div>
    </article>
  `;
}

function watchlistToolbar(state) {
  const filters = [
    ["all", isArabicUi() ? "الكل • All" : "All"],
    ["buy", isArabicUi() ? "شراء • Buy" : "Buy"],
    ["hold", isArabicUi() ? "احتفاظ • Hold" : "Hold"],
    ["watch", isArabicUi() ? "مراقبة • Watch" : "Watch"]
  ];
  return `
    <div class="watchlist-toolbar">
      <select data-library-filter aria-hidden="true" tabindex="-1">
        ${watchlistFilterOption("all", uiLabel("All"), state.libraryFilter)}
        ${watchlistFilterOption("buy", decisionLabel("BUY"), state.libraryFilter)}
        ${watchlistFilterOption("add", decisionLabel("ADD"), state.libraryFilter)}
        ${watchlistFilterOption("hold", decisionLabel("HOLD"), state.libraryFilter)}
        ${watchlistFilterOption("watch", decisionLabel("WATCH"), state.libraryFilter)}
        ${watchlistFilterOption("reduce", decisionLabel("REDUCE"), state.libraryFilter)}
        ${watchlistFilterOption("sell", decisionLabel("SELL"), state.libraryFilter)}
        ${watchlistFilterOption("incomplete", uiLabel("Incomplete"), state.libraryFilter)}
      </select>
      <div class="library-filter-chips" role="group" aria-label="${uiLabel("Filter")}">
        ${filters.map(([value, label]) => `<button class="${state.libraryFilter === value ? "active" : ""}" type="button" data-library-filter-button="${value}" aria-pressed="${state.libraryFilter === value}">${escapeHtml(label)}</button>`).join("")}
      </div>
    </div>
  `;
}

function watchlistFilterOption(value, label, current) {
  return `<option value="${escapeHtml(value)}" ${current === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

function libraryCompletionRow(completion = {}) {
  const pct = boundedPercent(completion.completionPct);
  return `
    <div class="library-completion-row ${completionStatusClass(completion.status)}">
      <span>${uiLabel("Data Health")}</span>
      <strong>${pct}%</strong>
      <em>${completionStatusLabel(completion.status)}</em>
    </div>
  `;
}

function investmentLibrarySummary(reports = []) {
  const counts = reports.reduce((acc, report) => {
    const key = normalizeRecommendationKey(report.verdict);
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const complete = reports.filter((report) => report.completionStatus?.status === "complete").length;
  const items = [
    [isArabicUi() ? "إجمالي الأسهم" : "Total Stocks", reports.length, "neutral", isArabicUi() ? "مكتبة المتابعة" : "Research library"],
    [isArabicUi() ? "فرص الشراء" : "Buy Candidates", (counts.BUY || 0) + (counts.ADD || 0), "positive", isArabicUi() ? "قائمة القرار" : "Action list"],
    [isArabicUi() ? "قيد المتابعة" : "Under Review", (counts.HOLD || 0) + (counts.WATCH || 0), "warning", isArabicUi() ? "احتفاظ ومراقبة" : "Hold and watch"],
    [isArabicUi() ? "تقارير مكتملة" : "Complete Reports", complete, "neutral", isArabicUi() ? "جاهزة للمراجعة" : "Ready to review"]
  ];
  return `
    <div class="investment-library-summary" aria-label="${uiLabel("Portfolio status summary")}">
      ${items.map(([label, value, tone, detail]) => `
        <article class="library-summary-card ${colorClass(tone, "tone")}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(String(value))}</strong>
          <small>${escapeHtml(detail)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function normalizeRecommendationKey(value) {
  const clean = String(value || "").trim().toUpperCase();
  const localized = String(value || "").trim();
  if (/شراء/.test(localized)) return "BUY";
  if (/زيادة|إضافة/.test(localized)) return "ADD";
  if (/احتفاظ/.test(localized)) return "HOLD";
  if (/مراقبة/.test(localized)) return "WATCH";
  if (/تخفيف/.test(localized)) return "REDUCE";
  if (/بيع/.test(localized)) return "SELL";
  if (clean.includes("STRONG BUY")) return "BUY";
  if (clean.includes("BUY")) return "BUY";
  if (clean.includes("ADD") || clean.includes("ACCUMULATE")) return "ADD";
  if (clean.includes("HOLD")) return "HOLD";
  if (clean.includes("WATCH")) return "WATCH";
  if (clean.includes("REDUCE") || clean.includes("TRIM")) return "REDUCE";
  if (clean.includes("SELL")) return "SELL";
  return "";
}

function filterExternalReports(reports, query, filter = "all") {
  const clean = String(query || "").trim().toLowerCase();
  return reports.filter((report) => {
    const matchesQuery = !clean || `${report.ticker} ${report.companyName}`.toLowerCase().includes(clean);
    const recommendation = normalizeRecommendationKey(report.verdict).toLowerCase();
    const matchesFilter = filter === "all"
      || recommendation === filter
      || (filter === "incomplete" && report.completionStatus?.status !== "complete");
    return matchesQuery && matchesFilter;
  });
}

function sortExternalReports(reports = [], sort = "latest") {
  const rows = [...reports];
  if (sort === "upside") {
    return rows.sort((a, b) => (numericValue(b.upsideToBasePct) || -Infinity) - (numericValue(a.upsideToBasePct) || -Infinity));
  }
  if (sort === "ticker") {
    return rows.sort((a, b) => String(a.ticker || "").localeCompare(String(b.ticker || "")));
  }
  return rows.sort((a, b) => new Date(b.analysisDate || 0).getTime() - new Date(a.analysisDate || 0).getTime());
}

function externalLibraryEmptyState() {
  return `
    <div class="empty-home-state library-empty-state">
      <strong>${uiLabel("No saved stocks yet.")}</strong>
      <p>${uiLabel("Start by adding your first investment analysis.")}</p>
      <button class="primary-btn" data-action="open-external-import">${uiLabel("Analyze / Add Stock")}</button>
    </div>
  `;
}

function formatExternalPercent(value) {
  const numeric = numericValue(value);
  return Number.isFinite(numeric) ? `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)}%` : "—";
}

function homeRecentAnalysesSection(state) {
  const rankedAll = rankEvaluatedCompanies(state.evaluatedCompanies);
  const filtered = filterEvaluatedCompanies(rankedAll, state.query, state.rankingFilter, state.sectorFilter);
  const rows = sortVisibleRows(filtered, state.evaluatedSort).slice(0, 8);
  return `
    <section class="evaluated-panel company-cards-panel recent-analyses-panel">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("Recent Analyses")}</p>
          <h2>${uiLabel("Evaluated Companies")}</h2>
        </div>
        <button class="icon-btn" data-action="new-analysis">${uiLabel("New Analysis")}</button>
      </div>
      <div class="company-card-grid">
        ${rows.length ? rows.map((item) => evaluatedCompanyCard(item)).join("") : emptyHomeState(state)}
      </div>
    </section>
  `;
}

function homeWatchlistPanel(state) {
  const visible = (state.watchList || []).slice(0, 5);
  return `
    <section class="evaluated-panel watchlist-home-panel">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("Watchlist")}</p>
          <h2>${uiLabel("Saved Companies")}</h2>
        </div>
        <button class="icon-btn" data-panel="watchlist">${uiLabel("Open")}</button>
      </div>
      <div class="watchlist-home-list">
        ${visible.length ? visible.map((item) => `
          <button data-panel="watchlist">
            <span>${escapeHtml(item.ticker)}</span>
            <strong>${escapeHtml(decisionLabel(item.decision))}</strong>
            <small>${escapeHtml(item.reviewDate || item.updatedAt || "")}</small>
          </button>
        `).join("") : `
          <div class="empty-mini">
            <strong>${uiLabel("No saved companies yet")}</strong>
            <span>${uiLabel("Approved reports can be added to Watchlist from the report.")}</span>
          </div>
        `}
      </div>
    </section>
  `;
}

function homeSearchBlock(state) {
  return `
    <section class="home-search">
      <div class="search-heading">
        <span>${uiLabel("New analysis")}</span>
        <strong>${uiLabel("Enter a ticker to start")}</strong>
      </div>
      <div class="search-line">
        <input id="searchInput" value="${escapeHtml(state.query)}" placeholder="${uiLabel("Search by company name or ticker")}" autocomplete="off">
        <button class="primary-btn" data-action="search">${state.loading ? uiLabel("Searching") : uiLabel("Start analysis")}</button>
      </div>
      <div class="quick-tickers" aria-label="${uiLabel("Common examples")}">
        ${["AAPL", "MSFT", "NVDA", "AMZN"].map((ticker) => `<button data-sample-query="${ticker}">${ticker}</button>`).join("")}
      </div>
      ${state.notice ? `<p class="home-note">${escapeHtml(state.notice)}</p>` : ""}
      ${state.searchResults.length ? `<div class="results home-results">
        <p>${uiLabel("Search Results")}</p>
        ${state.searchResults.map(searchResult).join("")}
      </div>` : ""}
    </section>
  `;
}

function homeStartCard(state) {
  return `
    <section class="start-card">
      <div>
        <p class="eyebrow">${uiLabel("Start here")}</p>
        <h2>${uiLabel("Should I buy this stock today?")}</h2>
        <p>${uiLabel("Start with one search or one pasted data block. The app keeps drafts private until you approve the report.")}</p>
      </div>
      <div class="start-steps">
        ${startStep("1", uiLabel("Paste"), uiLabel("One main box for company and financial data."))}
        ${startStep("2", uiLabel("Review"), uiLabel("Confirm, missing, and conflicting fields are separated."))}
        ${startStep("3", uiLabel("Report"), uiLabel("Read the decision first; open details only when needed."))}
      </div>
      <div class="start-footer">
        <span class="ready">${uiLabel("Market data runs through the secure server.")}</span>
        <div class="start-buttons">
          <button class="primary-btn" data-action="new-analysis">${uiLabel("New Analysis")}</button>
          <button class="icon-btn" data-action="load-demo-analysis">${uiLabel("Load Demo Data")}</button>
          <button class="icon-btn" data-panel="settings">${uiLabel("Settings")}</button>
        </div>
      </div>
    </section>
  `;
}

function startStep(number, title, detail) {
  return `
    <div class="start-step">
      <b>${escapeHtml(number)}</b>
      <span>${escapeHtml(title)}</span>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function homeCompanyCardsSection(state) {
  const rankedAll = rankEvaluatedCompanies(state.evaluatedCompanies);
  const filtered = filterEvaluatedCompanies(rankedAll, state.query, state.rankingFilter, state.sectorFilter);
  const rows = sortVisibleRows(filtered, state.evaluatedSort).slice(0, 12);
  return `
    <section class="evaluated-panel company-cards-panel">
      <div class="table-title">
        <div>
          <h2>${uiLabel("Evaluated Companies")}</h2>
          <p>${uiLabel("Approved reports only. Drafts never appear on Home.")}</p>
        </div>
        <button class="icon-btn" data-action="new-analysis">${uiLabel("New Analysis")}</button>
      </div>
      ${rankingToolbar(state, rankedAll)}
      ${comparisonPanel(state, rankedAll)}
      ${homeWatchlistStrip(state)}
      <div class="company-card-grid">
        ${rows.length ? rows.map((item) => evaluatedCompanyCard(item)).join("") : emptyHomeState(state)}
      </div>
    </section>
  `;
}

function homeWatchlistStrip(state) {
  const visible = (state.watchList || []).slice(0, 4);
  if (!visible.length) return "";
  return `
    <div class="watchlist-strip">
      <span>${uiLabel("Watchlist")}</span>
      ${visible.map((item) => `<button data-panel="watchlist">${escapeHtml(item.ticker)} / ${escapeHtml(decisionLabel(item.decision))}</button>`).join("")}
    </div>
  `;
}

function evaluatedCompanyCard(item) {
  const decision = item.decisionStatus === "INSUFFICIENT_DATA" ? statusLabel(item.decisionStatus) : decisionLabel(item.recommendation);
  return `
    <article class="company-card" data-evaluated-ticker="${escapeHtml(item.ticker)}">
      <div class="company-card-top">
        <div class="ticker-avatar">${escapeHtml(String(item.ticker || "").slice(0, 3))}</div>
        <div>
          <strong>${escapeHtml(item.ticker)}</strong>
          <span>${escapeHtml(item.companyName || uiLabel("Company"))}</span>
        </div>
        <em class="${colorClass(recommendationColorCategory(item.recommendation, item.decisionStatus), "badge")}">${escapeHtml(decision)}</em>
      </div>
      <div class="company-card-decision">
        <span>${uiLabel("Recommendation")}</span>
        <b>${escapeHtml(decision)}</b>
      </div>
      <div class="company-card-metrics">
        ${compactCardMetric(uiLabel("Current Price"), money(item.currentPrice, 2))}
        ${compactCardMetric(uiLabel("Range FV"), money(item.rangeFairValue, 0))}
        ${compactCardMetric(uiLabel("Upside %"), formatSignedPercent(item.upside))}
        ${compactCardMetric(uiLabel("Confidence"), Number.isFinite(item.confidence) ? `${Math.round(item.confidence)}%` : "—")}
      </div>
      <div class="company-card-footer">
        <span>${uiLabel("Data Quality")}: ${Number.isFinite(item.dataQuality) ? Math.round(item.dataQuality) : "—"}/100</span>
        <small>${uiLabel("Open report")}</small>
      </div>
    </article>
  `;
}

function compactCardMetric(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value === null || value === undefined || value === "" ? "—" : value))}</strong>
    </div>
  `;
}

function emptyHomeState(state) {
  const message = state.evaluatedCompanies.length
    ? uiLabel("No matching evaluated companies.")
    : uiLabel("No approved reports yet. Start a new analysis or load the demo flow.");
  return `
    <div class="empty-home-state">
      <strong>${escapeHtml(message)}</strong>
      <p>${uiLabel("The dashboard stays clean because only approved reports are exported here.")}</p>
      <div>
        <button class="primary-btn" data-action="new-analysis">${uiLabel("New Analysis")}</button>
        <button class="icon-btn" data-action="load-demo-analysis">${uiLabel("Load Demo Data")}</button>
      </div>
    </div>
  `;
}

function activePanelLabel(panel) {
  if (panel === "external-report") return uiLabel("Investment Report");
  if (panel === "external-import") return uiLabel("Import Analysis");
  if (panel === "history") return uiLabel("History");
  if (panel === "settings") return uiLabel("Settings");
  if (panel === "company-profile") return uiLabel("Company Profile");
  if (panel === "quarterly-scorecard") return uiLabel("Quarterly Scorecard");
  return uiLabel("Investment Watchlist");
}

function searchBlock(state) {
  return `
    <section class="search-band">
      <div class="search-line">
        <input id="searchInput" value="${escapeHtml(state.query)}" placeholder="${uiLabel("Search ticker or company name")}" autocomplete="off">
        <button class="primary-btn" data-action="search">${state.loading ? uiLabel("Searching") : uiLabel("Search")}</button>
      </div>
      ${state.searchResults.length ? `<div class="results">${state.searchResults.map(searchResult).join("")}</div>` : ""}
    </section>
  `;
}

function searchResult(company) {
  return `
    <button class="result" data-result-ticker="${escapeHtml(company.ticker)}">
      <strong>${escapeHtml(company.ticker)}</strong>
      <span>${escapeHtml(company.name)}</span>
      <small>${escapeHtml(company.exchange || company.sector || uiLabel("Market"))} / ${uiLabel("Open valuation workspace")}</small>
    </button>
  `;
}

function evaluatedCompaniesTable(state) {
  const rankedAll = rankEvaluatedCompanies(state.evaluatedCompanies);
  const filtered = filterEvaluatedCompanies(rankedAll, state.query, state.rankingFilter, state.sectorFilter);
  const selectedTickers = new Set(state.compareSelectedTickers);
  const rows = sortVisibleRows(filtered, state.evaluatedSort).map((item) => ({
    ...item,
    compareSelected: selectedTickers.has(item.ticker)
  }));
  const columns = [
    ["rankingPosition", uiLabel("Rank"), "number"],
    ["ticker", uiLabel("Stock"), "ticker"],
    ["currentPrice", uiLabel("Current Price"), "number"],
    ["bearFairValue", "Bear", "number"],
    ["baseFairValue", "Base", "number"],
    ["bullFairValue", "Bull", "number"],
    ["morningstarFairValue", "Morningstar", "number"],
    ["rangeFairValue", uiLabel("Range FV"), "number"],
    ["upside", uiLabel("Upside %"), "percent"],
    ["maxFairValueUpside", uiLabel("Max FV Upside %"), "percent"],
    ["investmentScore", financialTerm("Investment Score"), "number"],
    ["confidence", uiLabel("Confidence"), "number"],
    ["dataQuality", uiLabel("Data Quality"), "number"],
    ["recommendation", uiLabel("Recommendation"), "text"],
    ["approvedDate", uiLabel("Approved Date"), "text"],
    ["valuationVersion", uiLabel("Valuation Version"), "text"]
  ];

  return `
    <section class="evaluated-panel">
      <div class="table-title">
        <h2>${uiLabel("Evaluated Companies")}</h2>
        <p>${uiLabel("Companies persist locally in this browser. Latest evaluation replaces the current row and keeps prior evaluations in history.")}</p>
      </div>
      ${rankingToolbar(state, rankedAll)}
      ${comparisonPanel(state, rankedAll)}
      <div class="evaluated-table-wrap">
        <table class="evaluated-table">
          <thead>
            <tr>
              ${columns.map(([key, label]) => `
                <th>
                  <button data-sort-key="${key}" title="${sortTitle(state, key)}">
                    ${escapeHtml(label)}
                    ${sortIndicator(state, key)}
                  </button>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map((item) => evaluatedRow(item)).join("") : `
              <tr class="empty-row"><td colspan="${columns.length}">${escapeHtml(state.evaluatedCompanies.length ? uiLabel("No matching evaluated companies.") : uiLabel("No evaluated companies yet. Search for a company to run the first evaluation."))}</td></tr>
            `}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function evaluatedRow(item) {
  const selected = Boolean(item.compareSelected);
  return `
    <tr data-evaluated-ticker="${escapeHtml(item.ticker)}" title="${uiLabel("Open report")}">
      <td class="rank-sticky">${rankBadge(item)}</td>
      <td class="ticker-cell stock-sticky">
        <button class="select-dot ${selected ? "selected" : ""}" data-select-ticker="${escapeHtml(item.ticker)}" title="${uiLabel("Select for comparison")}">${selected ? "✓" : "+"}</button>
        <div>
          <strong>${escapeHtml(item.ticker)}</strong>
          <span>${escapeHtml(item.companyName || "")}</span>
          <em class="decision-mini ${colorClass(recommendationColorCategory(item.recommendation, item.decisionStatus), "badge")}">${escapeHtml(decisionLabel(item.recommendation))}</em>
        </div>
      </td>
      <td class="num">${moneySignal(item.currentPrice, 2)}</td>
      <td class="num">${fairValueSignal(item.bearFairValue, item.currentPrice)}</td>
      <td class="num">${fairValueSignal(item.baseFairValue, item.currentPrice)}</td>
      <td class="num">${fairValueSignal(item.bullFairValue, item.currentPrice)}</td>
      <td class="num">${fairValueSignal(item.morningstarFairValue, item.currentPrice)}</td>
      <td class="num strong-num">${fairValueSignal(item.rangeFairValue, item.currentPrice)}</td>
      <td class="num">${upsideSignal(item.upside)}</td>
      <td class="num">${upsideSignal(item.maxFairValueUpside)}</td>
      <td class="num">${scoreSignal(item.investmentScore)}</td>
      <td class="num">${scoreSignal(item.confidence)}</td>
      <td class="num">${scoreSignal(item.dataQuality)}</td>
      <td>${recommendationBadge(item)}</td>
      <td>${escapeHtml(item.approvedDate || item.evaluationDate || "—")}</td>
      <td>${escapeHtml(item.valuationVersion || "—")}</td>
    </tr>
  `;
}

function rankingToolbar(state, items) {
  const filters = [
    ["all", uiLabel("All")],
    ["BUY", decisionLabel("BUY")],
    ["HOLD", decisionLabel("HOLD")],
    ["SELL", decisionLabel("SELL")],
    ["positiveUpside", uiLabel("Positive Upside")],
    ["negativeUpside", uiLabel("Negative Upside")],
    ["highDataQuality", uiLabel("High Data Quality")]
  ];
  const sectors = availableSectors(items);
  const selectedCount = state.compareSelectedTickers.length;
  return `
    <div class="ranking-toolbar">
      <div class="filter-chips" role="group" aria-label="${uiLabel("Recommendation")}">
        ${filters.map(([key, label]) => `
          <button class="filter-chip ${state.rankingFilter === key ? "active" : ""}" data-ranking-filter="${key}">${escapeHtml(label)}</button>
        `).join("")}
      </div>
      <div class="ranking-actions">
        ${sectors.length ? `
          <label class="sector-filter">${uiLabel("Sector")}
            <select data-sector-filter>
              <option value="all">${uiLabel("All sectors")}</option>
              ${sectors.map((sector) => `<option value="${escapeHtml(sector)}" ${state.sectorFilter === sector ? "selected" : ""}>${escapeHtml(sector)}</option>`).join("")}
            </select>
          </label>
        ` : ""}
        <button class="icon-btn compare-btn" data-action="compare-selected" ${selectedCount >= 2 ? "" : "disabled"}>${uiLabel("Compare selected")} <span>${selectedCount}/5</span></button>
      </div>
    </div>
  `;
}

function comparisonPanel(state, rankedAll) {
  if (!state.comparisonOpen) return "";
  const selected = state.compareSelectedTickers
    .map((ticker) => rankedAll.find((item) => item.ticker === ticker))
    .filter(Boolean)
    .slice(0, 5);
  if (selected.length < 2) {
    return `<div class="compare-panel"><p class="muted">${uiLabel("Select 2 to 5 companies to compare.")}</p></div>`;
  }
  const rows = comparisonMetrics();
  return `
    <div class="compare-panel">
      <div class="compare-head">
        <div>
          <p class="eyebrow">${uiLabel("Comparison")}</p>
          <h3>${selected.map((item) => escapeHtml(item.ticker)).join(" / ")}</h3>
        </div>
        <button class="icon-btn" data-action="close-comparison">${uiLabel("Close comparison")}</button>
      </div>
      <p class="compare-conclusion">${escapeHtml(comparisonConclusion(selected))}</p>
      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>${uiLabel("Metric")}</th>
              ${selected.map((item) => `<th>${escapeHtml(item.ticker)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => `
              <tr>
                <td>${escapeHtml(row.label)}</td>
                ${selected.map((item) => `<td class="${comparisonCellClass(row, item, selected)}">${comparisonValue(row, item)}</td>`).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function comparisonMetrics() {
  return [
    { key: "currentPrice", label: uiLabel("Current Price"), kind: "money", direction: "neutral" },
    { key: "bearFairValue", label: "Bear", kind: "fairValue", direction: "higher" },
    { key: "baseFairValue", label: "Base", kind: "fairValue", direction: "higher" },
    { key: "bullFairValue", label: "Bull", kind: "fairValue", direction: "higher" },
    { key: "morningstarFairValue", label: "Morningstar", kind: "fairValue", direction: "higher" },
    { key: "rangeFairValue", label: uiLabel("Range FV"), kind: "fairValue", direction: "higher" },
    { key: "upside", label: uiLabel("Upside %"), kind: "percent", direction: "higher" },
    { key: "maxFairValueUpside", label: uiLabel("Max FV Upside %"), kind: "percent", direction: "higher" },
    { key: "investmentScore", label: financialTerm("Investment Score"), kind: "score", direction: "higher" },
    { key: "qualityScore", label: financialTerm("Quality"), kind: "score", direction: "higher" },
    { key: "growthScore", label: financialTerm("Growth"), kind: "score", direction: "higher" },
    { key: "managementScore", label: financialTerm("Management"), kind: "score", direction: "higher" },
    { key: "moatScore", label: financialTerm("Economic Moat"), kind: "score", direction: "higher" },
    { key: "riskScore", label: financialTerm("Risk"), kind: "risk", direction: "higherRiskScore" },
    { key: "dataQuality", label: uiLabel("Data Quality"), kind: "score", direction: "higher" },
    { key: "rankingScore", label: uiLabel("Ranking Score"), kind: "score", direction: "higher" },
    { key: "recommendation", label: uiLabel("Recommendation"), kind: "recommendation", direction: "neutral" }
  ];
}

function comparisonValue(row, item) {
  if (row.kind === "money") return moneySignal(item[row.key], 2);
  if (row.kind === "fairValue") return fairValueSignal(item[row.key], item.currentPrice);
  if (row.kind === "percent") return upsideSignal(item[row.key]);
  if (row.kind === "score") return scoreSignal(item[row.key]);
  if (row.kind === "risk") return riskSignal(item[row.key]);
  if (row.kind === "recommendation") return recommendationBadge(item);
  return escapeHtml(item[row.key] ?? "—");
}

function comparisonCellClass(row, item, selected) {
  const value = numericValue(item[row.key]);
  if (row.direction === "neutral") return !Number.isFinite(value) && row.kind !== "recommendation" ? "comparison-missing" : "";
  if (!Number.isFinite(value)) return "comparison-missing";
  const values = selected.map((entry) => numericValue(entry[row.key])).filter(Number.isFinite);
  if (values.length < 2 || new Set(values).size < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (row.direction === "higherRiskScore") {
    if (value === max) return "comparison-best-risk";
    if (value === min) return "comparison-worst-risk";
    return "";
  }
  if (value === max) return "comparison-best";
  if (value === min) return "comparison-worst";
  return "";
}

function comparisonConclusion(items) {
  const topRank = maxByFinite(items, "rankingScore");
  const topUpside = maxByFinite(items, "upside");
  const lowestRisk = maxByFinite(items, "riskScore");
  const arabic = document.documentElement.lang === "ar";
  if (!topRank && !topUpside && !lowestRisk) {
    return arabic
      ? "المقارنة غير حاسمة بسبب نقص البيانات الموثقة."
      : "The comparison is inconclusive because verified data is limited.";
  }
  if (arabic) {
    return [
      topRank ? `${topRank.ticker} يتصدر المقارنة بدرجة ترتيب ${Math.round(topRank.rankingScore)}/100.` : "",
      topUpside ? `أقوى عائد متوقع يظهر في ${topUpside.ticker} (${formatSignedPercent(topUpside.upside)}).` : "",
      lowestRisk ? `أقل Risk يظهر في ${lowestRisk.ticker} بناءً على Risk Score.` : ""
    ].filter(Boolean).join(" ");
  }
  return [
    topRank ? `${topRank.ticker} leads the comparison with a ranking score of ${Math.round(topRank.rankingScore)}/100.` : "",
    topUpside ? `${topUpside.ticker} has the strongest expected upside (${formatSignedPercent(topUpside.upside)}).` : "",
    lowestRisk ? `${lowestRisk.ticker} has the lowest Risk based on Risk Score.` : ""
  ].filter(Boolean).join(" ");
}

function filterEvaluatedCompanies(items, query, rankingFilter = "all", sectorFilter = "all") {
  const clean = String(query || "").trim().toLowerCase();
  return items.filter((item) => {
    const matchesQuery = !clean || `${item.ticker} ${item.companyName}`.toLowerCase().includes(clean);
    const matchesSector = !sectorFilter || sectorFilter === "all" || item.sector === sectorFilter;
    const matchesFilter =
      rankingFilter === "all" ||
      item.recommendation === rankingFilter ||
      (rankingFilter === "positiveUpside" && Number(item.upside) > 0) ||
      (rankingFilter === "negativeUpside" && Number(item.upside) < 0) ||
      (rankingFilter === "highDataQuality" && Number(item.dataQuality) >= 70);
    return matchesQuery && matchesSector && matchesFilter;
  });
}

function sortVisibleRows(items, sort = {}) {
  const key = sort.key || "rankingPosition";
  const direction = sort.direction === "desc" ? -1 : 1;
  return [...items].sort((a, b) => compareTableValue(a[key], b[key], direction) || compareTableValue(a.rankingPosition, b.rankingPosition, 1));
}

function compareTableValue(a, b, direction = 1) {
  const aNumber = numericValue(a);
  const bNumber = numericValue(b);
  const aFinite = Number.isFinite(aNumber);
  const bFinite = Number.isFinite(bNumber);
  if (aFinite && bFinite) return (aNumber - bNumber) * direction;
  if (aFinite) return -1;
  if (bFinite) return 1;
  return String(a ?? "").localeCompare(String(b ?? "")) * direction;
}

function availableSectors(items) {
  return [...new Set(items.map((item) => item.sector).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function maxByFinite(items, key) {
  return items
    .filter((item) => Number.isFinite(numericValue(item[key])))
    .sort((a, b) => numericValue(b[key]) - numericValue(a[key]))[0] || null;
}

function numericValue(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sortTitle(state, key) {
  const current = state.evaluatedSort || {};
  return current.key === key && current.direction === "desc" ? uiLabel("Sort ascending") : uiLabel("Sort descending");
}

function sortIndicator(state, key) {
  const current = state.evaluatedSort || {};
  if (current.key !== key) return "";
  return `<span class="sort-mark">${current.direction === "asc" ? "▲" : "▼"}</span>`;
}

function moneySignal(value, digits = 0) {
  return Number.isFinite(value) ? `<span class="table-value">${money(value, digits)}</span>` : missingSignal();
}

function valuationSummaryItem(label, value, currentPrice) {
  const className = `valuation-card ${valuationScenarioClass(label)}`;
  const primaryLabel = label === "Bear" ? uiLabel("Bear Scenario Label") : label === "Bull" ? uiLabel("Bull Scenario Label") : uiLabel("Base Scenario Label");
  const delta = Number.isFinite(value) && Number.isFinite(currentPrice) && currentPrice > 0 ? (value - currentPrice) / currentPrice : null;
  return `
    <article class="${className}">
      <span>${escapeHtml(primaryLabel)}</span>
      <strong>${money(value, 0)}</strong>
      <small>${Number.isFinite(delta) ? formatSignedPercent(delta) : "-"}</small>
    </article>
  `;
}

function valuationScenarioClass(label) {
  if (label === "Bear") return "valuation-card-bear";
  if (label === "Bull") return "valuation-card-bull";
  return "valuation-card-base";
}

function fairValueSignal(value, currentPrice, digits = 0) {
  if (!Number.isFinite(value)) return missingSignal();
  const category = fairValueColorCategory(value, currentPrice);
  return signalMarkup(category, money(value, digits));
}

function upsideSignal(value) {
  if (!Number.isFinite(value)) return missingSignal();
  const category = upsideColorCategory(value);
  return signalMarkup(category, formatSignedPercent(value));
}

function scoreSignal(value) {
  if (!Number.isFinite(value)) return missingSignal();
  return signalMarkup(scoreColorCategory(value), String(Math.round(value)), "score-badge");
}

function scoreText(value, digits = 0) {
  return Number.isFinite(value) ? String(Math.round(value * 10 ** digits) / 10 ** digits) : "-";
}

function riskSignal(value) {
  if (!Number.isFinite(value)) return missingSignal();
  return signalMarkup(riskColorCategory(value), String(Math.round(value)), "score-badge");
}

function rankBadge(item) {
  const score = Number.isFinite(item.rankingScore) ? Math.round(item.rankingScore) : "—";
  const confidence = Number.isFinite(item.rankingConfidence) ? `${Math.round(item.rankingConfidence)}%` : "—";
  const title = `${uiLabel("Ranking Score")}: ${score} / ${uiLabel("Ranking Confidence")}: ${confidence} / ${uiLabel("Main Positive Factor")}: ${factorName(item.mainPositiveFactor)} / ${uiLabel("Main Negative Factor")}: ${factorName(item.mainNegativeFactor)}`;
  return `
    <div class="rank-cell" title="${escapeHtml(title)}">
      <strong>#${escapeHtml(item.rankingPosition ?? "—")}</strong>
      <span>${escapeHtml(String(score))}</span>
    </div>
  `;
}

function recommendationBadge(item) {
  const category = recommendationColorCategory(item.recommendation, item.decisionStatus);
  const label = item.decisionStatus === "INSUFFICIENT_DATA" ? statusLabel(item.decisionStatus) : decisionLabel(item.recommendation);
  return `<span class="recommendation-badge ${colorClass(category, "badge")}" title="${escapeHtml(statusLabel(item.decisionStatus || ""))}">${colorIcon(category)} ${escapeHtml(label || "—")}</span>`;
}

function signalMarkup(category, value, extraClass = "") {
  return `<span class="signal ${colorClass(category)} ${extraClass}"><span aria-hidden="true">${colorIcon(category)}</span><b>${escapeHtml(value)}</b></span>`;
}

function missingSignal() {
  return `<span class="signal ${colorClass("missing")}"><span aria-hidden="true">—</span><b>—</b></span>`;
}

function factorName(value) {
  if (!value) return "";
  if (String(value).startsWith("Missing ")) {
    return `${uiLabel("Missing")} ${financialTerm(String(value).replace("Missing ", ""))}`;
  }
  return financialTerm(value);
}

function executiveSummary(state) {
  const r = state.research;
  const decisionClass = r.decision.label.toLowerCase();
  return `
    <section class="hero-decision">
      <div>
        <p class="eyebrow">${escapeHtml(state.company.ticker)} / ${escapeHtml(state.company.industry)}</p>
        <div class="decision ${decisionClass}">${escapeHtml(decisionLabel(r.decision.label))}</div>
        <div class="status-line">
          <span class="status-chip ${r.decision.status === "ACTIONABLE" ? "ready" : "limited"}">${statusLabel(r.decision.status)}</span>
          <span>${escapeHtml(ratingLabel(r.dataCompleteness.rating))} ${uiLabel("Data")}</span>
        </div>
        <p class="summary-text">${escapeHtml(executiveSummaryText(state.company, r))}</p>
      </div>
      <div class="decision-grid">
        ${metricHtml(uiLabel("Confidence"), scoreSignal(r.decision.confidence))}
        ${metric(uiLabel("Current Price"), money(state.company.quote?.price, 2))}
        ${metricHtml(uiLabel("Composite FV"), fairValueSignal(r.valuation.compositeFairValue, state.company.quote?.price))}
        ${metricHtml(uiLabel("Margin of Safety"), upsideSignal(r.valuation.marginOfSafety))}
      </div>
    </section>
    <section class="score-strip">
      ${scorePill(financialTerm("Quality"), r.quality.score, scoreColorCategory(r.quality.score))}
      ${scorePill(financialTerm("Growth"), r.growth.score, scoreColorCategory(r.growth.score))}
      ${scorePill(financialTerm("Management"), r.management.grade, scoreColorCategory(r.management.score))}
      ${scorePill(financialTerm("Moat"), ratingLabel(r.moat.rating), scoreColorCategory(r.moat.score))}
      ${scorePill(financialTerm("Risk"), ratingLabel(r.risk.rating), riskColorCategory(r.risk.score))}
      ${scorePill(uiLabel("Data"), r.dataCompleteness.score, scoreColorCategory(r.dataCompleteness.score))}
    </section>
  `;
}

function panelContent(state) {
  if (state.activePanel === "external-import") return externalImportPanel(state);
  if (state.activePanel === "external-report") return externalAnalysisReportView(state);
  if (state.activePanel === "strengths-risks") return strengthsRisksPage(state);
  if (state.activePanel === "company-profile") return companyProfileView(state);
  if (state.activePanel === "quarterly-scorecard") return quarterlyScorecardView(state);
  if (state.activePanel === "history") return externalHistoryPanel(state);
  if (state.activePanel === "settings") return settingsPanel(state);
  return externalAnalysesHomeSection(state);
}

function externalImportPanel(state) {
  const draft = state.externalImport?.draftReport;
  const validation = state.externalImport?.validation || { errors: [], warnings: [] };
  const completion = draft ? draft.completionStatus || analyzeExternalAnalysisCompletion(draft, validation) : null;
  const visibleValidation = visibleExternalValidation(validation, completion);
  return `
    <section class="panel external-import-panel library-import-panel">
      <div class="external-import-head">
        <div>
          <p class="eyebrow">${uiLabel("Import Analysis")}</p>
          <h2>${uiLabel("Paste external research")}</h2>
          <p>${uiLabel("Paste a completed ChatGPT analysis. Franklin parses, previews, saves, then opens the report. It does not create the analysis.")}</p>
        </div>
        <button class="icon-btn" data-action="cancel-external-import">${uiLabel("Cancel")}</button>
      </div>
      <div class="external-import-flow" aria-label="${uiLabel("Import flow")}">
        ${flowStep("1", uiLabel("Paste"))}
        ${flowStep("2", uiLabel("Parse"))}
        ${flowStep("3", uiLabel("Preview"))}
        ${flowStep("4", uiLabel("Save"))}
        ${flowStep("5", uiLabel("Open Report"))}
      </div>
      <div class="external-import-context">
        <label>
          <span>${uiLabel("Ticker Symbol")}</span>
          <input data-external-ticker-hint dir="ltr" autocomplete="off" autocapitalize="characters" inputmode="latin-prose" maxlength="12" required placeholder="AMZN" value="${escapeHtml(state.externalImport?.tickerHint || "")}">
        </label>
        <p>${uiLabel("Use this when the pasted report does not clearly include the ticker.")}</p>
      </div>
      ${externalChatGptPrepCard(state)}
      <textarea class="paste-box external-paste-box" data-external-raw dir="auto" placeholder="${uiLabel("Paste completed ChatGPT analysis or ExternalAnalysisReport JSON here.")}">${escapeHtml(state.externalImport?.rawText || "")}</textarea>
      <div class="external-import-actions">
        <button class="primary-btn" data-action="parse-external-analysis" ${state.loading ? "disabled" : ""}>${state.loading ? uiLabel("Parsing") : uiLabel("Parse Analysis")}</button>
        <button class="icon-btn" data-action="clear-external-import">${uiLabel("Clear")}</button>
      </div>
      ${state.externalImport?.parserSource ? `<p class="muted">${uiLabel("Parser")}: ${escapeHtml(state.externalImport.parserSource)} / ${state.externalImport.usedAi ? "AI Parser" : "Local JSON"}</p>` : ""}
      ${draft && completion?.status !== "complete" ? missingDataCompletionCard(draft, validation, completion, state) : ""}
      ${visibleValidation.errors.length ? validationList(uiLabel("Validation Errors"), visibleValidation.errors, "negative") : ""}
      ${visibleValidation.warnings.length ? validationList(uiLabel("Validation Warnings"), visibleValidation.warnings, "warning") : ""}
      ${state.externalImport?.duplicate ? duplicateWarning(state.externalImport.duplicate) : ""}
      ${state.externalImport?.supplement?.open ? supplementaryInputPanel(draft, completion, state) : ""}
      ${state.externalImport?.missingManualOpen ? missingManualPanel(draft, completion) : ""}
      ${draft ? externalPreviewPanel(draft, state) : ""}
    </section>
  `;
}

function flowStep(number, label) {
  return `
    <div class="flow-step">
      <b>${escapeHtml(number)}</b>
      <span>${escapeHtml(label)}</span>
    </div>
  `;
}

function externalChatGptPrepCard(state) {
  const requiredFields = FIELD_REQUIREMENTS.filter((field) => field.priority === FIELD_PRIORITY.CRITICAL);
  return `
    <section class="chatgpt-prep-card">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("ChatGPT Contract")}</p>
          <h3>${uiLabel("جهّز ChatGPT قبل اللصق")}</h3>
          <p>${uiLabel("Copy the official prompt, send it to ChatGPT, then paste the JSON response here.")}</p>
        </div>
        <div class="prep-actions">
          <button class="primary-btn" data-action="copy-full-analysis-prompt">${uiLabel("نسخ برومبت تحليل السهم")}</button>
        </div>
      </div>
      <details class="required-fields-guide advanced-options-guide">
        <summary>${uiLabel("Advanced Options")}</summary>
        <div class="advanced-helper-actions">
          <button class="icon-btn" data-action="copy-external-json-template">${uiLabel("نسخ JSON Template")}</button>
          <span>${uiLabel("Use only if ChatGPT asks for the raw JSON shape.")}</span>
        </div>
        <h4>${uiLabel("Required fields before saving")} (${requiredFields.length})</h4>
        <div class="required-field-chips">
          ${requiredFields.map((field) => `<span><b>${escapeHtml(field.labelAr)}</b><em dir="ltr">${escapeHtml(field.path)}</em></span>`).join("")}
        </div>
      </details>
      ${state.externalImport?.copyFallbackText ? `
        <div class="clipboard-fallback">
          <p class="muted">${escapeHtml(state.externalImport.copyFallbackTitle || uiLabel("Clipboard fallback"))}</p>
          <textarea readonly data-copy-fallback-text>${escapeHtml(state.externalImport.copyFallbackText)}</textarea>
          <button class="icon-btn" data-action="select-copy-fallback">${uiLabel("Select All")}</button>
          <button class="icon-btn" data-action="${escapeHtml(state.externalImport.copyFallbackAction || "copy-full-analysis-prompt")}">${uiLabel("Copy Again")}</button>
        </div>
      ` : ""}
    </section>
  `;
}

function missingDataCompletionCard(report, validation, completion, state) {
  const critical = completion.details?.criticalRequired || [];
  const recommended = completion.details?.recommended || [];
  const visibleValidation = visibleExternalValidation(validation, completion);
  return `
    <section class="missing-data-sheet">
      <div class="missing-data-head">
        <div>
          <p class="eyebrow">${uiLabel("Data Completion")}</p>
          <h3>${uiLabel("بيانات التقرير غير مكتملة")}</h3>
          <p>${completion.requiredComplete} ${uiLabel("of")} ${completion.requiredTotal} ${uiLabel("required fields complete")}</p>
        </div>
        <strong>${completion.completionPct}%</strong>
      </div>
      <div class="completion-track"><i style="width:${Math.max(0, Math.min(100, completion.completionPct))}%"></i></div>
      <div class="missing-data-stats">
        ${missingStat(uiLabel("Missing fields"), critical.length)}
        ${missingStat(uiLabel("Invalid fields"), visibleValidation.errors.length)}
        ${missingStat(uiLabel("Warnings"), visibleValidation.warnings.length)}
      </div>
      <div class="missing-field-list">
        ${critical.length ? critical.slice(0, 8).map(missingFieldRow).join("") : `<p class="muted">${uiLabel("No critical missing fields.")}</p>`}
      </div>
      ${recommended.length ? `<details class="report-detail"><summary>${uiLabel("Recommended missing fields")} (${recommended.length})</summary><div class="missing-field-list">${recommended.map(missingFieldRow).join("")}</div></details>` : ""}
      <div class="missing-actions">
        <button class="primary-btn" data-action="copy-missing-requirements">${uiLabel("نسخ النواقص")}</button>
        <button class="icon-btn" data-action="open-supplement-input">${uiLabel("إضافة بيانات مكملة")}</button>
        <button class="icon-btn" data-action="open-missing-manual">${uiLabel("تعديل يدوي")}</button>
        <button class="icon-btn" data-action="save-external-incomplete-draft">${uiLabel("الحفظ كمسودة")}</button>
        <button class="icon-btn" data-action="cancel-external-import">${uiLabel("Cancel")}</button>
      </div>
      ${state.externalImport?.missingPromptFallback ? `
        <div class="clipboard-fallback">
          <p class="muted">${uiLabel("Clipboard fallback")}</p>
          <textarea readonly data-copy-fallback-text>${escapeHtml(state.externalImport.missingPromptFallback)}</textarea>
          <button class="icon-btn" data-action="select-copy-fallback">${uiLabel("Select All")}</button>
          <button class="icon-btn" data-action="copy-missing-requirements">${uiLabel("Copy Again")}</button>
        </div>
      ` : ""}
    </section>
  `;
}

function missingStat(label, value) {
  return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function visibleExternalValidation(validation = {}, completion = null) {
  const missingPaths = new Set([
    ...(completion?.missingRequiredPaths || []),
    ...(completion?.missingRecommendedPaths || []),
    ...(completion?.missingOptionalPaths || [])
  ]);
  const missingErrors = new Set([
    ...missingPaths,
    ...(completion?.details?.criticalRequired || []).map((item) => item.path),
    ...(completion?.details?.recommended || []).map((item) => item.path)
  ]);
  return {
    errors: (validation.errors || []).filter((item) => !missingErrors.has(item.field)),
    warnings: (validation.warnings || []).filter(Boolean)
  };
}

function missingFieldRow(item) {
  return `
    <article class="missing-field-row">
      <div>
        <strong>${escapeHtml(item.labelAr || item.labelEn || item.path)}</strong>
        <span dir="ltr">${escapeHtml(item.path)}</span>
      </div>
      <p>${escapeHtml(item.reasonAr || "")}</p>
      <small>${escapeHtml(priorityLabel(item.priority))} / ${escapeHtml(item.expectedType || "-")}${item.currentValue ? ` / ${uiLabel("Current")}: ${escapeHtml(item.currentValue)}` : ""}</small>
    </article>
  `;
}

function supplementaryInputPanel(report, completion, state) {
  const supplement = state.externalImport?.supplement || {};
  const missing = [
    ...(completion?.details?.criticalRequired || []),
    ...(completion?.details?.recommended || [])
  ];
  return `
    <section class="supplement-sheet">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("Supplement")}</p>
          <h3>${uiLabel("إكمال البيانات الناقصة")}</h3>
          <p>${escapeHtml(report?.company?.name || "-")} / ${escapeHtml(report?.company?.ticker || "-")} / ${escapeHtml(report?.analysisDate || "-")} / ${missing.length} ${uiLabel("fields requested")}</p>
        </div>
        <button class="icon-btn" data-action="cancel-external-supplement">${uiLabel("Cancel")}</button>
      </div>
      <div class="supplement-missing-mini">
        ${missing.slice(0, 6).map((item) => `<span><b>${escapeHtml(item.labelAr || item.path)}</b><em dir="ltr">${escapeHtml(item.path)}</em></span>`).join("")}
      </div>
      <textarea class="paste-box supplement-paste-box" data-supplement-raw dir="auto" placeholder="${uiLabel("Paste supplementary ChatGPT response here.")}">${escapeHtml(supplement.rawText || "")}</textarea>
      <div class="external-import-actions">
        <button class="primary-btn" data-action="parse-external-supplement" ${state.loading ? "disabled" : ""}>${state.loading ? uiLabel("Parsing") : uiLabel("Parse Supplement")}</button>
        <button class="icon-btn" data-action="cancel-external-supplement">${uiLabel("Cancel")}</button>
      </div>
      ${supplement.validation?.errors?.length ? validationList(uiLabel("Validation Errors"), supplement.validation.errors, "negative") : ""}
      ${supplement.mergePreview ? supplementPreviewPanel(supplement.mergePreview) : ""}
    </section>
  `;
}

function supplementPreviewPanel(preview) {
  const canApply = preview.appliedFields.length || preview.conflicts.length;
  return `
    <section class="supplement-preview">
      ${preview.summary ? `<p class="supplement-preview-message">${escapeHtml(isArabicUi() ? preview.summary.messageAr : preview.summary.messageEn)}</p>` : ""}
      <div class="missing-data-stats">
        ${missingStat(uiLabel("Applied fields"), preview.appliedFields.length)}
        ${missingStat(uiLabel("Conflicts"), preview.conflicts.length)}
        ${missingStat(uiLabel("Rejected fields"), preview.rejectedFields.length)}
      </div>
      ${preview.appliedFields.length ? `<div class="supplement-applied-list">${preview.appliedFields.map((item) => `<p><b dir="ltr">${escapeHtml(item.path)}</b> ${escapeHtml(formatAnyValue(item.newValue))}</p>`).join("")}</div>` : ""}
      ${preview.conflicts.length ? `<div class="conflict-review"><h4>${uiLabel("Conflict Review")}</h4>${preview.conflicts.map(conflictRow).join("")}</div>` : ""}
      ${canApply ? `<button class="primary-btn" data-action="apply-external-supplement">${uiLabel("Merge Supplement")}</button>` : ""}
    </section>
  `;
}

function conflictRow(conflict) {
  return `
    <article class="conflict-row">
      <strong dir="ltr">${escapeHtml(conflict.path)}</strong>
      <div class="conflict-values">
        <span>${uiLabel("Current value")}<b>${escapeHtml(formatAnyValue(conflict.currentValue))}</b></span>
        <span>${uiLabel("New value")}<b>${escapeHtml(formatAnyValue(conflict.newValue))}</b></span>
      </div>
      <div class="missing-actions">
        <button class="icon-btn" data-conflict-path="${escapeHtml(conflict.path)}" data-conflict-resolution="keep-current">${uiLabel("Keep current")}</button>
        <button class="icon-btn" data-conflict-path="${escapeHtml(conflict.path)}" data-conflict-resolution="use-new">${uiLabel("Use new")}</button>
        <input data-conflict-manual="${escapeHtml(conflict.path)}" placeholder="${uiLabel("Manual value")}">
        <button class="icon-btn" data-conflict-path="${escapeHtml(conflict.path)}" data-conflict-resolution="manual">${uiLabel("Manual")}</button>
      </div>
    </article>
  `;
}

function missingManualPanel(report, completion) {
  const missing = [
    ...(completion?.details?.criticalRequired || []),
    ...(completion?.details?.recommended || [])
  ];
  return `
    <section class="manual-missing-panel">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("Manual Edit")}</p>
          <h3>${uiLabel("تعديل الحقول الناقصة")}</h3>
        </div>
      </div>
      <div class="external-preview-grid">
        ${missing.map((item) => externalInput(item.path, `${item.labelAr} / ${item.path}`, getPathValue(report, item.path), item.expectedType === "Number" ? "number" : item.expectedType === "Date" ? "date" : "text")).join("")}
      </div>
    </section>
  `;
}

function priorityLabel(priority) {
  if (priority === "critical") return uiLabel("Required");
  if (priority === "recommended") return uiLabel("Recommended");
  return uiLabel("Optional");
}

function getPathValue(object, path) {
  return String(path || "").split(".").filter(Boolean).reduce((cursor, key) => cursor?.[key], object);
}

function externalPreviewPanel(report, state) {
  return `
    <section class="external-preview">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("Preview")}</p>
          <h3>${uiLabel("Review before saving")}</h3>
          <p>${escapeHtml(report.company?.ticker || "-")} / ${escapeHtml(report.company?.name || "-")}</p>
        </div>
        <div class="external-import-actions">
          <button class="primary-btn" data-action="save-external-analysis" ${state.externalImport?.validation?.valid ? "" : "disabled"}>${uiLabel("حفظ السهم")}</button>
          ${state.externalImport?.duplicate ? `<button class="icon-btn warning-action" data-action="save-external-analysis-duplicate">${uiLabel("Save duplicate anyway")}</button>` : ""}
        </div>
      </div>
      <div class="quick-summary-card preview-summary">
        ${metricHtml("Ticker", escapeHtml(report.company?.ticker || "-"))}
        ${metricHtml(uiLabel("Analysis Date"), escapeHtml(report.analysisDate || "-"))}
        ${metricHtml(uiLabel("Price at Analysis"), money(report.fairValueSummary?.currentPrice, 2))}
        ${metricHtml("Base Fair Value", money(report.fairValueSummary?.fairValueBase, 0))}
        ${metricHtml(uiLabel("Verdict"), escapeHtml(report.decision?.action || "-"))}
      </div>
      ${historicalRequirementMatchPreview(state.externalImport?.requirementMatch)}
      <div class="external-preview-grid">
        ${externalInput("company.ticker", "Ticker", report.company?.ticker)}
        ${externalInput("company.name", uiLabel("Company"), report.company?.name)}
        ${externalInput("analysisDate", uiLabel("Analysis Date"), report.analysisDate, "date")}
        ${externalInput("reportPeriod", uiLabel("Report Period"), report.reportPeriod)}
        ${externalInput("fairValueSummary.currentPrice", uiLabel("Price at Analysis"), report.fairValueSummary?.currentPrice, "number")}
        ${externalInput("fairValueSummary.fairValueLow", "Bear Fair Value", report.fairValueSummary?.fairValueLow, "number")}
        ${externalInput("fairValueSummary.fairValueBase", "Base Fair Value", report.fairValueSummary?.fairValueBase, "number")}
        ${externalInput("fairValueSummary.fairValueHigh", "Bull Fair Value", report.fairValueSummary?.fairValueHigh, "number")}
        ${externalInput("decision.action", uiLabel("Verdict"), report.decision?.action)}
      </div>
      <div class="external-text-editors">
        <label>${uiLabel("Investment Thesis")}<textarea data-external-field="thesis.shortSummary" dir="auto">${escapeHtml(report.thesis?.shortSummary || "")}</textarea></label>
        <label>${uiLabel("Decision Rationale")}<textarea data-external-field="decision.rationale" dir="auto">${escapeHtml(report.decision?.rationale || "")}</textarea></label>
      </div>
      <details class="report-detail advanced-json-block">
        <summary>${uiLabel("Advanced JSON")}</summary>
        <div>
          <p class="muted">${uiLabel("Advanced editor. Edit any field in JSON, then leave the field to re-validate.")}</p>
          <textarea class="paste-box external-json-editor" data-external-json dir="ltr">${escapeHtml(state.externalImport?.draftJson || JSON.stringify(report, null, 2))}</textarea>
        </div>
      </details>
    </section>
  `;
}

function externalInput(path, label, value, type = "text") {
  const direction = type === "number" || type === "date" ? "ltr" : "auto";
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input data-external-field="${escapeHtml(path)}" type="${type}" dir="${direction}" value="${escapeHtml(value ?? "")}">
    </label>
  `;
}

function duplicateWarning(report) {
  return `
    <div class="validation-list warning">
      <strong>${uiLabel("This analysis already exists.")}</strong>
      <p>${escapeHtml(report.company?.ticker || "")} / ${escapeHtml(report.analysisDate || "")} / ${escapeHtml(report.reportPeriod || "")}</p>
    </div>
  `;
}

function validationList(title, items, tone) {
  return `
    <div class="validation-list ${tone}">
      <strong>${escapeHtml(title)}</strong>
      ${items.map((item) => `<p><span dir="ltr">${escapeHtml(item.field)}</span>: ${escapeHtml(localizedValidationMessage(item))}</p>`).join("")}
    </div>
  `;
}

function localizedValidationMessage(item = {}) {
  const field = item.field || "";
  const message = item.message || "";
  const messages = {
    "company.ticker": "رمز السهم مطلوب ويجب أن يكون رمزًا صحيحًا في السوق.",
    analysisDate: "تاريخ التحليل مطلوب ويجب أن يكون تاريخًا صحيحًا.",
    "market.priceAtAnalysis": "السعر وقت التحليل مطلوب ويجب أن يكون أكبر من صفر.",
    "scores.quality": "Quality Score إذا كان موجودًا يجب أن يكون بين 0 و10.",
    "scores.growth": "Growth Score إذا كان موجودًا يجب أن يكون بين 0 و10.",
    "scores.valuation": "Valuation Score إذا كان موجودًا يجب أن يكون بين 0 و10.",
    "scores.risk": "Risk Score إذا كان موجودًا يجب أن يكون بين 0 و10.",
    "fairValueSummary.fairValueLow": "Bear Fair Value مطلوب ويجب أن يكون أكبر من صفر.",
    "fairValueSummary.fairValueBase": "Base Fair Value مطلوب ويجب أن يكون أكبر من صفر.",
    "fairValueSummary.fairValueHigh": "Bull Fair Value مطلوب ويجب أن يكون أكبر من صفر.",
    "thesis.shortSummary": "ملخص فرضية الاستثمار مطلوب.",
    risks: "يجب إدخال مخاطرة رئيسية واحدة على الأقل.",
    "decision.action": "التوصية النهائية مطلوبة ويجب أن تكون مذكورة في التحليل.",
    schemaVersion: "صيغة الرد غير صحيحة. يجب أن يكون schemaVersion مطابقًا لمسار الاستكمال.",
    ticker: "رمز السهم في الرد التكميلي غير صحيح أو لا يطابق التقرير الحالي. لا تستخدم TICKER أو SYMBOL.",
    targetAnalysisId: "الرد التكميلي لا يخص هذا التقرير الحالي.",
    fields: "لم يُرجع ChatGPT أي قيم غير فارغة للحقول المطلوبة.",
    supplement: "تعذر قراءة الرد التكميلي. الصق JSON فقط أو ردًا يحتوي على JSON واضح.",
    source: "المصدر ليس ChatGPT. احتفظ بهذا فقط إذا كان التحليل الملصوق يذكر مصدرًا آخر صراحة.",
    analysisOrigin: "تقارير الاستيراد الخارجي يجب أن تبقى مرتبطة بمسار ChatGPT الخارجي.",
    fairValue: "ترتيب Fair Value يجب أن يكون: Bear <= Base <= Bull."
  };
  if (field === "fields" && message.includes("Unknown supplement field path")) return "بعض الحقول لا تطابق مسارات معروفة في Schema التحليل.";
  if (field === "fields" && message.includes("non-empty values")) return "لم يُرجع ChatGPT أي قيم غير فارغة للحقول المطلوبة.";
  if (messages[field]) return messages[field];
  if (message.includes("must be between 0 and 10")) return "القيمة يجب أن تكون بين 0 و10.";
  if (message.includes("must be an array")) return "القيمة يجب أن تكون قائمة عناصر.";
  if (message.includes("NaN or Infinity")) return "الأرقام غير الصالحة مثل NaN أو Infinity غير مقبولة.";
  if (message.includes("positive number")) return "القيمة يجب أن تكون رقمًا موجبًا.";
  return message;
}

function externalHistoryPanel(state) {
  const reports = Object.values(state.externalAnalyses || {})
    .flatMap((items) => Array.isArray(items) ? items : [])
    .sort((a, b) => String(b.analysisDate || "").localeCompare(String(a.analysisDate || "")));
  return `
    <section class="panel history-library-panel">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("History")}</p>
          <h2>${uiLabel("Historical Analyses")}</h2>
          <p>${uiLabel("Review prior saved analyses. Drafts are never shown here.")}</p>
        </div>
      </div>
      ${reports.length ? `
        <div class="history-report-list">
          ${reports.map((report) => `
            <button class="history-analysis-card" data-external-ticker="${escapeHtml(report.company?.ticker || "")}" data-external-report-id="${escapeHtml(report.id || "")}" data-external-history-ticker="${escapeHtml(report.company?.ticker || "")}" data-external-history-id="${escapeHtml(report.id || "")}">
              <span class="history-card-head">
                <span class="history-company-title">
                  <strong dir="ltr"><bdi>${escapeHtml(report.company?.ticker || "-")}</bdi></strong>
                  <b dir="auto"><bdi>${escapeHtml(report.company?.name || "-")}</bdi></b>
                </span>
                <em>${escapeHtml(localizedExternalText(report.decision?.action) || "-")}</em>
              </span>
              <span class="history-card-date" dir="auto"><bdi>${escapeHtml(report.analysisDate || "-")}</bdi>${report.reportPeriod ? ` · <bdi>${escapeHtml(report.reportPeriod)}</bdi>` : ""}</span>
              <span class="history-card-values">
                <span><small>${uiLabel("Price at Analysis")}</small><strong dir="ltr"><bdi>${money(report.fairValueSummary?.currentPrice, 2)}</bdi></strong></span>
                <span><small>${uiLabel("Base Fair Value")}</small><strong dir="ltr"><bdi>${money(report.fairValueSummary?.fairValueBase, 0)}</bdi></strong></span>
              </span>
              <span class="history-card-action">${uiLabel("Open saved report")} <b aria-hidden="true">›</b></span>
            </button>
          `).join("")}
        </div>
      ` : externalLibraryEmptyState()}
    </section>
  `;
}

function companyProfileView(state) {
  const selection = state.externalReportSelection || {};
  const report = getExternalAnalysis(state.externalAnalyses || {}, selection.ticker, selection.reportId);
  const profile = report?.companyProfile;
  if (!report) {
    return `
      <section class="panel empty-home-state">
        <strong>${uiLabel("No imported report selected.")}</strong>
        <button class="primary-btn" data-panel="home">${uiLabel("Back to My Stocks")}</button>
      </section>
    `;
  }
  if (!hasReadableCompanyProfile(profile)) {
    return `
      <section class="panel empty-home-state company-profile-empty">
        <p class="eyebrow">${uiLabel("Company Profile")}</p>
        <strong>${uiLabel("Company profile unavailable")}</strong>
        <p>${uiLabel("This saved analysis does not include an educational company profile.")}</p>
        <button class="primary-btn" data-action="copy-full-analysis-prompt">${uiLabel("نسخ برومبت تحليل السهم")}</button>
        <button class="icon-btn" data-panel="home">${uiLabel("Back to My Stocks")}</button>
      </section>
    `;
  }
  const ticker = report.company?.ticker || "-";
  const companyName = report.company?.name || ticker;
  return `
    <section class="external-report-shell company-profile-shell">
      <header class="panel company-profile-header">
        <div>
          <p class="eyebrow">${uiLabel("Company Profile")}</p>
          <h2>${escapeHtml(companyName)}</h2>
          <strong dir="ltr">${escapeHtml(ticker)}</strong>
        </div>
        <button class="icon-btn" data-action="open-profile-report" data-profile-report-ticker="${escapeHtml(ticker)}" data-profile-report-id="${escapeHtml(report.id)}">${uiLabel("Open report")}</button>
      </header>
      <section class="company-profile-grid">
        ${companyProfileSection(uiLabel("What does the company do?"), profile.summary)}
        ${companyProfileSection(uiLabel("How does the company make money?"), profile.businessModel)}
        ${companyActivitiesSection(profile.activities)}
        ${companyProfileSection(uiLabel("Who are its customers?"), profile.customers)}
        ${companyGrowthDriversSection(profile.mainGrowthDrivers)}
      </section>
    </section>
  `;
}

function hasReadableCompanyProfile(profile = null) {
  if (!profile || typeof profile !== "object") return false;
  return Boolean(
    localizedExternalText(profile.summary).trim()
    || localizedExternalText(profile.businessModel).trim()
    || localizedExternalText(profile.customers).trim()
    || (Array.isArray(profile.activities) && profile.activities.length)
    || (Array.isArray(profile.mainGrowthDrivers) && profile.mainGrowthDrivers.length)
  );
}

function companyProfileSection(title, value) {
  const text = localizedExternalText(value);
  if (!text.trim()) return "";
  return `
    <article class="panel company-profile-section">
      <h3>${escapeHtml(title)}</h3>
      <p class="mixed-direction-text" dir="auto">${mixedDirectionMarkup(text)}</p>
    </article>
  `;
}

function companyActivitiesSection(activities = []) {
  if (!Array.isArray(activities) || !activities.length) return "";
  return `
    <article class="panel company-profile-section company-activities-section">
      <h3>${uiLabel("Company Activities")}</h3>
      <div class="company-activity-list">
        ${activities.map((activity) => `
          <section class="company-activity-card">
            <div>
              <strong class="mixed-direction-text" dir="auto">${mixedDirectionMarkup(companyActivityTitle(activity))}</strong>
              ${companyActivitySubtitle(activity) ? `<span class="mixed-direction-text" dir="auto">${mixedDirectionMarkup(companyActivitySubtitle(activity))}</span>` : ""}
            </div>
            ${localizedExternalText(activity.description).trim() ? `
              <p class="mixed-direction-text" dir="auto"><b>${uiLabel("What is it?")}</b> ${mixedDirectionMarkup(activity.description)}</p>
            ` : ""}
            ${localizedExternalText(activity.importance).trim() ? `
              <p class="mixed-direction-text" dir="auto"><b>${uiLabel("Why does it matter?")}</b> ${mixedDirectionMarkup(activity.importance)}</p>
            ` : ""}
          </section>
        `).join("")}
      </div>
    </article>
  `;
}

function companyActivityTitle(activity = {}) {
  const title = localizedExternalText({ ar: activity.arabicName, en: activity.name, text: activity.name || activity.arabicName });
  return title || "-";
}

function companyActivitySubtitle(activity = {}) {
  const title = companyActivityTitle(activity);
  const alternate = localizedExternalText(isArabicUi() ? activity.name : activity.arabicName);
  return alternate && alternate !== title ? alternate : "";
}

function companyGrowthDriversSection(drivers = []) {
  const visible = Array.isArray(drivers) ? drivers.map((item) => localizedExternalText(item)).filter((item) => item.trim()) : [];
  if (!visible.length) return "";
  return `
    <article class="panel company-profile-section">
      <h3>${uiLabel("Main Growth Drivers")}</h3>
      <ul>${visible.map((item) => `<li class="mixed-direction-text" dir="auto">${mixedDirectionMarkup(item)}</li>`).join("")}</ul>
    </article>
  `;
}

function externalAnalysisReportView(state) {
  const selection = state.externalReportSelection || {};
  const report = getExternalAnalysis(state.externalAnalyses || {}, selection.ticker, selection.reportId);
  if (!report) {
    return `
      <section class="panel empty-home-state">
        <strong>${uiLabel("No imported report selected.")}</strong>
        <button class="primary-btn" data-action="open-external-import">${uiLabel("Import ChatGPT Analysis")}</button>
      </section>
    `;
  }
  const reportWithCompletion = externalReportWithCompletionStatus(report);
  const history = state.externalAnalyses?.[report.company?.ticker] || [];
  const requirementSets = state.historicalRequirementSets?.[report.company?.ticker] || [];
  const completion = reportWithCompletion.completionStatus;
  const ticker = report.company?.ticker || "-";
  return `
    <section class="external-report-shell external-report-v2 stock-decision-workspace">
      ${stockDecisionHeader(reportWithCompletion, completion)}
      ${dataHealthTerminalGuard(reportWithCompletion, completion)}
      <section class="stock-decision-flow">
        ${valuationRangeDashboard(report)}
        ${canonicalFinancialCycleSection(report)}
        ${stockSection(isArabicUi() ? "فرصة الاستثمار • Investment Opportunity" : "Investment Opportunity", investmentSummaryWorkspace(report), "investment-opportunity-section")}
        ${companyAssessmentPanel(report)}
        ${stockSection(isArabicUi() ? "بيانات الاستثمار" : "Investment Data", investmentDataTableArea(report), "v31-investment-tabs-section")}
        ${latestEarningsWorkspace(report)}
        ${estimateRevisionsCard(report.estimateRevisions)}
        ${strengthsRisksEntry(report)}
        ${stockSection(uiLabel("المحفزات"), catalystsDashboard(report))}
        ${stockSection(uiLabel("قائمة المتابعة"), monitoringChecklistDashboard(report))}
        ${stockSection(uiLabel("الحكم الاستثماري"), finalDecisionDashboard(report))}
        ${stockSection(uiLabel("السجل والمصادر"), `
          ${compactTechnicalDetails(reportWithCompletion, completion, history, requirementSets)}
          ${externalDetail(uiLabel("Raw Analysis"), `<pre class="raw-analysis">${escapeHtml(report.rawAnalysisOriginal || report.rawAnalysis || "")}</pre>`)}
        `)}
      </section>
      <section class="panel external-report-actions">
        <button class="primary-btn" data-action="add-external-analysis-for-ticker" data-external-ticker="${escapeHtml(ticker)}">${uiLabel("تحديث التحليل")}</button>
        <button class="primary-btn" data-action="open-earnings-update">${uiLabel("Analyze New Earnings")}</button>
        <button class="icon-btn" data-panel="home">${uiLabel("Back to My Stocks")}</button>
        <details class="report-actions-menu">
          <summary>${uiLabel("More")} •••</summary>
          <div>
            <button class="icon-btn" data-action="edit-external-report" data-external-ticker="${escapeHtml(ticker)}" data-external-report-id="${escapeHtml(report.id)}">${uiLabel("Edit Current Report")}</button>
            <button class="icon-btn" data-action="open-earnings-update">${uiLabel("Import Update")}</button>
            <button class="icon-btn" data-panel="history">${uiLabel("History")}</button>
            <button class="icon-btn" data-action="export-external-json">${uiLabel("Export JSON")}</button>
            <button class="icon-btn" data-action="print-external-report">${uiLabel("Print Report")}</button>
            <button class="icon-btn danger-action" data-action="delete-external-report" data-external-ticker="${escapeHtml(ticker)}" data-external-report-id="${escapeHtml(report.id)}">${uiLabel("Delete version")}</button>
            <button class="icon-btn danger-action" data-action="delete-external-ticker" data-external-ticker="${escapeHtml(ticker)}">${uiLabel("Delete all analyses for ticker")}</button>
          </div>
        </details>
      </section>
      ${earningsUpdateDrawer(state)}
    </section>
  `;
}

function quarterlyScorecardView(state) {
  const selection = state.quarterlyScorecard || {};
  const scorecard = buildQuarterlyScorecard({
    historicalRequirementSets: state.historicalRequirementSets,
    externalAnalyses: state.externalAnalyses,
    ticker: selection.ticker,
    year: selection.year
  });
  if (!scorecard?.rows?.length) {
    return `
      <section class="panel quarterly-scorecard-empty">
        <h2>${uiLabel("Quarterly Scorecard")}</h2>
        <p>${uiLabel("No quarterly requirement history is available for this stock.")}</p>
        <button class="primary-btn" data-action="close-quarterly-scorecard">${uiLabel("Back to report")}</button>
      </section>
    `;
  }
  const selected = selectedScorecardCell(scorecard, selection);
  const isDefaultSelection = !selection.selectedMetricKey || !selection.selectedQuarter;
  return `
    <section class="quarterly-scorecard-shell" data-scorecard-ticker="${escapeHtml(scorecard.ticker)}" data-scorecard-year="${escapeHtml(scorecard.year)}">
      ${quarterlyScorecardHeader(scorecard)}
      ${quarterlyAnnualSummary(scorecard)}
      <div class="quarterly-scorecard-layout">
        <section class="quarterly-scorecard-main panel">
          ${quarterlyDesktopMatrix(scorecard)}
          ${quarterlyMobileCards(scorecard)}
        </section>
        ${quarterlyDetailPanel(selected, isDefaultSelection)}
      </div>
    </section>
  `;
}

function quarterlyScorecardHeader(scorecard = {}) {
  return `
    <header class="panel quarterly-scorecard-header">
      <div class="quarterly-scorecard-titlebar">
        <button class="scorecard-back" data-action="close-quarterly-scorecard" aria-label="${uiLabel("Back to report")}">‹</button>
        <div>
          <span>${escapeHtml(scorecard.companyName || scorecard.ticker)}</span>
          <h2>${uiLabel("Quarterly Scorecard")}</h2>
          <strong dir="ltr">${escapeHtml(scorecard.ticker)}</strong>
        </div>
        <label class="scorecard-year-select">
          <span>${uiLabel("Year")}</span>
          <select data-scorecard-year>
            ${scorecard.years.map((year) => `<option value="${year}" ${year === scorecard.year ? "selected" : ""}>${year}</option>`).join("")}
          </select>
        </label>
      </div>
      <div class="quarterly-scorecard-targets">
        ${scorecard.fairValue ? `
          ${scorecardTargetMetric("Bear", scorecard.fairValue.bear, "failed")}
          ${scorecardTargetMetric("Base", scorecard.fairValue.base, "partial")}
          ${scorecardTargetMetric("Bull", scorecard.fairValue.bull, "passed")}
        ` : ""}
        ${scorecardTargetMetric(uiLabel("Target"), scorecard.target?.value, "target")}
      </div>
      <div class="quarterly-scorecard-actions">
        <button class="icon-btn" data-action="download-quarterly-scorecard">${uiLabel("Download PNG")}</button>
        <button class="primary-btn" data-action="share-quarterly-scorecard">${uiLabel("Share")}</button>
      </div>
    </header>
  `;
}

function scorecardTargetMetric(label, value, tone) {
  if (!Number.isFinite(numericValue(value))) return "";
  return `<article class="${escapeHtml(tone)}"><span>${escapeHtml(label)}</span><strong dir="ltr">${money(value, 0)}</strong></article>`;
}

function quarterlyAnnualSummary(scorecard = {}) {
  return `
    <section class="panel quarterly-annual-summary">
      <header>
        <div>
          <span>${uiLabel("Annual execution")}</span>
          <strong>${escapeHtml(quarterlyTrajectoryLabel(scorecard.trajectory))}</strong>
        </div>
        ${scorecard.overallStatus ? `<b>${escapeHtml(requirementsStatusLabel(scorecard.overallStatus))}</b>` : ""}
      </header>
      <div class="quarterly-progress-grid">
        ${scorecard.quarters.map((quarter) => `
          <article class="${quarter.evaluated ? "reported" : "awaiting"} ${quarter.quarter === scorecard.latestReportedQuarter ? "latest" : ""}">
            <span dir="ltr">Q${quarter.quarter}</span>
            <strong dir="ltr">${quarter.evaluated && Number.isFinite(quarter.weightedAchievement) ? `${Math.round(quarter.weightedAchievement)}%` : "—"}</strong>
            <small>${quarter.evaluated ? uiLabel("Reported") : uiLabel("Awaiting report")}</small>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function quarterlyDesktopMatrix(scorecard = {}) {
  return `
    <div class="quarterly-desktop-matrix">
      <table>
        <thead><tr>
          <th>${uiLabel("Metric")}</th>
          <th>${uiLabel("Required")}</th>
          ${scorecard.quarters.map((quarter) => `<th class="${quarter.quarter === scorecard.latestReportedQuarter ? "latest" : ""}" dir="ltr">Q${quarter.quarter}</th>`).join("")}
          <th>${uiLabel("Trend")}</th>
        </tr></thead>
        <tbody>
          ${scorecard.rows.map((row) => `
            <tr>
              <th>${scorecardMetricLabel(row)}</th>
              <td dir="ltr">${escapeHtml(scorecardRequiredText(latestScorecardCell(row.cells)))}</td>
              ${scorecard.quarters.map((quarter) => quarterlyDesktopCell(row, quarter, scorecard.latestReportedQuarter)).join("")}
              <td>${scorecardDirection(latestReportedScorecardCell(row.cells))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function quarterlyDesktopCell(row, quarter, latestReportedQuarter) {
  const cell = row.cells?.[quarter.quarter];
  const disabled = !cell?.reported;
  return `
    <td class="scorecard-quarter-cell ${cell ? scorecardStatusClass(cell.status) : "not-reported"} ${quarter.quarter === latestReportedQuarter ? "latest" : ""}">
      <button data-scorecard-metric="${escapeHtml(row.key)}" data-scorecard-quarter="${quarter.quarter}" ${disabled ? "disabled" : ""}>
        <strong dir="auto">${escapeHtml(scorecardActualText(cell))}</strong>
        <span>${escapeHtml(scorecardStatusLabel(cell?.status))}</span>
      </button>
    </td>
  `;
}

function quarterlyMobileCards(scorecard = {}) {
  return `
    <div class="quarterly-mobile-cards">
      ${scorecard.rows.map((row) => `
        <article class="quarterly-metric-card">
          <header>
            ${scorecardMetricLabel(row)}
            <div><span>${uiLabel("Required")}</span><strong dir="ltr">${escapeHtml(scorecardRequiredText(latestScorecardCell(row.cells)))}</strong></div>
          </header>
          <div class="quarterly-mobile-quarter-grid">
            ${scorecard.quarters.map((quarter) => quarterlyMobileCell(row, quarter, scorecard.latestReportedQuarter)).join("")}
          </div>
          <footer>
            <span>${uiLabel("Trend")}</span>
            ${scorecardDirection(latestReportedScorecardCell(row.cells))}
          </footer>
        </article>
      `).join("")}
    </div>
  `;
}

function quarterlyMobileCell(row, quarter, latestReportedQuarter) {
  const cell = row.cells?.[quarter.quarter];
  return `
    <button class="${cell ? scorecardStatusClass(cell.status) : "not-reported"} ${quarter.quarter === latestReportedQuarter ? "latest" : ""}" data-scorecard-metric="${escapeHtml(row.key)}" data-scorecard-quarter="${quarter.quarter}" ${cell?.reported ? "" : "disabled"}>
      <span dir="ltr">Q${quarter.quarter}</span>
      <strong dir="auto">${escapeHtml(scorecardActualText(cell))}</strong>
      <small>${escapeHtml(scorecardStatusLabel(cell?.status))}</small>
    </button>
  `;
}

function quarterlyDetailPanel(selected, isDefaultSelection) {
  if (!selected?.cell) return "";
  const { row, cell } = selected;
  return `
    <aside class="panel quarterly-scorecard-detail ${isDefaultSelection ? "is-default" : ""}">
      <header>
        <div><span>${uiLabel("Stored quarter detail")}</span><h3>${escapeHtml(row.label)}</h3></div>
        <button data-action="close-scorecard-detail" aria-label="${uiLabel("Close")}">×</button>
      </header>
      <div class="scorecard-detail-facts">
        ${scorecardDetailFact(uiLabel("Quarter"), `Q${cell.quarter}`)}
        ${scorecardDetailFact(uiLabel("Required"), scorecardRequiredText(cell))}
        ${scorecardDetailFact(uiLabel("Actual"), scorecardActualText(cell))}
        ${scorecardDetailFact(uiLabel("Status"), scorecardStatusLabel(cell.status), scorecardStatusClass(cell.status))}
      </div>
      ${cell.evaluationNote ? `<section><span>${uiLabel("Evaluation note")}</span><p>${escapeHtml(localizedExternalText(cell.evaluationNote))}</p></section>` : `<p class="scorecard-detail-empty">${uiLabel("No stored evaluation note is available.")}</p>`}
    </aside>
  `;
}

function scorecardDetailFact(label, value, tone = "") {
  return `<article class="${escapeHtml(tone)}"><span>${escapeHtml(label)}</span><strong dir="auto">${escapeHtml(String(value || "—"))}</strong></article>`;
}

function selectedScorecardCell(scorecard, selection = {}) {
  const explicitRow = scorecard.rows.find((row) => row.key === selection.selectedMetricKey);
  const explicitCell = explicitRow?.cells?.[Number(selection.selectedQuarter)];
  if (explicitRow && explicitCell?.reported) return { row: explicitRow, cell: explicitCell };
  for (const quarter of [scorecard.latestReportedQuarter, 4, 3, 2, 1].filter(Boolean)) {
    const row = scorecard.rows.find((candidate) => candidate.cells?.[quarter]?.reported);
    if (row) return { row, cell: row.cells[quarter] };
  }
  return null;
}

function scorecardMetricLabel(row = {}) {
  return `<div class="scorecard-metric-label"><strong>${escapeHtml(row.label || "—")}</strong>${row.secondaryLabel ? `<small dir="ltr">${escapeHtml(row.secondaryLabel)}</small>` : ""}</div>`;
}

function latestScorecardCell(cells = {}) {
  return [4, 3, 2, 1].map((quarter) => cells?.[quarter]).find(Boolean) || null;
}

function latestReportedScorecardCell(cells = {}) {
  return [4, 3, 2, 1].map((quarter) => cells?.[quarter]).find((cell) => cell?.reported) || null;
}

function scorecardActualText(cell) {
  if (!cell?.reported) return "—";
  if (cell.actualDisplay) return cell.actualDisplay;
  if (cell.actualValue === null || cell.actualValue === undefined || cell.actualValue === "") return "—";
  return formatRequirementValue(cell.actualValue, cell.unit);
}

function scorecardRequiredText(cell) {
  if (!cell) return "—";
  if (cell.requiredDisplay) return cell.requiredDisplay;
  return formatRequirementThreshold(cell);
}

function scorecardStatusClass(status) {
  return String(status || "NOT_REPORTED").toLowerCase().replaceAll("_", "-");
}

function scorecardStatusLabel(status) {
  const labels = {
    EXCEEDED: uiLabel("Exceeded"),
    PASSED: uiLabel("Passed"),
    PARTIALLY_PASSED: uiLabel("Partially Passed"),
    FAILED: uiLabel("Failed"),
    NOT_REPORTED: uiLabel("Awaiting report")
  };
  return labels[String(status || "NOT_REPORTED").toUpperCase()] || uiLabel("Awaiting report");
}

function scorecardDirection(cell) {
  if (!cell?.reported) return `<span class="scorecard-trend neutral">—</span>`;
  const direction = String(cell.direction || "unknown").toLowerCase();
  if (direction === "up") return `<span class="scorecard-trend up">▲</span>`;
  if (direction === "down") return `<span class="scorecard-trend down">▼</span>`;
  if (direction === "flat") return `<span class="scorecard-trend flat">—</span>`;
  return `<span class="scorecard-trend neutral">—</span>`;
}

function quarterlyTrajectoryLabel(value) {
  if (value === "improving") return uiLabel("Improving");
  if (value === "weakening") return uiLabel("Weakening");
  if (value === "stable") return uiLabel("Stable");
  return uiLabel("Not enough reported quarters");
}

function stockDecisionHeader(report = {}, completion = {}) {
  const action = externalRecommendationAction(report);
  const current = report.fairValueSummary?.currentPrice;
  const upside = report.fairValueSummary?.upsideDownsidePercent;
  const priceAtAnalysis = report.market?.priceAtAnalysis;
  return `
    <header id="stock-report-top" class="panel stock-decision-header terminal-stock-header figma-decision-card v31-stock-decision" data-franklin-v2="true">
      <div class="v31-current-price-hero">
        <span>${isArabicUi() ? "السعر الحالي" : "Current Price"} <b aria-hidden="true">•</b> <bdi dir="ltr">Current Price</bdi></span>
        <strong dir="ltr">${money(current, 0)}</strong>
        <small>
          <bdi dir="ltr">${escapeHtml(report.market?.currency || report.company?.currency || "USD")}</bdi>
          <i aria-hidden="true">•</i>
          ${isArabicUi() ? "تاريخ التحليل" : "Analysis date"}
          <bdi dir="ltr">${escapeHtml(report.analysisDate || report.reportPeriod || "—")}</bdi>
        </small>
      </div>
      <div class="v31-recommendation-banner ${colorClass(recommendationColorCategory(action), "tone")}">
        <strong>${escapeHtml(localizedExternalText(action) || "-")}</strong>
      </div>
      <div class="v31-base-value-card">
        <div>
          <span>${isArabicUi() ? "القيمة العادلة الأساسية" : "Base Fair Value"}</span>
          <small>Base Fair Value</small>
        </div>
        <div class="v31-base-value-number">
          <strong dir="ltr">${money(report.fairValueSummary?.fairValueBase, 0)}</strong>
          <em class="${colorClass(upsideColorCategory(numericValue(upside)), "tone")}" dir="ltr">${formatExternalPercent(upside)}</em>
        </div>
        ${Number.isFinite(numericValue(priceAtAnalysis)) ? `<p>${uiLabel("Price at Analysis")}: <bdi dir="ltr">${money(priceAtAnalysis, 0)}</bdi></p>` : ""}
        ${Number.isFinite(numericValue(report.presentation?.morningstarFairValue)) ? `<p>Morningstar: <bdi dir="ltr">${money(report.presentation.morningstarFairValue, 0)}</bdi></p>` : ""}
      </div>
    </header>
  `;
}

function valuationRangeDashboard(report = {}) {
  const fairValue = report.fairValueSummary || {};
  const current = fairValue.currentPrice;
  const upside = fairValue.upsideDownsidePercent;
  const absoluteUpside = Number.isFinite(numericValue(upside)) ? `${Math.abs(numericValue(upside)).toFixed(1)}%` : "";
  const relation = Number.isFinite(numericValue(upside))
    ? numericValue(upside) >= 0
      ? (isArabicUi() ? `القيمة الأساسية تعني عائدًا متوقعًا بنسبة ${absoluteUpside}` : `Base implies expected upside of ${absoluteUpside}`)
      : (isArabicUi() ? `القيمة الأساسية تعني هبوطًا متوقعًا بنسبة ${absoluteUpside}` : `Base implies expected downside of ${absoluteUpside}`)
    : "";
  return `
    <section class="v31-report-block v31-valuation-section">
      <h3>${isArabicUi() ? "نطاق التقييم" : "Valuation Range"} <span aria-hidden="true">•</span> <bdi dir="ltr">Valuation Range</bdi></h3>
      <div class="v31-valuation-range-card">
        <div class="v31-range-line" aria-hidden="true"><i></i></div>
        <div class="v31-range-values">
          ${v31RangeMetric("Bear", fairValue.fairValueLow, "bear")}
          ${v31RangeMetric("Base", fairValue.fairValueBase, "base")}
          ${v31RangeMetric(isArabicUi() ? "السعر الحالي" : "Current", current, "current")}
          ${v31RangeMetric("Bull", fairValue.fairValueHigh, "bull")}
        </div>
        ${relation ? `<p>${escapeHtml(relation)} <span aria-hidden="true">|</span> <bdi dir="ltr">Fair Value</bdi></p>` : ""}
      </div>
    </section>
  `;
}

function canonicalFinancialCycleSection(report = {}) {
  const meta = report.metadata?.franklinV3;
  if (!meta) return "";
  const canonical = report.metadata?.franklinV3Report || {};
  const previous = canonical.valuation?.previous || {};
  const current = canonical.valuation?.current || {};
  const next = canonical.nextRequirements || {};
  const assessment = report.previousRequirementsEvaluation?.requirementsAssessment || {};
  const isRevaluation = meta.analysisType === "EARNINGS_REVALUATION";
  const body = `
    <div class="preview-summary earnings-preview-summary">
      ${isRevaluation ? compactCardMetric(uiLabel("Previous Base"), money(previous.base, 0)) : ""}
      ${compactCardMetric(uiLabel("New Base"), money(current.base ?? report.fairValueSummary?.fairValueBase, 0))}
      ${compactCardMetric(uiLabel("Valuation Review"), meta.reviewStatus || "—")}
      ${compactCardMetric(uiLabel("Thesis Status"), meta.thesisStatus || "—")}
      ${compactCardMetric(uiLabel("Current Justified Value"), money(next.currentJustifiedValue ?? report.priceTargetRequirements?.currentJustifiedValue, 0))}
      ${compactCardMetric(uiLabel("Next Target"), money(next.targetValue ?? repor…35907 tokens truncated…
        <div>
          <h4>${uiLabel("Strengths")}</h4>
          ${compactList(strengths)}
        </div>
        <div>
          <h4>${uiLabel("Weaknesses")}</h4>
          ${compactList(weaknesses)}
        </div>
      </div>
      <details class="inline-detail">
        <summary>${uiLabel("Score breakdown")}</summary>
        <div class="quality-breakdown">
          ${components.map((item) => `
            <div>
              <span>${escapeHtml(item.name)}</span>
              <strong>${Math.round(item.score || 0)}/100</strong>
              <i style="width:${clampNumber(Math.round(item.score || 0), 0, 100)}%"></i>
            </div>
          `).join("") || `<p class="muted">${uiLabel("Quality is based on confirmed inputs only.")}</p>`}
        </div>
      </details>
    </article>
  `;
}

function qualityStrengths(quality = {}, report = {}) {
  const componentStrengths = (quality.components || [])
    .filter((item) => Number(item.score) >= 70)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .map((item) => `${item.name}: ${Math.round(item.score || 0)}/100`);
  return takeReportItems(componentStrengths, report.finalInvestmentDecision?.mainPositiveDrivers, 3);
}

function qualityWeaknesses(quality = {}, report = {}) {
  const componentWeaknesses = (quality.components || [])
    .filter((item) => Number(item.score) < 70)
    .sort((a, b) => Number(a.score) - Number(b.score))
    .map((item) => `${item.name}: ${Math.round(item.score || 0)}/100`);
  return takeReportItems(componentWeaknesses, report.finalInvestmentDecision?.mainNegativeDrivers, 3);
}

function riskSnapshot(report) {
  const risks = (report.risks || []).slice(0, 5);
  return `
    <article class="report-section risk-snapshot" data-screen="Risks">
      <p class="eyebrow">${financialTerm("Risk")}</p>
      <h3>${uiLabel("Key Risks")}</h3>
      <div class="risk-card-list">
        ${risks.length ? risks.map((risk, index) => riskCard(risk, index)).join("") : `<p>${uiLabel("No verified risks were provided.")}</p>`}
      </div>
      ${shariahComplianceCard(report)}
    </article>
  `;
}

function riskCard(risk, index) {
  const label = riskSeverity(index);
  return `
    <div class="risk-card ${label.tone}">
      <div>
        <span>${escapeHtml(label.title)}</span>
        <strong>${escapeHtml(riskTitle(risk))}</strong>
      </div>
      <p>${escapeHtml(riskBody(risk))}</p>
    </div>
  `;
}

function riskSeverity(index) {
  if (index === 0) return { title: uiLabel("High"), tone: "high" };
  if (index <= 2) return { title: uiLabel("Medium"), tone: "medium" };
  return { title: uiLabel("Low"), tone: "low" };
}

function riskTitle(risk) {
  const text = normalizeReportItem(risk);
  const [title] = text.split(/[:.؛]/);
  return shortText(title || text || uiLabel("Risk"), 52);
}

function riskBody(risk) {
  const text = normalizeReportItem(risk);
  const title = riskTitle(risk);
  const body = text.replace(title, "").replace(/^[:.؛\s-]+/, "");
  return shortText(body || text || uiLabel("No verified risks were provided."), 120);
}

function shariahComplianceCard() {
  return `
    <div class="shariah-card" data-screen="Shariah Compliance">
      <span>${uiLabel("Shariah Compliance")}</span>
      <strong>${uiLabel("Data Unavailable")}</strong>
      <small>${uiLabel("No verified Shariah source was provided, so the app does not infer compliance.")}</small>
    </div>
  `;
}

function modelAssumptions(item = {}) {
  const assumptions = item.assumptions || item.inputs || item.drivers || {};
  if (typeof assumptions !== "object" || Array.isArray(assumptions) || assumptions === null) {
    return `<p class="muted">${escapeHtml(shortText(assumptions, 160))}</p>`;
  }
  if (!Object.keys(assumptions).length) return `<p class="muted">${uiLabel("Missing")}</p>`;
  return objectReport(assumptions);
}

function valuationModelsSnapshot(report) {
  const models = (report.modelSelection?.selectedModels || report.valuationModels || [])
    .filter((item) => Number.isFinite(item.fairValue ?? item.value) && Number(item.weight) > 0)
    .slice(0, 5);
  return `
    <article class="report-section" data-screen="Valuation Models">
      <p class="eyebrow">${uiLabel("Valuation Models")}</p>
      <h3>${uiLabel("Selected models only")}</h3>
      <div class="model-snapshot-list">
        ${models.length ? models.map((item) => `
          <div class="valuation-model-card">
            <div>
              <strong>${financialTerm(item.method)}</strong>
              <small>${Math.round((item.weight || 0) * 100)}% ${uiLabel("Weight")} / ${uiLabel("Confidence")} ${Math.round(item.confidence || report.executiveConclusion.confidence || 0)}%</small>
            </div>
            <span>${money(item.fairValue ?? item.value, 0)}</span>
            <p>${escapeHtml(shortText(item.explanation || item.why || uiLabel("Selected because required inputs were available."), 115))}</p>
            <details class="inline-detail">
              <summary>${uiLabel("Assumptions")}</summary>
              ${modelAssumptions(item)}
            </details>
          </div>
        `).join("") : `<p class="muted">${uiLabel("No supported valuation model could run from the available data.")}</p>`}
      </div>
    </article>
  `;
}

function forecastKpi(label, value, detail) {
  return `
    <div class="forecast-kpi">
      <span>${financialTerm(label)}</span>
      <strong>${escapeHtml(String(value ?? "—"))}</strong>
      <small>${escapeHtml(detail || "")}</small>
    </div>
  `;
}

function forecastSnapshot(report) {
  const rows = report.forecastAssumptions?.yearlyForecast || report.baseScenario?.forecast || [];
  const visible = rows.slice(0, 5);
  const maxRevenue = Math.max(...visible.map((row) => Number(row.revenue) || 0), 1);
  const latest = visible[visible.length - 1] || {};
  const first = visible[0] || {};
  return `
    <article class="report-section full forecast-snapshot" data-screen="Forecast">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">${uiLabel("Forecast")}</p>
          <h3>Revenue / Growth / Operating Margin / FCF</h3>
        </div>
        <span>${uiLabel("Five year view")}</span>
      </div>
      ${visible.length ? `
        <div class="forecast-card-grid">
          ${forecastKpi("Revenue", compact(latest.revenue), `${uiLabel("from")} ${compact(first.revenue)}`)}
          ${forecastKpi("Growth", percent(latest.revenueGrowth ?? latest.growth), uiLabel("Latest forecast year"))}
          ${forecastKpi("Operating Margin", percent(latest.operatingMargin ?? latest.margin), uiLabel("Base case"))}
          ${forecastKpi("FCF", compact(latest.freeCashFlow), `${uiLabel("from")} ${compact(first.freeCashFlow)}`)}
        </div>
        <details class="inline-detail">
          <summary>${uiLabel("Revenue Forecast")}</summary>
          <div class="forecast-bars">
            ${visible.map((row) => `
              <div>
                <span>${escapeHtml(String(row.year))}</span>
                <i style="width:${clampNumber(((Number(row.revenue) || 0) / maxRevenue) * 100, 3, 100)}%"></i>
                <strong>${compact(row.revenue)} / ${percent(row.revenueGrowth ?? row.growth)}</strong>
              </div>
            `).join("")}
          </div>
        </details>
      ` : `<p class="muted">${uiLabel("Forecast requires enough confirmed financial data.")}</p>`}
    </article>
  `;
}

function monitoringSnapshot(report) {
  const rows = (report.monitoringChecklist || []).slice(0, 6);
  return `
    <article class="report-section" data-screen="Monitoring">
      <p class="eyebrow">${uiLabel("Monitoring")}</p>
      <h3>${uiLabel("What to watch next")}</h3>
      <div class="monitoring-list monitoring-card-list">
        ${rows.length ? rows.map((item) => `
          <div>
            <div class="monitoring-card-head">
              <strong>${escapeHtml(item.metric)}</strong>
              <span>${escapeHtml(formatWorkflowValue(item.currentValue))}</span>
            </div>
            <small>${uiLabel("Expected")}: ${escapeHtml(item.expectedRange || item.expected || item.focus || "—")}</small>
            <details class="inline-detail">
              <summary>${uiLabel("Triggers")}</summary>
              <p>${uiLabel("Upgrade trigger")}: ${escapeHtml(item.upgradeTrigger || "—")}</p>
              <p>${uiLabel("Downgrade trigger")}: ${escapeHtml(item.downgradeTrigger || item.thesisBreak || "—")}</p>
            </details>
          </div>
        `).join("") : `<p class="muted">${uiLabel("Monitoring metrics appear when the report can identify them from verified inputs.")}</p>`}
      </div>
    </article>
  `;
}

function finalActionsBlock(workspace, report) {
  return `
    <article class="report-section final-actions-card" data-screen="Export">
      <p class="eyebrow">${uiLabel("Final Actions")}</p>
      <h3>${uiLabel("Approve only if the report reflects your data.")}</h3>
      <label class="notes-field">${uiLabel("Investor approval note")}<textarea data-investor-notes>${escapeHtml(workspace.investorNotes || "")}</textarea></label>
      <div class="report-actions">
        <button class="icon-btn" data-action="edit-workspace-data">${uiLabel("Edit Data and Re-run")}</button>
        <button class="primary-btn" data-action="approve-and-export" ${workspace.status === WORKFLOW_STATUS.APPROVED ? "disabled" : ""}>${uiLabel("Approve and Export")}</button>
      </div>
      <p>${escapeHtml(report.finalInvestmentDecision?.why || "")}</p>
    </article>
  `;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function reportHeadline(report, language) {
  const ticker = report.companyAndValuationDate.ticker;
  const decision = decisionLabel(report.executiveConclusion.recommendation);
  const upside = formatSignedPercent(report.executiveConclusion.expectedUpside);
  return language === "ar"
    ? `${decision} على ${ticker} مع عائد متوقع ${upside}`
    : `${decision} on ${ticker} with ${upside} expected upside`;
}

function executiveReportSummary(report, language) {
  const c = report.executiveConclusion;
  const classification = report.companyClassification.classification;
  const wacc = report.assumptionRationale.wacc;
  const capex = report.assumptionRationale.capex;
  if (language === "ar") {
    return capWords([
      `يعرض التقرير توصية ${decisionLabel(c.recommendation)} بدرجة ثقة ${Math.round(c.confidence)}% وInvestment Score ${Math.round(c.investmentScore)}.`,
      `يعتمد التقييم على تصنيف ${classification}، وRange Fair Value عند ${money(c.rangeFairValue, 0)} مقابل سعر حالي ${money(c.currentPrice, 2)}.`,
      `الفرصة الأساسية هي ${formatSignedPercent(c.expectedUpside)} عائد متوقع، بينما أعلى عائد محتمل يصل إلى ${formatSignedPercent(c.maximumUpside)} إذا تحقق السيناريو الأقوى.`,
      `${wacc?.why || ""} ${capex?.why || ""}`,
      `أهم ما يجب مراقبته هو تحقق Revenue Growth، استقرار Operating Margin، وانضباط CapEx لأن هذه الافتراضات تقود معظم قيمة DCF.`
    ].join(" "), 250);
  }
  return capWords([
    `The report assigns a ${decisionLabel(c.recommendation)} recommendation with ${Math.round(c.confidence)}% confidence and an Investment Score of ${Math.round(c.investmentScore)}.`,
    `The valuation is anchored on a ${classification} classification, with Range Fair Value of ${money(c.rangeFairValue, 0)} versus a current price of ${money(c.currentPrice, 2)}.`,
    `The core opportunity is ${formatSignedPercent(c.expectedUpside)} expected upside, while maximum upside reaches ${formatSignedPercent(c.maximumUpside)} if the strongest case materializes.`,
    `${wacc?.why || ""} ${capex?.why || ""}`,
    `The assumptions that matter most are Revenue Growth, Operating Margin stability, WACC, and CapEx discipline because they drive most of the DCF value.`
  ].join(" "), 250);
}

function capWords(text, limit) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  return words.length > limit ? `${words.slice(0, limit).join(" ")}...` : words.join(" ");
}

function investmentThesisBlock(report, language) {
  const decision = report.finalInvestmentDecision;
  const opportunities = report.catalysts || [];
  const risks = report.risks || [];
  return `
    <div class="thesis-grid">
      <div>
        <h4>${uiLabel("Why Invest")}</h4>
        ${listReport(decision.mainPositiveDrivers?.length ? decision.mainPositiveDrivers : opportunities.slice(0, 3))}
      </div>
      <div>
        <h4>${uiLabel("Why Avoid")}</h4>
        ${listReport(decision.mainNegativeDrivers?.length ? decision.mainNegativeDrivers : risks.slice(0, 3))}
      </div>
      <div>
        <h4>${uiLabel("Key Opportunities")}</h4>
        ${listReport(opportunities)}
      </div>
      <div>
        <h4>${uiLabel("Key Risks")}</h4>
        ${listReport(risks)}
      </div>
    </div>
  `;
}

function valuationSummaryBlock(report) {
  const item = report.executiveConclusion;
  return `
    <div class="valuation-summary-grid">
      ${metric(uiLabel("Current Price"), money(item.currentPrice, 2))}
      ${metricHtml("Bear", fairValueSignal(item.bearFairValue, item.currentPrice))}
      ${metricHtml("Base", fairValueSignal(item.baseFairValue, item.currentPrice))}
      ${metricHtml("Bull", fairValueSignal(item.bullFairValue, item.currentPrice))}
      ${metricHtml("Morningstar", fairValueSignal(item.morningstarFairValue, item.currentPrice))}
      ${metricHtml(uiLabel("Range FV"), fairValueSignal(item.rangeFairValue, item.currentPrice))}
      ${metricHtml(uiLabel("Expected Upside"), upsideSignal(item.expectedUpside))}
      ${metricHtml(uiLabel("Maximum Upside"), upsideSignal(item.maximumUpside))}
    </div>
  `;
}

function collapsibleReportDetails(workspace, report) {
  const details = [
    [uiLabel("Assumptions"), assumptionsReport(report.assumptionRationale)],
    ["DCF", dcfDetail(report)],
    ["WACC", waccDetail(report)],
    [uiLabel("Revenue Forecast"), forecastDetail(report.baseScenario, "revenue")],
    [uiLabel("Free Cash Flow Forecast"), forecastDetail(report.baseScenario, "freeCashFlow")],
    [uiLabel("CapEx Forecast"), capexDetail(report)],
    [uiLabel("Margins"), marginsDetail(report)],
    ["Terminal Growth", terminalGrowthDetail(report)],
    [uiLabel("Valuation Models"), valuationModelsReport(report.valuationModels, report.executiveConclusion.currentPrice)],
    ["Business Quality", businessQualityDetail(report)],
    [uiLabel("Financial Statements"), workspaceFieldsReport(workspace, ["revenue", "grossProfit", "operatingIncome", "ebitda", "netIncome", "eps", "cash", "totalDebt", "equity", "dilutedShares", "operatingCashFlow", "capex", "freeCashFlow"])],
    [uiLabel("Analyst Estimates"), workspaceFieldsReport(workspace, ["revenueEstimates", "epsEstimates", "ebitdaEstimates", "fcfEstimates", "analystTargetLow", "analystTargetAverage", "analystTargetHigh", "numberOfAnalysts"])],
    ["Morningstar", workspaceFieldsReport(workspace, ["morningstarFairValue", "morningstarMoat", "capitalAllocation", "uncertaintyRating", "starRating", "morningstarBullCase", "morningstarBaseCase", "morningstarBearCase", "morningstarKeyRisks", "analystResearchSummary", "researchDate"])],
    [uiLabel("Risks"), listReport(report.risks)],
    [uiLabel("Catalysts"), listReport(report.catalysts)],
    ["Monitoring Checklist", monitoringChecklistDetail(report)],
    [uiLabel("Historical Charts"), historicalChartsDetail(workspace)],
    [uiLabel("Sources"), sourcesDetail(workspace)]
  ];
  return `
    <section class="report-details">
      ${details.map(([title, body]) => `
        <details class="report-detail">
          <summary>${escapeHtml(title)}</summary>
          <div>${body}</div>
        </details>
      `).join("")}
      <details class="report-detail">
        <summary>${uiLabel("Input Data")}</summary>
        <article class="panel embedded-panel">
          ${VALUATION_SECTIONS.map(([sectionId, label]) => workflowSection(workspace, sectionId, label, false)).join("")}
        </article>
      </details>
      <details class="report-detail">
        <summary>${uiLabel("Data Review")}</summary>
        <article class="panel embedded-panel">${dataReviewPanel(workspace)}</article>
      </details>
      <details class="report-detail">
        <summary>${uiLabel("Override Methodology Assumption")}</summary>
        <article class="panel embedded-panel">${methodologyOverridesPanel(workspace)}</article>
      </details>
      ${workspace.versions?.length ? `<details class="report-detail"><summary>${uiLabel("Valuation Version History")}</summary><article class="panel embedded-panel">${versionHistoryPanel(workspace)}</article></details>` : ""}
    </section>
  `;
}

function dcfDetail(report) {
  const model = report.valuationModels.find((item) => item.method === "DCF");
  return model ? valuationModelsReport([model], report.executiveConclusion.currentPrice) : `<p class="muted">${uiLabel("None")}</p>`;
}

function businessQualityDetail(report) {
  const quality = report.businessQuality;
  if (!quality) return `<p class="muted">${uiLabel("None")}</p>`;
  return `
    <div class="two-col">
      ${metric("Business Quality", `${Math.round(quality.score)}/100`)}
      ${metric(uiLabel("Confidence"), `${Math.round(quality.confidence || 0)}%`)}
    </div>
    <p>${escapeHtml(quality.explanation || "")}</p>
    <div class="research-table compact-table">
      <div class="research-row head"><span>${uiLabel("Metric")}</span><span>${uiLabel("Score")}</span><span>${uiLabel("Weight")}</span></div>
      ${(quality.components || []).map((item) => `
        <div class="research-row">
          <span>${escapeHtml(item.name)}</span>
          <span>${Math.round(item.score)}/100</span>
          <span>${escapeHtml(String(item.weight))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function monitoringChecklistDetail(report) {
  const rows = report.monitoringChecklist || [];
  if (!rows.length) return `<p class="muted">${uiLabel("None")}</p>`;
  return `
    <div class="research-table compact-table">
      <div class="research-row head"><span>${uiLabel("Metric")}</span><span>${uiLabel("Current")}</span><span>${uiLabel("Focus")}</span></div>
      ${rows.map((item) => `
        <div class="research-row">
          <span>${escapeHtml(item.metric)}</span>
          <span>${item.currentValue === null || item.currentValue === undefined ? "—" : escapeHtml(String(item.currentValue))}</span>
          <span>${escapeHtml(item.focus || "")}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function waccDetail(report) {
  const item = report.assumptionRationale.wacc;
  return `
    <div class="two-col">
      ${metric("WACC", percent(item.value))}
      ${metric(uiLabel("Confidence"), `${Math.round(report.executiveConclusion.confidence)}%`)}
    </div>
    <p>${escapeHtml(item.why || "")}</p>
    ${item.source ? objectReport(item.source) : ""}
  `;
}

function forecastDetail(scenario = {}, key) {
  const rows = scenario.forecast || [];
  return `
    <div class="research-table compact-table">
      <div class="research-row head"><span>${uiLabel("Year")}</span><span>${key === "revenue" ? financialTerm("Revenue") : financialTerm("FCF")}</span><span>${uiLabel("Growth")}</span></div>
      ${rows.map((row) => `
        <div class="research-row">
          <span>${row.year}</span>
          <span>${key === "revenue" ? compact(row.revenue) : compact(row.freeCashFlow)}</span>
          <span>${percent(key === "revenue" ? row.revenueGrowth : row.fcfGrowth)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function capexDetail(report) {
  const item = report.assumptionRationale.capex;
  return `
    <div class="two-col">
      ${metric("CapEx / Revenue", percent(item.value))}
      ${metric(uiLabel("Source"), item.source || "-")}
    </div>
    <p>${escapeHtml(item.why || "")}</p>
  `;
}

function marginsDetail(report) {
  const item = report.assumptionRationale.marginForecast;
  return `
    <div class="two-col">${metric("Operating Margin", percent(item.value))}</div>
    <p>${escapeHtml(item.why || "")}</p>
  `;
}

function terminalGrowthDetail(report) {
  const item = report.assumptionRationale.terminalGrowth;
  return `
    <div class="two-col">${metric("Terminal Growth", percent(item.value))}</div>
    <p>${escapeHtml(item.why || "")}</p>
  `;
}

function workspaceFieldsReport(workspace, fieldIds = []) {
  const fields = fieldIds.map((fieldId) => {
    const definition = FIELD_DEFINITIONS.find((field) => field.id === fieldId);
    const item = workspace.inputs?.[fieldId];
    return { definition, item };
  }).filter(({ definition }) => definition);
  return `
    <div class="review-table source-table">
      ${fields.map(({ definition, item }) => `
        <div>
          <strong>${uiLabel(definition.label)}</strong>
          <span>${escapeHtml(formatWorkflowValue(item?.value))}</span>
          <small>${escapeHtml(item?.source || "-")} / ${escapeHtml(item?.sourceDate || "-")}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function historicalChartsDetail(workspace) {
  const annual = workspace.inputs?.annualPeriods?.value;
  const quarterly = workspace.inputs?.quarterlyPeriods?.value;
  if (!annual && !quarterly) return `<p class="muted">${uiLabel("Historical charts appear when confirmed historical periods are available.")}</p>`;
  return listReport([annual, quarterly].filter(Boolean));
}

function sourcesDetail(workspace) {
  const confirmed = workspace.dataReview?.confirmed || [];
  return `
    <div class="review-table source-table">
      ${confirmed.map((item) => `
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <span>${escapeHtml(item.source || "-")}</span>
          <small>${escapeHtml(item.sourceDate || "-")} / ${Math.round((item.confidence || 0) * 100)}%</small>
        </div>
      `).join("") || `<p class="muted">${uiLabel("None")}</p>`}
    </div>
  `;
}

function pastePreviewCard(workspace) {
  const preview = workspace.pastePreview;
  return `
    <article class="panel paste-preview">
      <div class="compare-head">
        <div>
          <p class="eyebrow">${uiLabel("Paste Preview")}</p>
          <h3>${uiLabel("Review parsed values before saving")}</h3>
        </div>
        <button class="primary-btn" data-action="apply-paste-preview">${uiLabel("Save parsed values")}</button>
      </div>
      <div class="review-table">
        ${preview.candidates.length ? preview.candidates.map((item) => `
          <div class="${item.ambiguous ? "uncertain" : ""}">
            <strong>${uiLabel(item.label)}</strong>
            <span>${escapeHtml(formatWorkflowValue(item.value))}</span>
            <small>${Math.round(item.confidence * 100)}% / ${item.ambiguous ? uiLabel("Needs confirmation") : uiLabel("Confirmed")}</small>
          </div>
        `).join("") : `<p class="muted">${uiLabel("No values were mapped. You can still enter fields manually.")}</p>`}
      </div>
    </article>
  `;
}

function dataReviewPanel(workspace, state) {
  const review = workspace.dataReview || {};
  return `
    <div class="review-head">
      <div>
        <p class="eyebrow">${uiLabel("Data Review")}</p>
        <h3>${uiLabel("Review extracted data")}</h3>
      </div>
      <span class="review-status ${review.canRun ? "ready" : "limited"}">${review.canRun ? uiLabel("Ready to analyze") : uiLabel("Needs Review")}</span>
    </div>
    <div class="review-score-card">
      ${miniMetric(uiLabel("Completeness"), `${review.completeness || 0}/100`)}
      ${miniMetric(uiLabel("Required Fields"), `${review.requiredConfirmed || 0}/${review.requiredTotal || 0}`)}
      ${miniMetric(uiLabel("Minimum"), `${review.minimumCompleteness || 68}/100`)}
    </div>
    ${reviewGroup(uiLabel("Confirmed"), review.confirmed?.slice(0, 12), true, "confirmed")}
    ${reviewGroup(uiLabel("Needs Review"), review.unconfirmedParsed, true, "needs-review")}
    ${reviewGroup(uiLabel("Missing"), review.missing, false, "missing")}
    ${reviewGroup(uiLabel("Conflicting Data"), review.conflicting, true, "conflict")}
    <button class="primary-btn full-action" data-action="confirm-run-analysis" ${review.canRun ? "" : "disabled"}>${uiLabel("Confirm and Run Analysis")}</button>
    ${review.canRun ? "" : `<p class="muted">${uiLabel("Confirm required fields and resolve critical issues before running the analyst.")}</p>`}
  `;
}

function reviewGroup(title, items = [], withActions, tone = "") {
  const visible = items?.length ? items : [];
  return `
    <div class="review-group ${escapeHtml(tone)}">
      <h4>${title}</h4>
      ${visible.length ? visible.map((item) => `
        <div class="review-item">
          <strong>${uiLabel(item.label)}</strong>
          <span>${escapeHtml(formatWorkflowValue(item.value))}</span>
          <small>${escapeHtml(item.source || "-")} / ${escapeHtml(item.sourceDate || "-")} / ${Math.round((item.confidence || 0) * 100)}%</small>
          ${withActions ? `<div>
            <button data-confirm-field="${escapeHtml(item.fieldId)}">${uiLabel("Confirm")}</button>
            <button data-reject-field="${escapeHtml(item.fieldId)}">${uiLabel("Reject")}</button>
            <button data-na-field="${escapeHtml(item.fieldId)}">${uiLabel("Mark as Not Available")}</button>
          </div>` : ""}
        </div>
      `).join("") : `<p class="muted">${uiLabel("None")}</p>`}
    </div>
  `;
}

function methodologyOverridesPanel(workspace) {
  const overrides = [
    ["wacc", "WACC"],
    ["terminalGrowth", "Terminal Growth"],
    ["revenueGrowth", "Revenue Growth"],
    ["operatingMargin", "Operating Margin"],
    ["capexToRevenue", "CapEx"],
    ["taxRate", "Tax Rate"],
    ["exitMultiple", "Exit Multiple"]
  ];
  return `
    <h3>${uiLabel("Override Methodology Assumption")}</h3>
    <p class="muted">${uiLabel("Advanced only. Every override is labeled and requires an investor reason.")}</p>
    <div class="override-grid">
      ${overrides.map(([key, label]) => {
        const item = workspace.overrides?.[key] || {};
        return `
          <label>${financialTerm(label)}
            <input data-override-field="${key}" data-override-key="value" value="${escapeHtml(item.value ?? "")}" placeholder="${uiLabel("New value")}">
            <input data-override-field="${key}" data-override-key="reason" value="${escapeHtml(item.reason ?? "")}" placeholder="${uiLabel("Investor reason")}">
          </label>
        `;
      }).join("")}
    </div>
  `;
}

function fixedReportPanel(workspace, state) {
  const report = workspace.report;
  const sections = [
    ["1. Company and Valuation Date", companyDateReport(report)],
    ["2. Executive Conclusion", executiveConclusionReport(report)],
    ["3. Data Quality", dataQualityReport(report)],
    ["4. Company Classification", classificationReport(report)],
    ["5. Financial Performance Review", objectReport(report.financialPerformanceReview)],
    ["6. Assumption Rationale", assumptionsReport(report.assumptionRationale)],
    ["7. Valuation Models", valuationModelsReport(report.valuationModels, report.executiveConclusion.currentPrice)],
    ["8. Bear Scenario", scenarioFixedReport(report.bearScenario, report.executiveConclusion.currentPrice)],
    ["9. Base Scenario", scenarioFixedReport(report.baseScenario, report.executiveConclusion.currentPrice)],
    ["10. Bull Scenario", scenarioFixedReport(report.bullScenario, report.executiveConclusion.currentPrice)],
    ["11. Risks", listReport(report.risks)],
    ["12. Catalysts", listReport(report.catalysts)],
    ["13. What Would Change the Valuation", listReport(report.whatWouldChangeTheValuation)],
    ["14. Final Investment Decision", finalDecisionReport(report)]
  ];
  return `
    <div class="compare-head">
      <div>
        <p class="eyebrow">${uiLabel("Fixed-Format Report")}</p>
        <h3>${uiLabel("Awaiting investor approval")}</h3>
      </div>
      <div class="report-actions">
        <button class="icon-btn" data-action="edit-workspace-data">${uiLabel("Edit Data and Re-run")}</button>
        <button class="primary-btn" data-action="approve-and-export" ${workspace.status === WORKFLOW_STATUS.APPROVED ? "disabled" : ""}>${uiLabel("Approve and Export")}</button>
      </div>
    </div>
    <label class="notes-field">${uiLabel("Investor approval note")}<textarea data-investor-notes>${escapeHtml(workspace.investorNotes || "")}</textarea></label>
    <div class="fixed-report">
      ${sections.map(([title, body]) => `
        <section>
          <h4>${escapeHtml(title)}</h4>
          ${body}
        </section>
      `).join("")}
    </div>
  `;
}

function versionHistoryPanel(workspace) {
  const [current, previous] = workspace.versions || [];
  const changes = compareValuationVersions(current, previous);
  return `
    <h3>${uiLabel("Valuation Version History")}</h3>
    <div class="version-list">
      ${(workspace.versions || []).slice(0, 8).map((version) => `
        <div>
          <strong>${escapeHtml(version.versionId)}</strong>
          <span>${escapeHtml(version.approvalStatus || version.type)}</span>
          <small>${escapeHtml(version.timestamp || "-")}</small>
        </div>
      `).join("")}
    </div>
    <h4>${uiLabel("Changes vs previous version")}</h4>
    ${changes.length ? changes.map((item) => `<p class="muted">${escapeHtml(item.label)}: ${escapeHtml(formatWorkflowValue(item.from))} → ${escapeHtml(formatWorkflowValue(item.to))}</p>`).join("") : `<p class="muted">${uiLabel("None")}</p>`}
  `;
}

function companyDateReport(report) {
  const item = report.companyAndValuationDate;
  return `<div class="two-col">
    ${metric("Ticker", item.ticker)}
    ${metric(uiLabel("Company Name"), item.companyName)}
    ${metric(uiLabel("Current Price"), money(item.currentPrice, 2))}
    ${metric(uiLabel("Valuation Date"), item.valuationDate)}
  </div>`;
}

function executiveConclusionReport(report) {
  const item = report.executiveConclusion;
  return `<div class="decision-grid">
    ${metric(uiLabel("Recommendation"), decisionLabel(item.recommendation))}
    ${metricHtml(uiLabel("Confidence"), scoreSignal(item.confidence))}
    ${metricHtml("Bear", fairValueSignal(item.bearFairValue, item.currentPrice))}
    ${metricHtml("Base", fairValueSignal(item.baseFairValue, item.currentPrice))}
    ${metricHtml("Bull", fairValueSignal(item.bullFairValue, item.currentPrice))}
    ${metricHtml("Morningstar", fairValueSignal(item.morningstarFairValue, item.currentPrice))}
    ${metricHtml(uiLabel("Range FV"), fairValueSignal(item.rangeFairValue, item.currentPrice))}
    ${metricHtml(uiLabel("Upside %"), upsideSignal(item.expectedUpside))}
  </div>
  <p>${escapeHtml(item.why || "")}</p>`;
}

function dataQualityReport(report) {
  const item = report.dataQuality;
  return `
    <div class="two-col">
      ${metric(uiLabel("Completeness"), `${item.completeness}/100`)}
      ${metric(uiLabel("Missing Data"), String(item.missingData.length))}
    </div>
    ${researchList(uiLabel("Confirmed Sources"), item.confirmedSources)}
    ${researchList(uiLabel("Important Limitations"), item.importantLimitations)}
  `;
}

function classificationReport(report) {
  const item = report.companyClassification;
  return `
    ${metric(uiLabel("Classification"), item.classification)}
    <p>${escapeHtml(item.reason)}</p>
    ${researchList(uiLabel("Suitable Valuation Models"), item.suitableValuationModels)}
    ${researchList(uiLabel("Excluded Models"), item.excludedModels.map((model) => `${model.method}: ${model.why}`))}
  `;
}

function objectReport(object = {}) {
  return `<div class="research-columns">${Object.entries(object).map(([key, value]) => metric(outputKeyLabel(key), value)).join("")}</div>`;
}

function assumptionsReport(assumptions = {}) {
  return `<div class="assumption-list">${Object.entries(assumptions).map(([key, item]) => `
    <div>
      <strong>${financialTerm(outputKeyLabel(key))}</strong>
      <span>${escapeHtml(formatWorkflowValue(item.value))}</span>
      <p>${escapeHtml(item.why || "")}</p>
    </div>
  `).join("")}</div>`;
}

function valuationModelsReport(models = [], currentPrice) {
  return `<div class="method-table">${models.map((modelItem) => `
    <div class="method-row">
      <strong>${financialTerm(modelItem.method)}</strong>
      <span>${modelItem.fairValue ? fairValueSignal(modelItem.fairValue, currentPrice) : "—"}</span>
      <small>${Math.round((modelItem.weight || 0) * 100)}% ${uiLabel("Weight")} / ${Math.round((modelItem.confidence || 0) * 100)}% ${uiLabel("Confidence")}</small>
      <p>${escapeHtml(modelItem.explanation || "")}</p>
    </div>
  `).join("")}</div>`;
}

function scenarioFixedReport(scenario = {}, currentPrice = null) {
  return `
    <div class="two-col">
      ${metric(uiLabel("Probability"), `${Math.round((scenario.probability || 0) * 100)}%`)}
      ${metricHtml(uiLabel("Fair Value"), fairValueSignal(scenario.fairValue, currentPrice))}
      ${metric("WACC", percent(scenario.wacc))}
      ${metric("Terminal Growth", percent(scenario.terminalGrowth))}
      ${metric("CapEx", percent(scenario.capexAssumptions))}
      ${metric("Operating Margin", percent(scenario.marginAssumptions))}
    </div>
    ${researchList(uiLabel("Key Risks"), scenario.keyRisks || [])}
    ${researchList(uiLabel("Key Catalysts"), scenario.keyCatalysts || [])}
  `;
}

function listReport(items = []) {
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function finalDecisionReport(report) {
  const item = report.finalInvestmentDecision;
  return `
    ${metric(uiLabel("Recommendation"), decisionLabel(item.decision))}
    <p>${escapeHtml(item.why)}</p>
    <p class="muted">${escapeHtml(item.whyNot)}</p>
    ${researchList(uiLabel("Main Positive Factor"), item.mainPositiveDrivers)}
    ${researchList(uiLabel("Main Negative Factor"), item.mainNegativeDrivers)}
    ${researchList(uiLabel("Data Limitations"), item.dataLimitations)}
  `;
}

function formatWorkflowValue(value) {
  const parsed = Number(value);
  if (typeof value === "string" && value.trim() && !Number.isFinite(parsed)) return value;
  if (!Number.isFinite(parsed)) return "—";
  if (Math.abs(parsed) < 1 && parsed !== 0) return percent(parsed);
  return Math.abs(parsed) >= 1000 ? compact(parsed) : String(Number(parsed.toFixed(4)));
}

function summaryPanel(r) {
  return `
    <section class="content-grid">
      <article class="panel">
        <h3>${uiLabel("Investment Decision")}</h3>
        <div class="two-col">
          ${metric(uiLabel("Position size"), `${r.decision.positionSize}%`)}
          ${metric(uiLabel("Add below"), money(r.decision.addBelow, 0))}
          ${metric(uiLabel("Reduce above"), money(r.decision.reduceAbove, 0))}
          ${metric(uiLabel("Investment score"), String(r.decision.compositeScore))}
        </div>
        <p>${escapeHtml(decisionWhyText(r))}</p>
        <p class="muted">${escapeHtml(exitThesisText(r.decision))}</p>
        <button class="primary-btn thesis-btn" data-action="save-run">${uiLabel("Save thesis")}</button>
      </article>
      <article class="panel">
        <h3>${uiLabel("Explainability")}</h3>
        ${factorList(uiLabel("What helped"), r.explanation.positives)}
        ${factorList(uiLabel("What hurt"), r.explanation.negatives)}
      </article>
      <article class="panel full">
        <h3>${uiLabel("Scenarios")}</h3>
        <div class="scenario-row">
          ${r.scenarios.map((scenario) => `
            <div class="scenario-card">
              <span>${escapeHtml(scenario.name)}</span>
              <strong>${money(scenario.fairValue, 0)}</strong>
              <small>${Math.round(scenario.probability * 100)}% ${uiLabel("probability")}</small>
              <p>${escapeHtml(scenario.assumptions.map(scenarioAssumption).join(" / "))}</p>
            </div>
          `).join("")}
        </div>
      </article>
    </section>
  `;
}

function valuationPanel(r, company) {
  const currentPrice = Number(company.quote?.price);
  return `
    <section class="panel">
      <h3>${uiLabel("Valuation Engine")}</h3>
      ${modelCard(r.valuation)}
      <div class="method-table">
        ${r.valuation.methods.length ? r.valuation.methods.map((method) => `
          <div class="method-row">
            <strong>${escapeHtml(method.name)}</strong>
            <span>${fairValueSignal(method.fairValue, currentPrice)}</span>
            <small>${Math.round(method.confidence * 100)}% ${uiLabel("Confidence")}</small>
            <p>${escapeHtml(analysisText(method.explanation))}</p>
          </div>
        `).join("") : `<div class="empty-state">${analysisText("No valuation method can run until price and financial statement inputs are available.")}</div>`}
      </div>
      <div class="reverse-dcf">
        <strong>${financialTerm("Reverse DCF")}</strong>
        <span>${percent(r.valuation.reverseDcf.impliedGrowth)} Growth FCF مطلوب</span>
        <p>${escapeHtml(analysisText(r.valuation.reverseDcf.explanation))}</p>
      </div>
    </section>
  `;
}

function enginePanel(title, engine) {
  return `
    <section class="panel">
      <h3>${title}</h3>
      <div class="engine-head">
        <strong>${escapeHtml(String(ratingLabel(engine.score ?? engine.rating ?? engine.grade)))}</strong>
        <p>${escapeHtml(analysisText(engine.summary || ""))}</p>
      </div>
      ${modelCard(engine)}
      ${factorList(uiLabel("Drivers"), engine.factors || [])}
    </section>
  `;
}

function businessPanel(r) {
  return `
    <section class="content-grid">
      <article class="panel">${enginePanelInner(uiLabel("Moat Engine"), r.moat)}</article>
      <article class="panel">${enginePanelInner(uiLabel("Management Engine"), r.management)}</article>
    </section>
  `;
}

function riskPanel(r) {
  return `
    <section class="content-grid">
      <article class="panel">${enginePanelInner(uiLabel("Risk Engine"), r.risk)}</article>
      <article class="panel">${enginePanelInner(uiLabel("Data Completeness Engine"), r.dataCompleteness)}</article>
      <article class="panel full">${dataHealthPanel(r.dataHealth)}</article>
    </section>
  `;
}

function dataHealthPanel(dataHealth) {
  return `
    <h3>${uiLabel("Data Health")}</h3>
    <div class="two-col">
      ${metric(uiLabel("Overall Data Quality"), `${dataHealth.overallScore}/100`)}
      ${metric(uiLabel("Timeline"), `${dataHealth.timelinePeriods.annual} سنوي / ${dataHealth.timelinePeriods.quarterly} ربع سنوي`)}
      ${metric(uiLabel("Missing fields"), String(dataHealth.missingFields.length))}
      ${metric(uiLabel("Conflicting fields"), String(dataHealth.conflictingFields.length))}
    </div>
    ${healthList(uiLabel("Missing fields"), dataHealth.missingFields)}
    ${healthList(uiLabel("Outdated fields"), dataHealth.outdatedFields)}
    ${healthList(uiLabel("Conflicting fields"), dataHealth.conflictingFields)}
  `;
}

function institutionalResearchPanel(state) {
  const research = state.institutionalResearch;
  return `
    <section class="content-grid research-grid">
      <article class="panel full">${companyProfileModule(research.profile)}</article>
      <article class="panel">${competitiveModule(research.competitive)}</article>
      <article class="panel">${earningsModule(research.earnings)}</article>
      <article class="panel full">${historicalPerformanceModule(research.performance)}</article>
      <article class="panel full">${historicalValuationModule(research.historicalValuation)}</article>
      <article class="panel">${analystModule(research.analyst)}</article>
      <article class="panel">${thesisModule(research.thesis)}</article>
      <article class="panel full">${researchTimelineModule(research.timeline)}</article>
      <article class="panel full">${cioModule(research.cio)}</article>
    </section>
  `;
}

function companyProfileModule(profile) {
  return `
    <h3>${uiLabel("Company Profile")}</h3>
    <p class="muted source-line">${uiLabel("Source")}: ${escapeHtml(sourceLabel(profile.source))}</p>
    <div class="research-copy">${escapeHtml(researchText(profile.businessSummary))}</div>
    <div class="research-columns">
      ${researchList(uiLabel("Business Model"), [profile.businessModel])}
      ${researchList(uiLabel("Revenue Segments"), profile.revenueSegments)}
      ${researchList(uiLabel("Geographic Exposure"), profile.geographicExposure)}
      ${researchList(uiLabel("Customers"), profile.customers)}
      ${researchList(uiLabel("Competitive Advantages"), profile.competitiveAdvantages)}
      ${researchList(uiLabel("Key Products"), profile.keyProducts)}
      ${researchList(uiLabel("Management"), profile.management)}
    </div>
  `;
}

function competitiveModule(competitive) {
  return `
    <h3>${uiLabel("Competitive Analysis")}</h3>
    ${researchList(uiLabel("Main Competitors"), competitive.mainCompetitors)}
    ${researchList(uiLabel("Market Share"), competitive.marketShare)}
    ${researchList(uiLabel("Competitive Strengths"), competitive.competitiveStrengths)}
    ${researchList(uiLabel("Competitive Weaknesses"), competitive.competitiveWeaknesses)}
    ${researchList(uiLabel("Peer Comparison"), competitive.peerComparison)}
  `;
}

function historicalPerformanceModule(performance) {
  return `
    <h3>${uiLabel("Historical Performance")}</h3>
    <p class="muted">${escapeHtml(analysisText(performance.summary))}</p>
    ${miniCharts(performance.charts)}
    <div class="research-table">
      <div class="research-row head">
        <span>${uiLabel("Year")}</span><span>${financialTerm("Revenue")}</span><span>${financialTerm("EPS")}</span><span>${financialTerm("FCF")}</span><span>${uiLabel("Op Margin")}</span><span>${financialTerm("ROIC")}</span><span>${uiLabel("Gross Margin")}</span><span>${uiLabel("Debt")}</span><span>${uiLabel("Shares")}</span>
      </div>
      ${performance.rows.length ? performance.rows.map((row) => `
        <div class="research-row">
          <span>${escapeHtml(row.year)}</span>
          <span>${formatResearchValue(row.revenue, "compact")}</span>
          <span>${formatResearchValue(row.eps)}</span>
          <span>${formatResearchValue(row.freeCashFlow, "compact")}</span>
          <span>${formatResearchValue(row.operatingMargin, "percent")}</span>
          <span>${formatResearchValue(row.roic, "percent")}</span>
          <span>${formatResearchValue(row.grossMargin, "percent")}</span>
          <span>${formatResearchValue(row.debt, "compact")}</span>
          <span>${formatResearchValue(row.shares, "compact")}</span>
        </div>
      `).join("") : `<div class="empty-state">${analysisText("No verified historical financial statements available.")}</div>`}
    </div>
  `;
}

function historicalValuationModule(historicalValuation) {
  return `
    <h3>${uiLabel("Historical Valuation")}</h3>
    <div class="research-table compact-table">
      <div class="research-row head"><span>${uiLabel("Metric")}</span><span>${uiLabel("Current")}</span><span>${uiLabel("History")}</span><span>${uiLabel("Percentile")}</span></div>
      ${historicalValuation.metrics.map((metricItem) => `
        <div class="research-row">
          <span>${escapeHtml(metricItem.label)}</span>
          <span>${formatResearchValue(metricItem.current, "multiple")}</span>
          <span>${escapeHtml(metricItem.history.length ? analysisText(`${metricItem.history.length} periods`) : "-")}</span>
          <span>${formatResearchValue(metricItem.percentile, "percent")}</span>
        </div>
      `).join("")}
    </div>
    <p class="muted">${escapeHtml(analysisText(historicalValuation.note))}</p>
  `;
}

function earningsModule(earnings) {
  return `
    <h3>${uiLabel("Earnings Center")}</h3>
    <div class="two-col">
      ${metric(uiLabel("Last earnings"), researchText(earnings.lastEarnings))}
      ${metric(uiLabel("Next earnings"), researchText(earnings.nextEarningsDate))}
      ${metric(uiLabel("Revenue surprise"), earnings.revenueSurprise)}
      ${metric(uiLabel("EPS surprise"), earnings.epsSurprise)}
    </div>
    ${researchList(uiLabel("Guidance"), [earnings.guidance])}
    ${researchList(uiLabel("Management Commentary"), [earnings.managementCommentarySummary])}
  `;
}

function analystModule(analyst) {
  return `
    <h3>${uiLabel("Analyst Consensus")}</h3>
    <div class="two-col">
      ${metric(uiLabel("Low target"), money(analyst.targetPrices.low, 0))}
      ${metric(uiLabel("Average target"), money(analyst.targetPrices.average, 0))}
      ${metric(uiLabel("High target"), money(analyst.targetPrices.high, 0))}
      ${metric(uiLabel("Rating"), decisionLabel(researchText(analyst.rating)))}
    </div>
    ${researchList(uiLabel("Rating Distribution"), analyst.ratingDistribution)}
    ${researchList(uiLabel("Recent Upgrades"), analyst.recentUpgrades)}
    ${researchList(uiLabel("Recent Downgrades"), analyst.recentDowngrades)}
    ${researchList(uiLabel("Consensus Trend"), analyst.consensusTrend)}
  `;
}

function thesisModule(thesis) {
  return `
    <h3>${uiLabel("Investment Thesis")}</h3>
    ${researchList(uiLabel("Why Invest"), thesis.whyInvest)}
    ${researchList(uiLabel("Why Avoid"), thesis.whyAvoid)}
    ${researchList(uiLabel("Biggest Opportunities"), thesis.biggestOpportunities)}
    ${researchList(uiLabel("Biggest Risks"), thesis.biggestRisks)}
    ${researchList(uiLabel("What Would Change The Thesis"), thesis.thesisChange)}
  `;
}

function researchTimelineModule(timeline) {
  return `
    <h3>${uiLabel("Research Timeline")}</h3>
    ${timeline.length ? timeline.map((item) => `
      <div class="history-row">
        <strong>${escapeHtml(timelineType(item.type))} ${escapeHtml(item.date || item.year)}</strong>
        <span>${escapeHtml(researchText(item.title))}</span>
        <small>${escapeHtml(sourceLabel(item.source || "Verified provider data"))}</small>
      </div>
    `).join("") : `<div class="empty-state">${analysisText("No verified timeline events available.")}</div>`}
  `;
}

function cioModule(summary) {
  return `
    <h3>${uiLabel("Explain Like CIO")}</h3>
    <p class="research-copy">${escapeHtml(analysisText(summary))}</p>
  `;
}

function watchListPanel(state) {
  return `
    <section class="content-grid">
      <article class="panel">
        <h3>${uiLabel("Watch List")}</h3>
        <div class="settings-grid watch-form">
          <label>${uiLabel("Target price")}<input data-watch-draft="targetPrice" value="${escapeHtml(state.watchDraft.targetPrice)}" inputmode="decimal" placeholder="اختياري"></label>
          <label>${uiLabel("Review date")}<input data-watch-draft="reviewDate" value="${escapeHtml(state.watchDraft.reviewDate)}" type="date"></label>
        </div>
        <label class="notes-field">${uiLabel("Investment thesis")}<textarea data-watch-draft="thesis" placeholder="لماذا السهم في قائمة المتابعة؟">${escapeHtml(state.watchDraft.thesis)}</textarea></label>
        <label class="notes-field">${uiLabel("Notes")}<textarea data-watch-draft="notes" placeholder="محفزات، مخاطر، أسئلة">${escapeHtml(state.watchDraft.notes)}</textarea></label>
        <button class="primary-btn thesis-btn" data-action="save-watch">حفظ في قائمة المتابعة</button>
      </article>
      <article class="panel">
        <h3>${uiLabel("Saved Companies")}</h3>
        ${state.watchList.length ? state.watchList.map((item) => `
          <div class="history-row">
            <strong>${escapeHtml(item.ticker)} ${escapeHtml(decisionLabel(item.decision))}</strong>
            <span>${uiLabel("Target price")} ${money(item.targetPrice, 0)} / ${uiLabel("Review date")} ${escapeHtml(item.reviewDate || "-")}</span>
            <small>${escapeHtml(item.investmentThesis || item.notes || uiLabel("No notes"))}</small>
            <button class="icon-btn inline-action" data-remove-watch="${escapeHtml(item.id)}">${uiLabel("Remove")}</button>
          </div>
        `).join("") : `<p class="muted">${analysisText("No saved watch list companies yet.")}</p>`}
      </article>
    </section>
  `;
}

function enginePanelInner(title, engine) {
  return `
    <h3>${title}</h3>
    <div class="engine-head">
      <strong>${escapeHtml(String(ratingLabel(engine.score ?? engine.rating ?? engine.grade)))}</strong>
      <p>${escapeHtml(analysisText(engine.summary || ""))}</p>
    </div>
    ${modelCard(engine)}
    ${factorList(uiLabel("Drivers"), engine.factors || [])}
  `;
}

function settingsPanel(state) {
  const savedReports = Object.values(state.externalAnalyses || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);
  return `
    <section class="panel settings-panel">
      <h3>${uiLabel("Settings")}</h3>
      <div class="settings-grid">
        <div class="settings-status">
          <span>${uiLabel("Private Server")}</span>
          <strong>${uiLabel("API keys are configured on the private server only.")}</strong>
        </div>
        <div class="settings-status">
          <span>${uiLabel("Saved reports")}</span>
          <strong>${savedReports}</strong>
        </div>
      </div>
      <section class="backup-restore-panel">
        <div class="table-title">
          <div>
            <p class="eyebrow">${uiLabel("Investment Data")}</p>
            <h3>${uiLabel("Export and Restore")}</h3>
            <p>${uiLabel("Export saved Franklin reports, history, settings, and watch data. API keys are never included.")}</p>
          </div>
          <button class="primary-btn" data-action="export-all-investment-data">${uiLabel("Export All Investment Data")}</button>
        </div>
        <label class="restore-file-input">
          <span>${uiLabel("Restore Investment Data")}</span>
          <input type="file" accept="application/json,.json" data-restore-investment-backup>
        </label>
        ${localRecoveryBackupsPanel(state.localBackupRegistry || [])}
        ${restorePreviewPanel(state.restorePreview)}
      </section>
      <button class="icon-btn" data-action="load-external-demo">${uiLabel("Open DEMO External Report")}</button>
      <button class="icon-btn danger-action" data-action="clear-local-data">${uiLabel("Clear Local Data")}</button>
      <div class="settings-note">
        ${analysisText("API keys are stored only as server-side environment variables. Imported reports remain local in this browser until cleared. Franklin stores research knowledge and does not create investment analysis.")}
      </div>
    </section>
  `;
}

function localRecoveryBackupsPanel(backups = []) {
  const usable = backups.filter((backup) => backup.valid && backup.reportCount > 0);
  if (!usable.length) return "";
  return `
    <div class="local-backup-registry">
      <div>
        <strong>${uiLabel("Local Recovery Backups")}</strong>
        <p>${uiLabel("Franklin found saved local recovery snapshots. Preview before restoring; cloud data will not be changed.")}</p>
      </div>
      <div class="local-backup-list">
        ${usable.slice(0, 6).map((backup) => `
          <article class="local-backup-card">
            <div>
              <strong>${escapeHtml(backup.reason || "recovery")}</strong>
              <span>${escapeHtml(backup.createdAt || "-")}</span>
            </div>
            <div class="settings-grid">
              ${compactCardMetric(uiLabel("Companies"), backup.tickerCount)}
              ${compactCardMetric(uiLabel("Analyses"), backup.reportCount)}
              ${compactCardMetric(uiLabel("Historical Requirements"), backup.requirementSetCount)}
            </div>
            <button class="icon-btn" data-local-backup-key="${escapeHtml(backup.key)}">${uiLabel("Preview Restore")}</button>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function restorePreviewPanel(result) {
  if (!result) return "";
  if (!result.valid) {
    return `
      <div class="restore-preview-card invalid">
        <strong>${uiLabel("Backup is not valid")}</strong>
        ${(result.errors || []).map((error) => `<p>${escapeHtml(error)}</p>`).join("")}
        <button class="icon-btn" data-action="cancel-restore-preview">${uiLabel("Cancel")}</button>
      </div>
    `;
  }
  const preview = result.preview || {};
  return `
    <div class="restore-preview-card">
      <div>
        <strong>${uiLabel("Restore Preview")}</strong>
        <span>${escapeHtml(preview.exportedAt || "-")}</span>
      </div>
      <div class="settings-grid">
        ${compactCardMetric(uiLabel("Companies"), preview.companyCount ?? 0)}
        ${compactCardMetric(uiLabel("Analyses"), preview.externalReportCount ?? 0)}
        ${compactCardMetric(uiLabel("Historical Requirements"), preview.historicalRequirementSets ?? 0)}
        ${preview.currentReportCount !== undefined ? compactCardMetric(uiLabel("Current Device Reports"), preview.currentReportCount ?? 0) : ""}
        ${compactCardMetric(uiLabel("Evaluated Companies"), preview.evaluatedCompanies ?? 0)}
        ${compactCardMetric(uiLabel("Watchlist"), preview.watchListItems ?? 0)}
      </div>
      <p class="restore-safety-note">${uiLabel("Restore replaces or merges local browser data only. Cloud data is not modified.")}</p>
      <div class="restore-actions">
        <button class="primary-btn" data-action="confirm-restore-merge">${uiLabel("Merge Backup")}</button>
        <button class="icon-btn warning-action" data-action="confirm-restore-replace">${uiLabel("Replace Local Data")}</button>
        <button class="icon-btn" data-action="cancel-restore-preview">${uiLabel("Cancel")}</button>
      </div>
    </div>
  `;
}

function historyPanel(state) {
  return `
    <section class="panel">
      <h3>${uiLabel("Saved Theses")}</h3>
      ${state.history.length ? state.history.map((item) => `
        <div class="history-row">
          <strong>${escapeHtml(item.ticker)} ${escapeHtml(decisionLabel(item.decision))}</strong>
          <span>${money(item.price, 2)} / FV ${money(item.fairValue, 0)}</span>
          <small>${item.confidence}% ${uiLabel("Confidence")} / ${escapeHtml(statusLabel(item.status || "SAVED"))} / ${escapeHtml(item.date)}</small>
        </div>
      `).join("") : `<p class="muted">${analysisText("No saved theses yet.")}</p>`}
    </section>
  `;
}

function modelCard(engine) {
  return `
    <div class="model-card">
      <div><span>${uiLabel("Formula")}</span><p class="formula-text">${escapeHtml(engine.formula || "-")}</p></div>
      <div><span>${uiLabel("Confidence")}</span><p>${escapeHtml(String(engine.confidence ?? "-"))}${Number.isFinite(engine.confidence) ? "%" : ""}</p></div>
      <div><span>${uiLabel("Output")}</span><p>${escapeHtml(formatOutput(engine.output))}</p></div>
    </div>
  `;
}

function metric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function metricHtml(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${value}</strong></div>`;
}

function scorePill(label, value, category) {
  return `<div class="score-pill ${colorClass(category, "score-card")}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function factorList(title, factors) {
  const visible = factors.length ? factors : [{ label: "No drivers", impact: 0, explanation: "No evidence available yet.", status: "missing" }];
  return `
    <div class="factors">
      <h4>${escapeHtml(title)}</h4>
      ${visible.map((rawItem) => {
        const item = factorDisplay(rawItem);
        return `
        <div class="factor ${item.status === "missing" ? "missing" : ""}">
          <b class="${item.impact >= 0 ? "positive" : "negative"}">${item.impact >= 0 ? "+" : ""}${item.impact}</b>
          <span>${escapeHtml(item.label)}</span>
          <small>${escapeHtml(item.explanation)}</small>
        </div>
      `;
      }).join("")}
    </div>
  `;
}

function bind(root, store, actions) {
  const evidenceDialog = root.querySelector("[data-evidence-dialog]");
  const genericEvidenceDialogLabel = evidenceDialog?.getAttribute("aria-label") || uiLabel("Evidence details");
  let evidenceDialogTrigger = null;
  let fallbackInertState = [];
  const releaseEvidenceFallback = () => {
    fallbackInertState.forEach(({ element, inert }) => {
      element.inert = inert;
    });
    fallbackInertState = [];
    evidenceDialog?.removeAttribute("data-fallback-open");
    evidenceDialog?.removeAttribute("aria-modal");
  };
  const closeEvidenceDialog = () => {
    if (!evidenceDialog) return;
    const trigger = evidenceDialogTrigger;
    if (evidenceDialog.hasAttribute("data-fallback-open")) {
      evidenceDialog.removeAttribute("open");
      releaseEvidenceFallback();
    } else if (typeof evidenceDialog.close === "function") {
      evidenceDialog.close();
    } else {
      evidenceDialog.removeAttribute("open");
    }
    evidenceDialog.setAttribute("aria-label", genericEvidenceDialogLabel);
    evidenceDialogTrigger = null;
    trigger?.focus();
  };
  root.querySelectorAll("[data-evidence-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const template = button.closest("li")?.querySelector("[data-evidence-template]");
      const content = evidenceDialog?.querySelector("[data-evidence-dialog-content]");
      if (!template || !content || !evidenceDialog) return;
      evidenceDialogTrigger = button;
      content.innerHTML = template.innerHTML;
      evidenceDialog.setAttribute("aria-label", button.dataset.evidenceDialogLabel || genericEvidenceDialogLabel);
      if (typeof evidenceDialog.showModal === "function") evidenceDialog.showModal();
      else {
        fallbackInertState = [...root.children]
          .filter((element) => element !== evidenceDialog)
          .map((element) => ({ element, inert: element.inert }));
        fallbackInertState.forEach(({ element }) => {
          element.inert = true;
        });
        evidenceDialog.setAttribute("data-fallback-open", "true");
        evidenceDialog.setAttribute("aria-modal", "true");
        evidenceDialog.setAttribute("open", "");
      }
      evidenceDialog.querySelector("[data-action='close-evidence-detail']")?.focus();
    });
  });
  evidenceDialog?.querySelector("[data-action='close-evidence-detail']")?.addEventListener("click", closeEvidenceDialog);
  evidenceDialog?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeEvidenceDialog();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...evidenceDialog.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
      .filter((element) => !element.hidden);
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  evidenceDialog?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEvidenceDialog();
  });
  evidenceDialog?.addEventListener("click", (event) => {
    if (event.target === evidenceDialog) closeEvidenceDialog();
  });
  root.querySelectorAll("[data-panel]").forEach((button) => {
    button.addEventListener("click", () => store.set({ activePanel: button.dataset.panel }));
  });
  root.querySelector("[data-action='toggle-theme']")?.addEventListener("click", () => {
    store.set({ theme: store.state.theme === "dark" ? "light" : "dark" });
  });
  root.querySelectorAll("[data-language]").forEach((button) => {
    button.addEventListener("click", () => {
      setupArabicDocument(button.dataset.language);
      store.setLanguage(button.dataset.language);
    });
  });
  root.querySelectorAll("[data-sort-key]").forEach((button) => {
    button.addEventListener("click", () => store.setEvaluatedSort(button.dataset.sortKey));
  });
  root.querySelectorAll("[data-ranking-filter]").forEach((button) => {
    button.addEventListener("click", () => store.setRankingFilter(button.dataset.rankingFilter));
  });
  root.querySelector("[data-sector-filter]")?.addEventListener("change", (event) => {
    store.setSectorFilter(event.target.value);
  });
  root.querySelector("[data-library-filter]")?.addEventListener("change", (event) => {
    store.setLibraryFilter(event.target.value);
  });
  root.querySelectorAll("[data-library-filter-button]").forEach((button) => {
    button.addEventListener("click", () => store.setLibraryFilter(button.dataset.libraryFilterButton));
  });
  root.querySelector("[data-library-sort]")?.addEventListener("change", (event) => {
    store.setLibrarySort(event.target.value);
  });
  root.querySelectorAll("[data-select-ticker]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      store.toggleCompareSelection(button.dataset.selectTicker);
    });
  });
  root.querySelector("[data-action='compare-selected']")?.addEventListener("click", store.openComparison);
  root.querySelector("[data-action='close-comparison']")?.addEventListener("click", store.closeComparison);
  root.querySelectorAll("[data-evaluated-ticker]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, input, select, a")) return;
      store.openEvaluatedCompany(row.dataset.evaluatedTicker);
    });
  });
  root.querySelectorAll("[data-external-ticker]").forEach((card) => {
    if (card.hasAttribute("data-external-history-id")) return;
    card.addEventListener("click", (event) => {
      const nestedInteractive = event.target.closest("button, input, select, a");
      if (nestedInteractive && nestedInteractive !== card) return;
      store.openExternalReport(card.dataset.externalTicker, card.dataset.externalReportId);
    });
  });
  root.querySelectorAll("[data-external-history-id]").forEach((button) => {
    button.addEventListener("click", () => store.openExternalReport(button.dataset.externalHistoryTicker, button.dataset.externalHistoryId));
  });
  root.querySelectorAll("[data-profile-ticker]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      store.openCompanyProfile(button.dataset.profileTicker, button.dataset.profileReportId);
    });
  });
  root.querySelector("[data-action='open-profile-report']")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    store.openExternalReport(button.dataset.profileReportTicker, button.dataset.profileReportId);
  });
  root.querySelectorAll("[data-action='open-quarterly-scorecard']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      store.openQuarterlyScorecard(button.dataset.scorecardTicker, button.dataset.scorecardReportId);
    });
  });
  root.querySelectorAll("[data-action='close-quarterly-scorecard']").forEach((button) => {
    button.addEventListener("click", store.closeQuarterlyScorecard);
  });
  root.querySelector("[data-scorecard-year]")?.addEventListener("change", (event) => {
    store.setQuarterlyScorecardYear(event.target.value);
  });
  root.querySelectorAll("[data-scorecard-metric][data-scorecard-quarter]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!button.disabled) store.selectQuarterlyScorecardCell(button.dataset.scorecardMetric, button.dataset.scorecardQuarter);
    });
  });
  root.querySelector("[data-action='close-scorecard-detail']")?.addEventListener("click", () => {
    store.selectQuarterlyScorecardCell(null, null);
  });
  root.querySelector("[data-action='download-quarterly-scorecard']")?.addEventListener("click", () => exportQuarterlyScorecard(store, "download"));
  root.querySelector("[data-action='share-quarterly-scorecard']")?.addEventListener("click", () => exportQuarterlyScorecard(store, "share"));
  root.querySelector("[data-action='save-run']")?.addEventListener("click", store.saveRun);
  root.querySelectorAll("[data-action='new-analysis']").forEach((button) => {
    button.addEventListener("click", store.startBlankAnalysis);
  });
  root.querySelectorAll("[data-action='open-external-import']").forEach((button) => {
    button.addEventListener("click", store.openExternalImport);
  });
  root.querySelectorAll("[data-action='add-external-analysis-for-ticker']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const ticker = button.dataset.externalTicker || "";
      store.openExternalImport();
      store.set({
        externalImport: { ...store.state.externalImport, tickerHint: ticker },
        notice: store.state.language === "ar" ? `جاهز لإضافة تحليل جديد لـ ${ticker}.` : `Ready to add a new analysis for ${ticker}.`
      });
    });
  });
  root.querySelectorAll("[data-action='load-demo-analysis']").forEach((button) => {
    button.addEventListener("click", store.loadDemoAnalysis);
  });
  root.querySelectorAll("[data-action='load-external-demo']").forEach((button) => {
    button.addEventListener("click", store.loadDemoExternalAnalysis);
  });
  root.querySelector("[data-action='parse-external-analysis']")?.addEventListener("click", () => {
    const text = root.querySelector("[data-external-raw]")?.value || "";
    const tickerHint = root.querySelector("[data-external-ticker-hint]")?.value || "";
    store.parseExternalImport(text, { tickerHint });
  });
  root.querySelectorAll("[data-action='copy-full-analysis-prompt']").forEach((button) => {
    button.addEventListener("click", () => {
      const tickerHint = root.querySelector("[data-external-ticker-hint]")?.value
        || store.state.externalImport?.tickerHint
        || button.dataset.externalTicker
        || "";
      copyExternalAnalysisPrep(store, "prompt", tickerHint);
    });
  });
  root.querySelectorAll("[data-action='copy-external-json-template']").forEach((button) => {
    button.addEventListener("click", () => {
      const tickerHint = root.querySelector("[data-external-ticker-hint]")?.value || store.state.externalImport?.tickerHint || "";
      copyExternalAnalysisPrep(store, "template", tickerHint);
    });
  });
  root.querySelectorAll("[data-action='copy-new-earnings-prompt']").forEach((button) => {
    button.addEventListener("click", () => copyNewEarningsAnalysisPrompt(store));
  });
  root.querySelectorAll("[data-action='open-earnings-update']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      try { sessionStorage.removeItem("quarterlyEarningsEntryContext"); } catch { /* Storage may be unavailable. */ }
      store.openEarningsUpdate();
    });
  });
  root.querySelectorAll("[data-action='close-earnings-update']").forEach((button) => {
    button.addEventListener("click", () => {
      try { sessionStorage.removeItem("quarterlyEarningsEntryContext"); } catch { /* Storage may be unavailable. */ }
      store.closeEarningsUpdate();
    });
  });
  root.querySelectorAll("[data-earnings-step]").forEach((button) => {
    button.addEventListener("click", () => {
      const step = button.dataset.earningsStep;
      store.set({ earningsUpdate: { ...store.state.earningsUpdate, step: /^\d+$/.test(step) ? Number(step) : step } });
    });
  });
  root.querySelectorAll("[data-earnings-field]").forEach((input) => {
    input.addEventListener("input", () => store.updateEarningsUpdateField(input.dataset.earningsField, input.value));
  });
  root.querySelector("[data-action='prepare-earnings-prompt']")?.addEventListener("click", store.prepareEarningsUpdatePrompt);
  root.querySelector("[data-action='copy-earnings-update-prompt']")?.addEventListener("click", () => copyEarningsUpdatePrompt(store));
  root.querySelector("[data-action='parse-earnings-update-json']")?.addEventListener("click", () => {
    const text = root.querySelector("[data-earnings-field='responseText']")?.value || "";
    store.parseEarningsUpdateJson(text);
  });
  root.querySelector("[data-action='save-earnings-update']")?.addEventListener("click", store.saveEarningsUpdate);
  root.querySelectorAll("[data-investment-data-select]").forEach((select) => {
    select.addEventListener("change", () => {
      const area = select.closest(".investment-data-area");
      activateInvestmentDataPanel(area, select.value);
    });
  });
  root.querySelectorAll("[data-investment-data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const area = button.closest(".investment-data-area");
      const value = button.dataset.investmentDataTab;
      const select = area?.querySelector("[data-investment-data-select]");
      if (select) select.value = value;
      activateInvestmentDataPanel(area, value);
    });
  });
  root.querySelector("[data-action='copy-missing-requirements']")?.addEventListener("click", () => copyMissingRequirements(store));
  root.querySelector("[data-action='select-copy-fallback']")?.addEventListener("click", () => {
    const textArea = root.querySelector("[data-copy-fallback-text]");
    textArea?.focus();
    textArea?.select();
  });
  root.querySelector("[data-action='open-supplement-input']")?.addEventListener("click", store.openSupplementInput);
  root.querySelector("[data-action='cancel-external-supplement']")?.addEventListener("click", store.cancelExternalSupplement);
  root.querySelector("[data-action='parse-external-supplement']")?.addEventListener("click", () => {
    const text = root.querySelector("[data-supplement-raw]")?.value || "";
    store.parseExternalSupplement(text);
  });
  root.querySelector("[data-action='apply-external-supplement']")?.addEventListener("click", store.applyExternalSupplement);
  root.querySelectorAll("[data-requirement-set-select]").forEach((button) => {
    button.addEventListener("click", () => store.selectHistoricalRequirementSet(button.dataset.requirementSetSelect));
  });
  root.querySelector("[data-action='save-external-incomplete-draft']")?.addEventListener("click", () => store.saveExternalIncompleteDraft(false));
  root.querySelector("[data-action='open-missing-manual']")?.addEventListener("click", () => {
    store.set({ externalImport: { ...store.state.externalImport, missingManualOpen: true } });
  });
  root.querySelector("[data-action='start-report-supplement']")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    store.startExternalReportCompletion(button.dataset.externalTicker, button.dataset.externalReportId);
  });
  root.querySelectorAll("[data-conflict-resolution]").forEach((button) => {
    button.addEventListener("click", () => {
      const path = button.dataset.conflictPath;
      const manualInput = root.querySelector(`[data-conflict-manual="${CSS.escape(path)}"]`);
      store.resolveSupplementConflict(path, button.dataset.conflictResolution, manualInput?.value);
    });
  });
  root.querySelector("[data-action='clear-external-import']")?.addEventListener("click", store.clearExternalImport);
  root.querySelectorAll("[data-action='cancel-external-import']").forEach((button) => {
    button.addEventListener("click", store.cancelExternalImport);
  });
  root.querySelector("[data-action='save-external-analysis']")?.addEventListener("click", () => store.saveExternalDraft(false));
  root.querySelector("[data-action='save-external-analysis-duplicate']")?.addEventListener("click", () => store.saveExternalDraft(true));
  root.querySelectorAll("[data-external-field]").forEach((input) => {
    input.addEventListener("change", () => store.updateExternalDraftField(input.dataset.externalField, input.value));
    input.addEventListener("blur", () => store.updateExternalDraftField(input.dataset.externalField, input.value));
  });
  root.querySelector("[data-external-json]")?.addEventListener("blur", (event) => store.updateExternalDraftJson(event.target.value));
  root.querySelector("[data-action='edit-external-report']")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    store.editExternalReport(button.dataset.externalTicker, button.dataset.externalReportId);
  });
  root.querySelector("[data-action='delete-external-report']")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (window.confirm(uiLabel("Delete this imported analysis version?"))) store.removeExternalReport(button.dataset.externalTicker, button.dataset.externalReportId);
  });
  root.querySelector("[data-action='delete-external-ticker']")?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    if (window.confirm(uiLabel("Delete all imported analyses for this ticker?"))) store.removeAllExternalReports(button.dataset.externalTicker);
  });
  root.querySelector("[data-action='copy-external-json']")?.addEventListener("click", () => copySelectedExternalReport(store));
  root.querySelector("[data-action='export-external-json']")?.addEventListener("click", () => exportSelectedExternalReport(store));
  root.querySelector("[data-action='print-external-report']")?.addEventListener("click", () => window.print());
  root.querySelector("[data-action='clear-analysis-paste']")?.addEventListener("click", store.clearAnalystPaste);
  root.querySelector("[data-action='search']")?.addEventListener("click", actions.search);
  root.querySelector("[data-library-search]")?.addEventListener("input", (event) => {
    store.state.query = event.target.value;
    filterLibraryCards(root, event.target.value);
  });
  root.querySelector("#searchInput")?.addEventListener("input", (event) => {
    store.state.query = event.target.value;
  });
  root.querySelector("#searchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.target.matches("[data-library-search]")) actions.search();
  });
  root.querySelectorAll("[data-sample-query]").forEach((button) => {
    button.addEventListener("click", () => {
      store.set({ query: button.dataset.sampleQuery });
      actions.search();
    });
  });
  root.querySelector("[data-action='clear-local-data']")?.addEventListener("click", store.clearLocalData);
  root.querySelector("[data-action='export-all-investment-data']")?.addEventListener("click", () => exportAllInvestmentData(store));
  root.querySelectorAll("[data-local-backup-key]").forEach((button) => {
    button.addEventListener("click", () => store.previewLocalBackupRestore(button.dataset.localBackupKey));
  });
  root.querySelector("[data-restore-investment-backup]")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) readInvestmentBackupFile(store, file);
  });
  root.querySelector("[data-action='confirm-restore-merge']")?.addEventListener("click", () => store.restoreInvestmentBackup("merge"));
  root.querySelector("[data-action='confirm-restore-replace']")?.addEventListener("click", () => {
    if (window.confirm(uiLabel("Replace current local Franklin data with this backup?"))) store.restoreInvestmentBackup("replace");
  });
  root.querySelector("[data-action='cancel-restore-preview']")?.addEventListener("click", store.cancelInvestmentRestore);
  root.querySelectorAll("[data-manual]").forEach((input) => {
    input.addEventListener("input", () => store.setManualInput(input.dataset.manual, input.value));
  });
  root.querySelectorAll("[data-workflow-field]").forEach((input) => {
    input.addEventListener("change", () => store.setWorkspaceField(input.dataset.workflowField, input.value));
    input.addEventListener("blur", () => store.setWorkspaceField(input.dataset.workflowField, input.value));
  });
  root.querySelectorAll("[data-workflow-source]").forEach((input) => {
    input.addEventListener("input", () => store.setWorkspaceSectionSource(input.dataset.workflowSource, { [input.dataset.sourceField]: input.value }));
  });
  root.querySelectorAll("[data-workflow-paste]").forEach((input) => {
    input.addEventListener("input", () => store.setWorkspacePaste(input.dataset.workflowPaste, input.value));
  });
  root.querySelector("[data-brain-paste]")?.addEventListener("input", (event) => {
    if (store.state.valuationWorkspace) store.state.valuationWorkspace.analystBrainPaste = event.target.value;
  });
  root.querySelector("[data-action='analyze-brain']")?.addEventListener("click", () => {
    const text = root.querySelector("[data-brain-paste]")?.value || "";
    store.runAnalystBrainValuation(text);
  });
  root.querySelectorAll("[data-action='parse-paste']").forEach((button) => {
    button.addEventListener("click", () => store.parseWorkspaceSection(button.dataset.section));
  });
  root.querySelector("[data-action='apply-paste-preview']")?.addEventListener("click", store.saveParsedWorkspaceValues);
  root.querySelectorAll("[data-confirm-field]").forEach((button) => {
    button.addEventListener("click", () => store.confirmWorkspaceValue(button.dataset.confirmField));
  });
  root.querySelectorAll("[data-reject-field]").forEach((button) => {
    button.addEventListener("click", () => store.rejectWorkspaceValue(button.dataset.rejectField));
  });
  root.querySelectorAll("[data-na-field]").forEach((button) => {
    button.addEventListener("click", () => store.markWorkspaceValueNotAvailable(button.dataset.naField));
  });
  root.querySelectorAll("[data-override-field]").forEach((input) => {
    input.addEventListener("input", () => store.setWorkspaceOverride(input.dataset.overrideField, input.dataset.overrideKey, input.value));
  });
  root.querySelector("[data-investor-notes]")?.addEventListener("input", (event) => store.setWorkspaceInvestorNotes(event.target.value));
  root.querySelector("[data-action='run-valuation-analyst']")?.addEventListener("click", store.runWorkspaceValuation);
  root.querySelector("[data-action='confirm-run-analysis']")?.addEventListener("click", store.runWorkspaceValuation);
  root.querySelector("[data-action='edit-workspace-data']")?.addEventListener("click", store.editWorkspaceData);
  root.querySelector("[data-action='approve-and-export']")?.addEventListener("click", store.approveAndExportWorkspace);
  root.querySelectorAll("[data-watch-draft]").forEach((input) => {
    input.addEventListener("input", () => store.setWatchDraft(input.dataset.watchDraft, input.value));
  });
  root.querySelector("[data-action='save-watch']")?.addEventListener("click", store.saveWatchItem);
  root.querySelectorAll("[data-remove-watch]").forEach((button) => {
    button.addEventListener("click", () => store.removeWatchItem(button.dataset.removeWatch));
  });
  root.querySelectorAll("[data-result-ticker]").forEach((button) => {
    button.addEventListener("click", () => actions.loadCompany(button.dataset.resultTicker));
  });
}

function activateInvestmentDataPanel(area, value) {
  if (!area) return;
  area.querySelectorAll("[data-data-view-panel]").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.dataViewPanel === value);
  });
  area.querySelectorAll("[data-investment-data-tab]").forEach((button) => {
    const active = button.dataset.investmentDataTab === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function filterLibraryCards(root, query) {
  const clean = String(query || "").trim().toLowerCase();
  root.querySelectorAll("[data-library-card]").forEach((card) => {
    const text = card.dataset.searchText || "";
    card.hidden = Boolean(clean) && !text.includes(clean);
  });
}

function createActions(store) {
  return {
    async search() {
      const clean = store.state.query.trim();
      if (!clean) return;
      store.set({ loading: true, processingStage: "idle", notice: store.state.language === "ar" ? "جاري البحث في السوق..." : "Searching market universe..." });
      try {
        const results = await searchCompanies(store.state.query);
        const notice = results.length
          ? (store.state.language === "ar" ? "اختر شركة لفتح مساحة التقييم." : "Select a company to open the valuation workspace.")
          : (store.state.language === "ar" ? "لم يتم العثور على شركات." : "No companies found.");
        store.set({ searchResults: results, loading: false, processingStage: "idle", notice });
      } catch (error) {
        store.set({ loading: false, processingStage: "idle", notice: analysisText(error.userMessage || "Search failed. Market data is configured on the private server.") });
      }
    },
    async loadCompany(ticker) {
      store.set({ loading: true, processingStage: "idle", notice: store.state.language === "ar" ? `جاري فتح مساحة تقييم ${ticker}...` : `Opening valuation workspace for ${ticker}...` });
      try {
        const company = await fetchResearchData(ticker, store.state.manualInputs, store.state.company);
        store.openValuationWorkspace(company);
      } catch (error) {
        store.set({ loading: false, processingStage: "idle", notice: analysisText(error.userMessage || "Could not load live data. Market data is configured on the private server.") });
      }
    }
  };
}

function formatOutput(output = {}) {
  return Object.entries(output)
    .map(([key, value]) => `${outputKeyLabel(key)}: ${formatOutputValue(key, value)}`)
    .join(" / ");
}

function formatOutputValue(key, value) {
  if (key === "label") return decisionLabel(value);
  if (key === "status") return statusLabel(value);
  if (key === "rating") return ratingLabel(value);
  return formatValue(value);
}

function healthList(title, items) {
  const visible = items.length ? items.slice(0, 8) : [{ label: "None", source: "-", timestamp: "-", confidence: "-", updateStatus: "clear" }];
  return `
    <div class="factors">
      <h4>${escapeHtml(title)}</h4>
      ${visible.map((item) => `
        <div class="factor">
          <b class="${items.length ? "negative" : "positive"}">${items.length ? "!" : "OK"}</b>
          <span>${escapeHtml(factorLabel(item.label))}</span>
          <small>${escapeHtml(sourceLabel(item.source || "-"))} / ${escapeHtml(statusLabel(item.updateStatus || "-"))} / ${escapeHtml(item.timestamp || "-")} / ${escapeHtml(String(item.confidence ?? "-"))}${Number.isFinite(item.confidence) ? "%" : ""}</small>
        </div>
      `).join("")}
    </div>
  `;
}

function researchList(title, items) {
  const visible = items.length ? items : ["Not available from verified data."];
  return `
    <div class="research-list">
      <h4>${escapeHtml(title)}</h4>
      ${visible.map((item) => `<p>${escapeHtml(researchText(item))}</p>`).join("")}
    </div>
  `;
}

function miniCharts(charts) {
  const chartKeys = [
    ["revenue", financialTerm("Revenue"), "compact"],
    ["eps", financialTerm("EPS"), "number"],
    ["freeCashFlow", financialTerm("Free Cash Flow"), "compact"],
    ["operatingMargin", financialTerm("Operating margin"), "percent"],
    ["roic", financialTerm("ROIC"), "percent"],
    ["grossMargin", financialTerm("Gross margin"), "percent"],
    ["debt", uiLabel("Debt"), "compact"],
    ["shares", uiLabel("Share Count"), "compact"]
  ];
  return `
    <div class="mini-chart-grid">
      ${chartKeys.map(([key, label, kind]) => `
        <div class="mini-chart">
          <strong>${escapeHtml(label)}</strong>
          ${(charts[key] || []).length ? charts[key].map((point) => `
            <div class="bar-row">
              <span>${escapeHtml(point.year)}</span>
              <i style="width:${point.width}%"></i>
              <small>${escapeHtml(formatResearchValue(point.value, kind))}</small>
            </div>
          `).join("") : `<p class="muted">${analysisText("No verified history.")}</p>`}
        </div>
      `).join("")}
    </div>
  `;
}

function formatValue(value) {
  if (typeof value === "number") {
    return Math.abs(value) >= 1_000_000 ? compact(value) : String(Math.round(value * 100) / 100);
  }
  if (value === null || value === undefined) return "-";
  return String(value);
}

function formatAnyValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return Number.isFinite(value) ? formatValue(value) : "-";
  if (Array.isArray(value)) return value.map(formatAnyValue).join(" / ");
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${labelFromKey(key)}: ${formatAnyValue(item)}`)
      .join(" / ") || "-";
  }
  return String(value);
}

function formatDateShort(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value).slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

export function mixedDirectionMarkup(value) {
  const text = localizedExternalText(value);
  if (!text) return "";
  const ltrFragment = /(\([^()\n]*[A-Za-z][^()\n]*\)|(?:[$€£]\s*)?[+-]?\d[\d,]*(?:\.\d+)?(?:\s*(?:%|×|x|K|M|B|T|USD|SAR))?|[A-Za-z][A-Za-z0-9]*(?:(?:[ \t]+|[./&+:'’-])[A-Za-z0-9][A-Za-z0-9%]*)*)/g;
  let markup = "";
  let cursor = 0;
  for (const match of text.matchAll(ltrFragment)) {
    const index = match.index ?? 0;
    markup += escapeHtml(text.slice(cursor, index));
    markup += `<bdi dir="ltr">${escapeHtml(match[0])}</bdi>`;
    cursor = index + match[0].length;
  }
  return markup + escapeHtml(text.slice(cursor));
}

function localizedExternalText(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map((item) => localizedExternalText(item)).filter(Boolean).join(" / ");
  if (typeof value === "object") return localizedObjectText(value);
  const textValue = String(value).trim();
  if (!textValue) return "";
  if (/^https?:\/\//i.test(textValue)) return textValue;
  const direct = {
    BUY: decisionLabel("BUY"),
    ADD: decisionLabel("ADD"),
    Buy: decisionLabel("BUY"),
    HOLD: decisionLabel("HOLD"),
    WATCH: decisionLabel("WATCH"),
    Hold: decisionLabel("HOLD"),
    SELL: decisionLabel("SELL"),
    REDUCE: decisionLabel("REDUCE"),
    Sell: decisionLabel("SELL"),
    High: ratingLabel("High"),
    Medium: ratingLabel("Medium"),
    Low: ratingLabel("Low"),
    official: uiLabel("Official source"),
    news: uiLabel("News source"),
    manual: uiLabel("Manual source"),
    "Blended Valuation": uiLabel("Blended Valuation"),
    "Discounted Cash Flow (DCF)": "DCF",
    "Forward P/E": "Forward P/E",
    "EV/EBITDA": "EV/EBITDA"
  };
  if (direct[textValue]) return direct[textValue];
  return textValue
    .replace(/\bStrong Buy\b/gi, decisionLabel("Strong Buy"))
    .replace(/\bStrong Sell\b/gi, decisionLabel("Strong Sell"))
    .replace(/\bBUY\b/g, decisionLabel("BUY"))
    .replace(/\bADD\b/g, decisionLabel("ADD"))
    .replace(/\bHOLD\b/g, decisionLabel("HOLD"))
    .replace(/\bWATCH\b/g, decisionLabel("WATCH"))
    .replace(/\bREDUCE\b/g, decisionLabel("REDUCE"))
    .replace(/\bSELL\b/g, decisionLabel("SELL"))
    .replace(/\bBuy\b/g, decisionLabel("BUY"))
    .replace(/\bAdd\b/g, decisionLabel("ADD"))
    .replace(/\bHold\b/g, decisionLabel("HOLD"))
    .replace(/\bWatch\b/g, decisionLabel("WATCH"))
    .replace(/\bReduce\b/g, decisionLabel("REDUCE"))
    .replace(/\bSell\b/g, decisionLabel("SELL"))
    .replace(/\bHigh\b/g, ratingLabel("High"))
    .replace(/\bMedium\b/g, ratingLabel("Medium"))
    .replace(/\bLow\b/g, ratingLabel("Low"))
    .replace(/\bofficial\b/gi, uiLabel("Official source"))
    .replace(/\bnews\b/gi, uiLabel("News source"));
}

function localizedObjectText(value = {}) {
  const arabicKeys = [
    "ar",
    "arabic",
    "arabicText",
    "textAr",
    "summaryAr",
    "explanationAr",
    "interpretationAr",
    "noteAr",
    "rationaleAr",
    "reasonAr",
    "titleAr",
    "nameAr"
  ];
  const englishKeys = [
    "en",
    "english",
    "englishText",
    "textEn",
    "summaryEn",
    "explanationEn",
    "interpretationEn",
    "noteEn",
    "rationaleEn",
    "reasonEn",
    "titleEn",
    "nameEn"
  ];
  const neutralKeys = [
    "text",
    "summary",
    "explanation",
    "interpretation",
    "note",
    "rationale",
    "reason",
    "title",
    "name",
    "value"
  ];
  const arabicText = firstObjectText(value, arabicKeys);
  const englishText = firstObjectText(value, englishKeys);
  const neutralText = firstObjectText(value, neutralKeys);
  const preferred = isArabicUi() ? (arabicText || neutralText || englishText) : (englishText || neutralText || arabicText);
  if (preferred) return localizedExternalText(preferred);
  return formatAnyValue(value);
}

function firstObjectText(value = {}, keys = []) {
  for (const key of keys) {
    const item = value[key];
    if (item === null || item === undefined) continue;
    if (typeof item === "object") {
      const nested = localizedExternalText(item);
      if (nested.trim()) return nested;
      continue;
    }
    const text = String(item).trim();
    if (text) return text;
  }
  return "";
}

function isArabicUi() {
  return document.documentElement.dir === "rtl" || document.documentElement.lang?.toLowerCase().startsWith("ar");
}

function labelFromKey(key) {
  return String(key || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function selectedExternalReport(store) {
  const selection = store.state.externalReportSelection || {};
  return getExternalAnalysis(store.state.externalAnalyses || {}, selection.ticker, selection.reportId);
}

function selectedQuarterlyScorecard(store) {
  const selection = store.state.quarterlyScorecard || {};
  return buildQuarterlyScorecard({
    historicalRequirementSets: store.state.historicalRequirementSets,
    externalAnalyses: store.state.externalAnalyses,
    ticker: selection.ticker,
    year: selection.year
  });
}

async function exportQuarterlyScorecard(store, mode) {
  const scorecard = selectedQuarterlyScorecard(store);
  if (!scorecard?.rows?.length) return;
  try {
    if (mode === "share") {
      const result = await shareQuarterlyScorecardPng(scorecard);
      if (!result.shared) {
        await downloadQuarterlyScorecardPng(scorecard);
        store.set({ notice: store.state.language === "ar" ? "المشاركة غير مدعومة؛ تم تنزيل PNG بدلًا منها." : "Sharing is unavailable; the PNG was downloaded instead." });
        return;
      }
      store.set({ notice: store.state.language === "ar" ? "تمت مشاركة بطاقة متابعة الأرباع." : "Quarterly scorecard shared." });
      return;
    }
    await downloadQuarterlyScorecardPng(scorecard);
    store.set({ notice: store.state.language === "ar" ? "تم تنزيل بطاقة متابعة الأرباع بصيغة PNG." : "Quarterly scorecard PNG downloaded." });
  } catch (error) {
    if (error?.name === "AbortError") return;
    store.set({ notice: store.state.language === "ar" ? "تعذر إنشاء صورة متابعة الأرباع." : "Could not create the quarterly scorecard image." });
  }
}

async function copySelectedExternalReport(store) {
  const report = selectedExternalReport(store);
  if (!report) return;
  const json = copyableExternalAnalysisJson(report);
  try {
    await copyTextForMobile(json);
    store.set({ notice: store.state.language === "ar" ? "تم نسخ JSON." : "JSON copied." });
  } catch {
    store.set({ notice: store.state.language === "ar" ? "تعذر نسخ JSON على هذا الجهاز." : "Could not copy JSON on this device." });
  }
}

async function copyMissingRequirements(store) {
  const result = store.currentMissingRequirementsPrompt?.() || { text: "", count: 0 };
  if (!result.text) {
    store.set({
      notice: result.message || (store.state.language === "ar" ? "لا توجد بيانات ناقصة في هذه المجموعة." : "There are no missing fields in this group.")
    });
    return;
  }
  try {
    await copyTextForMobile(result.text);
    store.set({
      externalImport: { ...store.state.externalImport, missingPromptFallback: "" },
      notice: store.state.language === "ar"
        ? `تم نسخ طلب استكمال ${result.count} حقول.`
        : `Copied completion request for ${result.count} fields.`
    });
  } catch {
    store.set({
      externalImport: { ...store.state.externalImport, missingPromptFallback: result.text },
      notice: store.state.language === "ar"
        ? "تعذر النسخ تلقائيًا. استخدم النص الظاهر للنسخ اليدوي."
        : "Automatic copy failed. Use the visible text area to copy manually."
    });
  }
}

async function copyNewEarningsAnalysisPrompt(store) {
  const text = store.currentNewEarningsAnalysisPrompt?.() || "";
  if (!text) return;
  try {
    await copyTextForMobile(text);
    store.set({
      notice: store.state.language === "ar"
        ? "تم نسخ برومبت تحليل إعلان الأرباح"
        : "Analyze New Earnings prompt copied."
    });
  } catch {
    store.set({
      externalImport: {
        ...store.state.externalImport,
        copyFallbackText: text,
        copyFallbackTitle: store.state.language === "ar" ? "انسخ برومبت إعلان الأرباح يدويًا" : "Copy earnings prompt manually",
        copyFallbackAction: "copy-new-earnings-prompt"
      },
      notice: store.state.language === "ar"
        ? "تعذر النسخ تلقائيًا. استخدم النص الظاهر للنسخ اليدوي."
        : "Automatic copy failed. Use the visible text area to copy manually."
    });
  }
}

async function copyEarningsUpdatePrompt(store) {
  const text = store.currentEarningsUpdatePrompt?.() || "";
  if (!text) return;
  try {
    await copyTextForMobile(text);
    store.set({
      notice: store.state.language === "ar"
        ? "تم نسخ برومبت تحديث إعلان الأرباح"
        : "Earnings update prompt copied."
    });
  } catch {
    store.set({
      externalImport: {
        ...store.state.externalImport,
        copyFallbackText: text,
        copyFallbackTitle: store.state.language === "ar" ? "انسخ برومبت تحديث الأرباح يدويًا" : "Copy earnings update prompt manually",
        copyFallbackAction: "copy-earnings-update-prompt"
      },
      notice: store.state.language === "ar"
        ? "تعذر النسخ تلقائيًا. استخدم النص الظاهر للنسخ اليدوي."
        : "Automatic copy failed. Use the visible text area to copy manually."
    });
  }
}

async function copyExternalAnalysisPrep(store, kind, tickerHint = "") {
  const isTemplate = kind === "template";
  const normalizedTicker = String(tickerHint || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 12);
  if (!normalizedTicker) {
    store.set({
      externalImport: { ...store.state.externalImport, tickerHint: "" },
      notice: store.state.language === "ar"
        ? "اكتب رمز السهم أولًا، ثم انسخ برومبت التحليل. لا يمكن إنشاء تحليل صحيح بدون رمز السهم."
        : "Enter the ticker before copying the analysis prompt."
    });
    return;
  }
  const text = isTemplate
    ? store.currentExternalAnalysisJsonTemplate?.(normalizedTicker)
    : store.currentFullAnalysisPrompt?.(normalizedTicker);
  if (!text) return;
  const copiedNotice = isTemplate
    ? (store.state.language === "ar" ? "تم نسخ JSON Template." : "JSON Template copied.")
    : (store.state.language === "ar" ? "تم نسخ برومبت تحليل السهم." : "Analysis prompt copied.");
  const fallbackTitle = isTemplate
    ? (store.state.language === "ar" ? "انسخ JSON Template يدويًا" : "Copy JSON Template manually")
    : (store.state.language === "ar" ? "انسخ برومبت التحليل يدويًا" : "Copy analysis prompt manually");
  try {
    await copyTextForMobile(text);
    store.set({
      externalImport: {
        ...store.state.externalImport,
        tickerHint: normalizedTicker,
        copyFallbackText: "",
        copyFallbackTitle: "",
        copyFallbackAction: ""
      },
      notice: copiedNotice
    });
  } catch {
    store.set({
      externalImport: {
        ...store.state.externalImport,
        tickerHint: normalizedTicker,
        copyFallbackText: text,
        copyFallbackTitle: fallbackTitle,
        copyFallbackAction: isTemplate ? "copy-external-json-template" : "copy-full-analysis-prompt"
      },
      notice: store.state.language === "ar"
        ? "تعذر النسخ تلقائيًا. استخدم النص الظاهر للنسخ اليدوي."
        : "Automatic copy failed. Use the visible text area to copy manually."
    });
  }
}

async function copyTextForMobile(text) {
  const value = String(text || "");
  if (!value) throw new Error("Nothing to copy");

  const fallback = document.createElement("textarea");
  fallback.value = value;
  fallback.setAttribute("readonly", "");
  fallback.setAttribute("aria-hidden", "true");
  Object.assign(fallback.style, {
    position: "fixed",
    top: "0",
    left: "-9999px",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none"
  });
  document.body.appendChild(fallback);
  fallback.focus({ preventScroll: true });
  fallback.select();
  fallback.setSelectionRange(0, value.length);
  let copied = false;
  try {
    copied = Boolean(document.execCommand?.("copy"));
  } catch {
    copied = false;
  }
  fallback.remove();
  if (copied) return true;

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }
  throw new Error("Clipboard unavailable");
}

function exportSelectedExternalReport(store) {
  const report = selectedExternalReport(store);
  if (!report) return;
  const blob = new Blob([copyableExternalAnalysisJson(report)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${report.company?.ticker || "external-analysis"}-${report.analysisDate || "report"}.json`;
  link.click();
  URL.revokeObjectURL(url);
  store.set({ notice: store.state.language === "ar" ? "تم تصدير JSON." : "JSON exported." });
}

function exportAllInvestmentData(store) {
  const backup = store.createInvestmentBackup?.();
  if (!backup) return;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `franklin-investment-data-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
  store.set({ notice: store.state.language === "ar" ? "تم تصدير كل بيانات الاستثمار بدون مفاتيح API." : "All investment data exported without API keys." });
}

function readInvestmentBackupFile(store, file) {
  const reader = new FileReader();
  reader.onload = () => store.previewInvestmentRestore(String(reader.result || ""));
  reader.onerror = () => store.set({
    notice: store.state.language === "ar" ? "تعذر قراءة ملف النسخة الاحتياطية." : "Could not read the backup file."
  });
  reader.readAsText(file);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
