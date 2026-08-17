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

const visiblePanels = new Set(["home", "external-import", "external-report", "company-profile", "history", "settings"]);

function visiblePanel(panel) {
  return visiblePanels.has(panel) ? panel : "home";
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
    bind(root, store, actions);
    return;
  }
  root.innerHTML = `
    <main class="mobile-app-shell">
      <section class="mobile-app-frame">
        ${mobileAppHeader(state)}
        ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
        <div class="mobile-page-content">${panelContent(state)}</div>
      </section>
    </main>
    ${evidenceDetailDialog()}
    <nav class="mobile-nav">
      ${panels.map(([key, label]) => `<button class="${state.activePanel === key ? "active" : ""}" data-panel="${key}">${uiLabel(label)}</button>`).join("")}
    </nav>
  `;
  bind(root, store, actions);
}

function homeDashboard(state) {
  return `
    <main class="mobile-app-shell library-home">
      <section class="mobile-app-frame">
        ${mobileAppHeader(state, true)}
        <div class="mobile-page-content">
          ${homePolishedSearch(state)}
          ${externalAnalysesHomeSection(state)}
        </div>
      </section>
    </main>
    <nav class="mobile-nav">
      ${panels.map(([key, label]) => `<button class="${state.activePanel === key ? "active" : ""}" data-panel="${key}">${uiLabel(label)}</button>`).join("")}
    </nav>
  `;
}

function mobileAppHeader(state, isHome = false) {
  const title = isHome ? uiLabel("My Stocks") : activePanelLabel(state.activePanel);
  return `
    <header class="mobile-app-header">
      <div class="mobile-brand">
        <img class="app-logo" src="./assets/icon-192.png" alt="">
        <div>
          <strong>Franklin</strong>
          <span>${escapeHtml(title)}</span>
        </div>
      </div>
      <div class="mobile-header-actions">
        ${isHome ? `<button class="primary-btn compact-primary" data-action="open-external-import">${uiLabel("إضافة سهم")}</button>` : `<button class="icon-btn back-home" data-panel="home">${uiLabel("Home")}</button>`}
        <details class="mobile-app-menu">
          <summary aria-label="${uiLabel("More")}">•••</summary>
          <div>
            ${languageToggle(state)}
            <button class="icon-btn" data-action="toggle-theme">${state.theme === "dark" ? uiLabel("Light") : uiLabel("Dark")}</button>
          </div>
        </details>
      </div>
    </header>
  `;
}

function languageToggle(state) {
  return `
    <div class="language-toggle" role="group" aria-label="Language">
      <button class="${state.language === "ar" ? "active" : ""}" data-language="ar">العربية</button>
      <span></span>
      <button class="${state.language === "en" ? "active" : ""}" data-language="en">English</button>
    </div>
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
      <div class="table-title">
        <div>
          <h2>${uiLabel("My Stocks")}</h2>
        </div>
        <div class="library-stats">
          <span>${allReports.length} ${uiLabel("Stocks")}</span>
          <span>${totalReports} ${uiLabel("Analyses")}</span>
        </div>
      </div>
      ${watchlistToolbar(state)}
      ${reports.length ? `
        <div class="library-card-grid">
          ${reports.map((report) => externalHomeCard(report)).join("")}
        </div>
      ` : externalLibraryEmptyState()}
    </section>
  `;
}

function externalHomeCard(report) {
  const currentPriceLabel = Number.isFinite(numericValue(report.currentPrice)) && Number.isFinite(numericValue(report.priceAtAnalysis)) && numericValue(report.currentPrice) !== numericValue(report.priceAtAnalysis)
    ? uiLabel("Current Price")
    : uiLabel("Price at Analysis");
  const lastUpdate = report.reportPeriod || report.analysisDate || "-";
  return `
    <article class="company-card external-company-card library-company-card terminal-watchlist-row" data-external-ticker="${escapeHtml(report.ticker)}" data-external-report-id="${escapeHtml(report.id)}" data-library-card data-search-text="${escapeHtml(`${report.ticker} ${report.companyName}`.toLowerCase())}">
      <div class="company-card-top library-card-top">
        <div>
          <strong>${escapeHtml(report.ticker)}</strong>
          <span>${escapeHtml(report.companyName || uiLabel("Company"))}</span>
        </div>
        <em class="${colorClass(recommendationColorCategory(report.verdict), "badge")}">${escapeHtml(localizedExternalText(report.verdict) || "-")}</em>
      </div>
      <div class="library-card-metrics">
        ${compactCardMetric(currentPriceLabel, money(report.currentPrice, 2))}
        ${compactCardMetric("Base", money(report.baseFairValue, 0))}
        ${compactCardMetric("Bull", money(report.bullFairValue, 0))}
        ${compactCardMetric(uiLabel("Upside"), formatExternalPercent(report.upsideToBasePct))}
        ${compactCardMetric(uiLabel("Last Update"), lastUpdate)}
      </div>
      ${libraryCompletionRow(report.completionStatus)}
      <div class="company-card-footer library-card-footer">
        <span>${uiLabel("Open saved report")}</span>
        <div class="library-card-actions">
          ${report.hasCompanyProfile ? `<button class="profile-pill" data-profile-ticker="${escapeHtml(report.ticker)}" data-profile-report-id="${escapeHtml(report.id)}">${uiLabel("Company Profile")}</button>` : ""}
          <small>${uiLabel("Open report")}</small>
        </div>
      </div>
    </article>
  `;
}

function watchlistToolbar(state) {
  return `
    <div class="watchlist-toolbar">
      <label>
        <span>${uiLabel("Filter")}</span>
        <select data-library-filter>
          ${watchlistFilterOption("all", uiLabel("All"), state.libraryFilter)}
          ${watchlistFilterOption("buy", decisionLabel("BUY"), state.libraryFilter)}
          ${watchlistFilterOption("hold", decisionLabel("HOLD"), state.libraryFilter)}
          ${watchlistFilterOption("sell", decisionLabel("SELL"), state.libraryFilter)}
          ${watchlistFilterOption("incomplete", uiLabel("Incomplete"), state.libraryFilter)}
        </select>
      </label>
      <label>
        <span>${uiLabel("Sort")}</span>
        <select data-library-sort>
          ${watchlistFilterOption("latest", uiLabel("Latest Update"), state.librarySort)}
          ${watchlistFilterOption("upside", uiLabel("Highest Upside"), state.librarySort)}
          ${watchlistFilterOption("ticker", uiLabel("Ticker"), state.librarySort)}
        </select>
      </label>
      <button class="primary-btn compact-primary" data-action="open-external-import">${uiLabel("إضافة سهم")}</button>
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
  const items = [
    [uiLabel("Stocks"), reports.length, "neutral"],
    [decisionLabel("BUY"), counts.BUY || 0, "positive"],
    [decisionLabel("ADD"), counts.ADD || 0, "positive"],
    [decisionLabel("HOLD"), counts.HOLD || 0, "warning"],
    [decisionLabel("WATCH"), counts.WATCH || 0, "neutral"],
    [decisionLabel("REDUCE"), counts.REDUCE || 0, "warning"],
    [decisionLabel("SELL"), counts.SELL || 0, "negative"]
  ];
  return `
    <div class="investment-library-summary" aria-label="${uiLabel("Portfolio status summary")}">
      ${items.map(([label, value, tone]) => `
        <article class="library-summary-card ${colorClass(tone, "tone")}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(String(value))}</strong>
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
  const subtitle = `${label} Case`;
  const primaryLabel = label === "Bear" ? uiLabel("Bear Scenario Label") : label === "Bull" ? uiLabel("Bull Scenario Label") : uiLabel("Base Scenario Label");
  const delta = Number.isFinite(value) && Number.isFinite(currentPrice) && currentPrice > 0 ? (value - currentPrice) / currentPrice : null;
  return `
    <article class="${className}">
      <span>${escapeHtml(primaryLabel)} <em>${escapeHtml(subtitle)}</em></span>
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
  if (state.activePanel === "company-profile") return companyProfileView(state);
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
          <input data-external-ticker-hint dir="ltr" autocomplete="off" autocapitalize="characters" placeholder="AMZN" value="${escapeHtml(state.externalImport?.tickerHint || "")}">
        </label>
        <p>${uiLabel("Use this when the pasted report does not clearly include the ticker.")}</p>
      </div>
      ${externalChatGptPrepCard(state)}
      <textarea class="paste-box external-paste-box" data-external-raw placeholder="${uiLabel("Paste completed ChatGPT analysis or ExternalAnalysisReport JSON here.")}">${escapeHtml(state.externalImport?.rawText || "")}</textarea>
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
      <textarea class="paste-box supplement-paste-box" data-supplement-raw placeholder="${uiLabel("Paste supplementary ChatGPT response here.")}">${escapeHtml(supplement.rawText || "")}</textarea>
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
        ${metricHtml(uiLabel("Price at Analysis"), money(report.market?.priceAtAnalysis, 2))}
        ${metricHtml("Base Fair Value", money(report.fairValue?.base, 0))}
        ${metricHtml(uiLabel("Verdict"), escapeHtml(report.decision?.verdict || "-"))}
      </div>
      ${historicalRequirementMatchPreview(state.externalImport?.requirementMatch)}
      <div class="external-preview-grid">
        ${externalInput("company.ticker", "Ticker", report.company?.ticker)}
        ${externalInput("company.name", uiLabel("Company"), report.company?.name)}
        ${externalInput("analysisDate", uiLabel("Analysis Date"), report.analysisDate, "date")}
        ${externalInput("reportPeriod", uiLabel("Report Period"), report.reportPeriod)}
        ${externalInput("market.priceAtAnalysis", uiLabel("Price at Analysis"), report.market?.priceAtAnalysis, "number")}
        ${externalInput("scores.quality", "Quality", report.scores?.quality, "number")}
        ${externalInput("scores.growth", "Growth", report.scores?.growth, "number")}
        ${externalInput("scores.valuation", "Valuation", report.scores?.valuation, "number")}
        ${externalInput("scores.risk", "Risk", report.scores?.risk, "number")}
        ${externalInput("scores.overall", "Overall", report.scores?.overall, "number")}
        ${externalInput("fairValue.bear", "Bear Fair Value", report.fairValue?.bear, "number")}
        ${externalInput("fairValue.base", "Base Fair Value", report.fairValue?.base, "number")}
        ${externalInput("fairValue.bull", "Bull Fair Value", report.fairValue?.bull, "number")}
        ${externalInput("decision.verdict", uiLabel("Verdict"), report.decision?.verdict)}
      </div>
      <div class="external-text-editors">
        <label>${uiLabel("Investment Thesis")}<textarea data-external-field="thesis.shortSummary">${escapeHtml(report.thesis?.shortSummary || "")}</textarea></label>
        <label>${uiLabel("Decision Rationale")}<textarea data-external-field="decision.rationale">${escapeHtml(report.decision?.rationale || "")}</textarea></label>
      </div>
      <details class="report-detail advanced-json-block">
        <summary>${uiLabel("Advanced JSON")}</summary>
        <div>
          <p class="muted">${uiLabel("Advanced editor. Edit any field in JSON, then leave the field to re-validate.")}</p>
          <textarea class="paste-box external-json-editor" data-external-json>${escapeHtml(state.externalImport?.draftJson || JSON.stringify(report, null, 2))}</textarea>
        </div>
      </details>
    </section>
  `;
}

function externalInput(path, label, value, type = "text") {
  return `
    <label>
      <span>${escapeHtml(label)}</span>
      <input data-external-field="${escapeHtml(path)}" type="${type}" value="${escapeHtml(value ?? "")}">
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
    "fairValue.bear": "Bear Fair Value مطلوب ويجب أن يكون أكبر من صفر.",
    "fairValue.base": "Base Fair Value مطلوب ويجب أن يكون أكبر من صفر.",
    "fairValue.bull": "Bull Fair Value مطلوب ويجب أن يكون أكبر من صفر.",
    "thesis.shortSummary": "ملخص فرضية الاستثمار مطلوب.",
    risks: "يجب إدخال مخاطرة رئيسية واحدة على الأقل.",
    "decision.verdict": "التوصية النهائية مطلوبة ويجب أن تكون مذكورة في التحليل.",
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
                <em>${escapeHtml(localizedExternalText(report.decision?.verdict) || "-")}</em>
              </span>
              <span class="history-card-date" dir="auto"><bdi>${escapeHtml(report.analysisDate || "-")}</bdi>${report.reportPeriod ? ` · <bdi>${escapeHtml(report.reportPeriod)}</bdi>` : ""}</span>
              <span class="history-card-values">
                <span><small>${uiLabel("Price at Analysis")}</small><strong dir="ltr"><bdi>${money(report.market?.priceAtAnalysis, 2)}</bdi></strong></span>
                <span><small>${uiLabel("Base Fair Value")}</small><strong dir="ltr"><bdi>${money(report.fairValue?.base, 0)}</bdi></strong></span>
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
      <p>${escapeHtml(text)}</p>
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
              <strong>${escapeHtml(companyActivityTitle(activity))}</strong>
              ${companyActivitySubtitle(activity) ? `<span>${escapeHtml(companyActivitySubtitle(activity))}</span>` : ""}
            </div>
            ${localizedExternalText(activity.description).trim() ? `
              <p><b>${uiLabel("What is it?")}</b> ${escapeHtml(localizedExternalText(activity.description))}</p>
            ` : ""}
            ${localizedExternalText(activity.importance).trim() ? `
              <p><b>${uiLabel("Why does it matter?")}</b> ${escapeHtml(localizedExternalText(activity.importance))}</p>
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
      <ul>${visible.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
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
      ${reportSavedBanner(state.notice, report)}
      ${stockDecisionHeader(reportWithCompletion, completion)}
      ${dataHealthTerminalGuard(reportWithCompletion, completion)}
      <section class="stock-decision-flow">
        ${stockSection(uiLabel("فرصة الاستثمار"), investmentSummaryWorkspace(report))}
        ${qualityGrowthRiskPanel(report)}
        ${latestEarningsWorkspace(report)}
        ${stockSection(uiLabel("بيانات الاستثمار"), investmentDataTableArea(report))}
        ${stockSection(uiLabel("طرق التقييم"), valuationMethodsDashboard(report))}
        ${stockSection(uiLabel("المزايا والمخاطر"), strengthsRisksDashboard(report))}
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

function stockDecisionHeader(report = {}, completion = {}) {
  const ticker = report.company?.ticker || "-";
  const companyName = report.company?.name || ticker;
  const action = externalRecommendationAction(report);
  const current = report.market?.currentPrice ?? report.market?.priceAtAnalysis;
  const upside = report.fairValue?.upsideToBasePct;
  const potential = report.fairValue?.upsideToBullPct ?? report.fairValue?.maxUpsidePct ?? report.fairValue?.upsideToBasePct;
  return `
    <header id="stock-report-top" class="panel stock-decision-header terminal-stock-header">
      <div class="stock-title-block terminal-stock-identity">
        <div>
          <div class="stock-title-row">
            <h2><bdi>${escapeHtml(ticker)}</bdi></h2>
            ${report.companyProfile ? `<button class="ticker-profile-button" data-profile-ticker="${escapeHtml(ticker)}" data-profile-report-id="${escapeHtml(report.id || "latest")}">${uiLabel("Company Profile")}</button>` : ""}
          </div>
          <strong>${escapeHtml(companyName)}</strong>
        </div>
      </div>
      <div class="mobile-report-facts">
        <article class="recommendation-fact ${colorClass(recommendationColorCategory(action), "tone")}">
          <span>${uiLabel("Recommendation")}</span>
          <strong>${escapeHtml(localizedExternalText(action) || "-")}</strong>
        </article>
        <article>
          <span>${uiLabel("Current Price")}</span>
          <strong><bdi>${money(current, 2)}</bdi></strong>
        </article>
        <article>
          <span>${uiLabel("آخر تحديث")}</span>
          <strong><bdi>${escapeHtml(report.reportPeriod || report.analysisDate || "—")}</bdi></strong>
        </article>
      </div>
      <div class="mobile-scenario-grid terminal-header-strip">
        ${stockSummaryMetric("Bear", money(report.fairValue?.bear, 0), "bear")}
        ${stockSummaryMetric("Base", money(report.fairValue?.base, 0), "base")}
        ${stockSummaryMetric("Bull", money(report.fairValue?.bull, 0), "bull")}
        ${stockSummaryMetric(uiLabel("العائد المحتمل"), formatExternalPercent(potential), upsideColorCategory(numericValue(upside)))}
      </div>
    </header>
  `;
}

function dataHealthTerminalGuard(report = {}, completion = {}) {
  if (!completion) return "";
  const missingRequired = completion.missingRequiredPaths?.length || completion.details?.criticalRequired?.length || 0;
  const missingRecommended = completion.missingRecommendedPaths?.length || completion.details?.recommended?.length || 0;
  const status = String(completion.status || "incomplete");
  const tone = status === "complete" ? "complete" : status === "invalid" || status === "has_conflicts" ? "invalid" : "incomplete";
  const statusText = status === "complete"
    ? (isArabicUi() ? "البيانات مكتملة" : "Data complete")
    : tone === "invalid"
      ? (isArabicUi() ? "التحديث غير موثّق" : "Update not verified")
      : (isArabicUi() ? "بيانات ناقصة" : "Missing data");
  return `
    <section class="data-health-terminal-guard ${tone}">
      <div>
        <span class="guard-icon" aria-hidden="true"></span>
        <div>
          <strong>${escapeHtml(statusText)}</strong>
          <p>${boundedPercent(completion.completionPct)}% ${uiLabel("Data Completion")}</p>
        </div>
      </div>
      ${status === "complete" ? "" : `<div class="guard-stats">
        <span>${uiLabel("Required")}: <b>${escapeHtml(String(missingRequired))}</b></span>
        <span>${uiLabel("Recommended")}: <b>${escapeHtml(String(missingRecommended))}</b></span>
        <button class="icon-btn" data-action="start-report-supplement" data-external-ticker="${escapeHtml(report.company?.ticker || "")}" data-external-report-id="${escapeHtml(report.id || "")}">${uiLabel("إكمال البيانات")}</button>
      </div>`}
    </section>
  `;
}

function stockSummaryMetric(label, value, tone = "neutral") {
  return `<article class="stock-summary-metric ${escapeHtml(tone)}"><span>${escapeHtml(label)}</span><strong><bdi>${escapeHtml(String(value || "—"))}</bdi></strong></article>`;
}

function stockSection(title, body) {
  if (!hasRenderableContent(body)) return "";
  return `
    <section class="panel stock-report-section">
      <header><h3>${escapeHtml(title)}</h3></header>
      <div>${body}</div>
    </section>
  `;
}

function investmentSummaryWorkspace(report = {}) {
  const thesis = firstUsefulText([
    report.thesis?.shortSummary,
    report.decision?.rationale,
    report.recommendation?.reason,
    report.thesis?.fullSummary
  ]);
  return `
    <div class="investment-summary-workspace">
      <p>${escapeHtml(shortText(thesis || uiLabel("Not provided in the imported analysis."), 520))}</p>
      ${report.thesis?.fullSummary ? externalDetail(uiLabel("Full thesis"), `<p>${escapeHtml(localizedExternalText(report.thesis.fullSummary))}</p>`) : ""}
    </div>
  `;
}

function stockScoreBar(report = {}) {
  const metrics = [
    [financialTerm("Quality"), report.scores?.quality],
    [financialTerm("Growth"), report.scores?.growth],
    [uiLabel("Valuation"), report.scores?.valuation],
    [financialTerm("Risk"), report.scores?.risk],
    [uiLabel("Investment Score"), report.scores?.overall]
  ];
  return `
    <section class="stock-score-bar" aria-label="${uiLabel("Investment Score")}">
      ${metrics.map(([label, value]) => scoreBarItem(label, value)).join("")}
    </section>
  `;
}

function scoreBarItem(label, value) {
  const score = numericValue(value);
  const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, score * 10)) : 0;
  return `
    <article class="${scoreToneClass(score)}">
      <span>${escapeHtml(label)}</span>
      <strong dir="ltr">${scoreText(value, 1)}</strong>
      <i><b style="width:${pct}%"></b></i>
    </article>
  `;
}

function latestEarningsWorkspace(report = {}) {
  const previous = report.previousRequirementsEvaluation;
  const hasPreviousEvaluation = (previous?.requirements || []).length > 0;
  if (!hasPreviousEvaluation) {
    return stockSection(uiLabel("Latest Earnings Execution"), `
      <div class="earnings-empty-state">
        <strong>${uiLabel("لا توجد متطلبات سابقة للمقارنة مع هذا الإعلان.")}</strong>
        <button class="primary-btn" data-action="open-earnings-update">${uiLabel("تحليل إعلان جديد")}</button>
      </div>
    `);
  }
  const rows = earningsSnapshotRows(report);
  const hasGuidance = hasRenderableContent(guidanceTableView(report));
  const assessment = previous?.requirementsAssessment || report.requirementsAssessment || {};
  return stockSection(uiLabel("Latest Earnings Execution"), `
    <div class="earnings-dashboard latest-earnings-terminal">
      <div class="earnings-dashboard-head">
        <div>
          <p class="eyebrow">${escapeHtml(report.reportPeriod || report.analysisDate || "")}</p>
        </div>
        <button class="compact-inline-action" data-action="open-earnings-update">${uiLabel("تحليل إعلان جديد")}</button>
      </div>
      <div class="earnings-status-grid">
        ${compactCardMetric(uiLabel("Passed"), assessmentNumberText(assessment.passedRequirements ?? assessment.passed))}
        ${compactCardMetric(uiLabel("Partially Passed"), assessmentNumberText(assessment.partiallyPassedRequirements ?? assessment.partiallyPassed))}
        ${compactCardMetric(uiLabel("Failed"), assessmentNumberText(assessment.failedRequirements ?? assessment.failed))}
        ${compactCardMetric(uiLabel("Requirement achievement"), Number.isFinite(numericValue(assessment.weightedAchievement)) ? `${Math.round(numericValue(assessment.weightedAchievement))}%` : "—")}
      </div>
      ${assessment.overallStatus ? `<p class="earnings-overall">${escapeHtml(requirementsStatusLabel(assessment.overallStatus))}</p>` : ""}
      ${rows.length ? externalDetail(uiLabel("Earnings Snapshot"), metricRows(rows)) : ""}
      ${hasPreviousEvaluation ? externalDetail(uiLabel("Earnings Requirement Results"), previousRequirementExecutionView(previous), true) : ""}
      ${hasGuidance ? externalDetail(uiLabel("Guidance"), guidanceTableView(report)) : ""}
    </div>
  `);
}

function earningsSnapshotRows(report = {}) {
  const highlights = report.financialHighlights || {};
  const growth = report.growthHighlights || {};
  return [
    [financialTerm("Revenue"), highlights.revenue],
    [uiLabel("Revenue Growth"), highlights.revenueGrowthPct ?? growth.revenueGrowth],
    [financialTerm("EPS"), highlights.epsNormalized ?? highlights.epsReported ?? growth.epsGrowth],
    [financialTerm("Operating Margin"), highlights.operatingMarginPct ?? growth.marginTrend],
    [financialTerm("Free Cash Flow"), highlights.freeCashFlow],
    [uiLabel("Guidance"), firstGuidanceValue(report)]
  ].filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function firstGuidanceValue(report = {}) {
  const next = report.nextQuarterGuidance?.items?.[0];
  if (next) return `${next.arabicTopic || next.topic || uiLabel("Guidance")}: ${formatAnyValue(next.guidance)}`;
  const current = Array.isArray(report.guidance) ? report.guidance[0] : null;
  if (!current) return "";
  if (typeof current === "string") return current;
  return `${current.arabicTopic || current.topic || current.title || uiLabel("Guidance")}: ${formatAnyValue(current.currentGuidance || current.guidance || current.value)}`;
}

function metricRows(rows = []) {
  return `
    <div class="compact-metric-rows">
      ${rows.map(([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <strong dir="ltr">${escapeHtml(formatAnyValue(value))}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function compactQualityWorkspace(report = {}) {
  const rows = [
    [financialTerm("Quality"), scoreText(report.scores?.quality, 1)],
    [uiLabel("Economic Moat"), report.quality?.moat],
    [uiLabel("Profitability"), report.quality?.profitability],
    [uiLabel("Balance Sheet"), report.quality?.balanceSheet],
    [uiLabel("Earnings Quality"), report.earningsQuality?.status || report.quality?.earningsQuality]
  ].filter(([, value]) => !isEmptyDisplayValue(value));
  return `
    ${metricRows(rows)}
    ${paragraphBlock([qualityCompactSummary(report)])}
    ${report.quality?.strengths?.length ? externalDetail(uiLabel("Key Strengths"), compactEvidenceList(report.quality.strengths)) : ""}
  `;
}

function compactGrowthWorkspace(report = {}) {
  const growth = report.growthHighlights || {};
  const rows = [
    [financialTerm("Growth"), scoreText(report.scores?.growth, 1)],
    [uiLabel("Revenue Growth"), growth.revenueGrowth || report.financialHighlights?.revenueGrowthPct],
    [uiLabel("EPS Growth"), growth.epsGrowth],
    [uiLabel("FCF Growth"), growth.fcfGrowth],
    [uiLabel("Margin Trend"), growth.marginTrend]
  ].filter(([, value]) => !isEmptyDisplayValue(value));
  return `
    ${metricRows(rows)}
    ${paragraphBlock([growthCompactSummary(report)])}
    ${report.companySpecificKpis?.length ? externalDetail(uiLabel("Company KPIs"), companyKpisTableView(report.companySpecificKpis)) : ""}
  `;
}

function financialHighlightsDashboard(report = {}) {
  return financialPerformanceTableView(report) || emptyDashboardState(uiLabel("Not provided in the imported analysis."));
}

function fairValueDashboard(report = {}) {
  const current = report.market?.currentPrice ?? report.market?.priceAtAnalysis;
  return `
    <div class="fair-value-dashboard">
      <div class="fair-value-scenarios">
        ${fairValueScenario("Bear", report.fairValue?.bear, current)}
        ${fairValueScenario("Base", report.fairValue?.base, current, true)}
        ${fairValueScenario("Bull", report.fairValue?.bull, current)}
      </div>
      <div class="fair-value-context">
        ${miniEvidence(uiLabel("Current Price"), money(current, 2))}
        ${miniEvidence(uiLabel("Weighted Fair Value"), money(report.fairValue?.weightedFairValue, 0))}
        ${miniEvidence(uiLabel("Upside"), formatExternalPercent(report.fairValue?.upsideToBasePct))}
      </div>
    </div>
  `;
}

function fairValueScenario(label, value, currentPrice, featured = false) {
  const upside = Number.isFinite(numericValue(value)) && Number.isFinite(numericValue(currentPrice))
    ? ((numericValue(value) - numericValue(currentPrice)) / numericValue(currentPrice)) * 100
    : null;
  return `
    <article class="fair-value-scenario ${featured ? "featured" : ""} valuation-card-${label.toLowerCase()}">
      <span>${escapeHtml(uiLabel(`${label} Scenario Label`))}</span>
      <strong dir="ltr">${money(value, 0)}</strong>
      <em dir="ltr">${Number.isFinite(upside) ? formatExternalPercent(upside) : "—"}</em>
    </article>
  `;
}

function qualityGrowthRiskPanel(report = {}) {
  const rows = [
    {
      label: uiLabel("جودة الشركة"),
      value: report.scores?.quality,
      status: qualitativeScoreLabel(report.scores?.quality, false),
      detail: compactQualityWorkspace(report)
    },
    {
      label: uiLabel("النمو"),
      value: report.scores?.growth,
      status: qualitativeScoreLabel(report.scores?.growth, false),
      detail: compactGrowthWorkspace(report)
    },
    {
      label: uiLabel("المخاطر"),
      value: report.scores?.risk,
      status: qualitativeScoreLabel(report.scores?.risk, true),
      detail: paragraphBlock([riskCompactSummary(report)])
    }
  ].filter((row) => !isEmptyDisplayValue(row.value) || hasRenderableContent(row.detail));
  if (!rows.length) return "";
  return `
    <section class="panel stock-report-section qgr-performance-panel">
      <header><h3>${uiLabel("جودة الشركة / النمو / المخاطر")}</h3></header>
      <div class="qgr-row-list">
        ${rows.map((row) => `
          <details class="qgr-row">
            <summary>
              <span>${escapeHtml(row.label)}</span>
              <strong dir="ltr">${escapeHtml(scoreText(row.value, 1))}</strong>
              <em>${escapeHtml(row.status)}</em>
              <b>›</b>
            </summary>
            <div>${row.detail || emptyDashboardState(uiLabel("Not provided in the imported analysis."))}</div>
          </details>
        `).join("")}
      </div>
    </section>
  `;
}

function qualitativeScoreLabel(value, inverse = false) {
  const score = numericValue(value);
  if (!Number.isFinite(score)) return "—";
  if (inverse) {
    if (score <= 3.5) return uiLabel("منخفضة");
    if (score <= 6.5) return uiLabel("متوسطة");
    return uiLabel("مرتفعة");
  }
  if (score >= 8.5) return uiLabel("ممتازة");
  if (score >= 7) return uiLabel("قوية");
  if (score >= 5) return uiLabel("متوسطة");
  return uiLabel("ضعيفة");
}

function valuationMethodsDashboard(report = {}) {
  const rows = Object.entries(report.valuationMethods || {})
    .map(([key, value]) => normalizeValuationMethodForDisplay(key, value))
    .filter(Boolean);
  if (!rows.length) return valuationMethodSummaryView(report) || emptyDashboardState(uiLabel("Not provided in the imported analysis."));
  return compactFinancialTable({
    caption: uiLabel("Valuation Methods Used"),
    columns: [uiLabel("Role"), uiLabel("Output Value"), uiLabel("Weight"), uiLabel("Confidence")],
    rows: rows.map((row) => ({
      label: humanValuationMethodLabel(row.method || row.key),
      cells: [
        { value: valuationRoleLabel(row.role) },
        { value: formatValuationFairValue(row.fairValue), dir: "ltr" },
        { value: formatNullablePercent(row.weight), dir: "ltr" },
        { value: formatNullablePercent(row.confidence), dir: "ltr" }
      ],
      detail: paragraphBlock([row.explanation, row.limitation])
    }))
  });
}

function scenariosDashboard(report = {}) {
  const scenarios = normalizeScenarioRows(report);
  if (!scenarios.length) return emptyDashboardState(uiLabel("Not provided in the imported analysis."));
  return compactFinancialTable({
    caption: "Bear / Base / Bull",
    columns: [uiLabel("Fair Value"), uiLabel("Upside"), uiLabel("Probability"), uiLabel("Thesis Status")],
    rows: scenarios.map((scenario) => ({
      label: scenario.label,
      cells: [
        { value: money(scenario.fairValue, 0), dir: "ltr" },
        { value: formatExternalPercent(scenario.upside), dir: "ltr" },
        { value: formatNullablePercent(scenario.probability), dir: "ltr" },
        { value: scenario.status || "—" }
      ],
      detail: paragraphBlock([scenario.thesis, scenario.assumptions, scenario.keyRisks])
    }))
  });
}

function normalizeScenarioRows(report = {}) {
  const raw = report.scenarios || {};
  const fallback = [
    ["Bear", report.fairValue?.bear, report.fairValue?.downsideToBearPct],
    ["Base", report.fairValue?.base, report.fairValue?.upsideToBasePct],
    ["Bull", report.fairValue?.bull, report.fairValue?.upsideToBullPct]
  ];
  const rows = Object.entries(raw || {}).map(([key, scenario]) => ({
    label: humanValuationMethodLabel(key).replace("تقييم ", "") || key,
    fairValue: scenario?.fairValue ?? scenario?.value,
    upside: scenario?.upsideDownsidePercent ?? scenario?.upside,
    probability: scenario?.probability,
    status: scenario?.enabled === false ? uiLabel("Not Applicable") : "",
    thesis: scenario?.thesis,
    assumptions: scenario?.assumptions || scenario?.requiredOutcomes,
    keyRisks: scenario?.keyRisks
  })).filter((item) => !isEmptyDisplayValue(item.fairValue) || !isEmptyDisplayValue(item.thesis));
  return rows.length ? rows : fallback
    .filter(([, value]) => Number.isFinite(numericValue(value)))
    .map(([label, fairValue, upside]) => ({ label, fairValue, upside, probability: null }));
}

function strengthsRisksDashboard(report = {}) {
  return strengthsRisksSummaryView(report) || emptyDashboardState(uiLabel("Not provided in the imported analysis."));
}

function catalystsDashboard(report = {}) {
  const catalysts = Array.isArray(report.catalysts) ? report.catalysts : [];
  if (!catalysts.length) return "";
  return compactEvidenceList(catalysts, "", "catalyst");
}

function monitoringChecklistDashboard(report = {}) {
  const items = Array.isArray(report.monitoringChecklist) && report.monitoringChecklist.length
    ? report.monitoringChecklist
    : report.watchItems || [];
  if (!items.length) return "";
  return compactEvidenceList(items, "", "watch");
}

function finalDecisionDashboard(report = {}) {
  return `
    ${externalRecommendationView(report)}
    ${recommendationConditionsView(report) ? externalDetail(uiLabel("Recommendation Upgrade / Downgrade Conditions"), recommendationConditionsView(report)) : ""}
  `;
}

function miniEvidence(label, value) {
  return `<span class="mini-evidence"><b dir="auto">${escapeHtml(label)}</b><strong dir="auto"><bdi>${escapeHtml(formatAnyValue(value))}</bdi></strong></span>`;
}

function emptyDashboardState(text) {
  return `<p class="compact-empty-state">${escapeHtml(text)}</p>`;
}

function isEmptyDisplayValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "" || value === "—" || value === "-";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function earningsUpdateDrawer(state) {
  const workflow = state.earningsUpdate || {};
  if (!workflow.open) return "";
  const report = getExternalAnalysis(state.externalAnalyses || {}, state.externalReportSelection?.ticker, state.externalReportSelection?.reportId);
  const ticker = report?.company?.ticker || workflow.ticker || "-";
  return `
    <section class="earnings-update-overlay" role="dialog" aria-modal="true" aria-label="${uiLabel("Analyze New Earnings")}">
      <div class="earnings-update-sheet">
        <header class="earnings-update-head">
          <div>
            <p class="eyebrow" dir="ltr">${escapeHtml(ticker)}</p>
            <h3>${uiLabel("Analyze New Earnings")}</h3>
            <span>${uiLabel("Franklin يجهّز النقل فقط. ChatGPT يحلل، وFranklin يحفظ JSON الناتج.")}</span>
          </div>
          <button class="icon-btn" data-action="close-earnings-update">${uiLabel("Cancel")}</button>
        </header>
        <div class="earnings-update-steps">
          ${earningsStepPill("1", uiLabel("Paste"), workflow.step === 1)}
          ${earningsStepPill("2", uiLabel("Prompt"), workflow.step === 2)}
          ${earningsStepPill("3", uiLabel("JSON"), workflow.step === 3 || workflow.step === "preview")}
          ${earningsStepPill("4", uiLabel("Save"), workflow.step === "success")}
        </div>
        ${earningsUpdateStepBody(workflow, report, state)}
      </div>
    </section>
  `;
}

function earningsStepPill(number, label, active) {
  return `<span class="${active ? "active" : ""}"><b>${escapeHtml(number)}</b>${escapeHtml(label)}</span>`;
}

function earningsUpdateStepBody(workflow = {}, report = {}, state = {}) {
  if (workflow.step === "success") return earningsUpdateSuccess(workflow);
  if (workflow.step === "preview") return earningsUpdatePreview(workflow, state);
  if (workflow.step === 2) return earningsPromptStep(workflow);
  return workflow.step === 3 ? earningsJsonStep(workflow, state) : earningsPasteStep(workflow, report);
}

function earningsPasteStep(workflow = {}, report = {}) {
  return `
    <div class="earnings-update-body">
      <h4>${uiLabel("أضف تقرير الأرباح")}</h4>
      <p>${uiLabel("الصق نص إعلان الأرباح أو أهم مقتطفات 10-Q أو مكالمة الإدارة. Franklin سيضعها داخل برومبت جاهز لـ ChatGPT.")}</p>
      <textarea class="paste-box earnings-paste-box" data-earnings-field="earningsText" placeholder="${uiLabel("الصق مواد إعلان الأرباح هنا.")}">${escapeHtml(workflow.earningsText || "")}</textarea>
      <div class="earnings-context-strip">
        ${miniEvidence(uiLabel("Recommendation"), localizedExternalText(externalRecommendationAction(report)) || "-")}
        ${miniEvidence(uiLabel("Base Fair Value"), money(report?.fairValue?.base, 0))}
        ${miniEvidence(uiLabel("Requirements"), String(report?.priceTargetRequirements?.requirements?.length || 0))}
      </div>
      <div class="earnings-update-actions">
        <button class="primary-btn" data-action="prepare-earnings-prompt">${uiLabel("Next")}</button>
        <button class="icon-btn" data-action="close-earnings-update">${uiLabel("Cancel")}</button>
      </div>
    </div>
  `;
}

function earningsPromptStep(workflow = {}) {
  const prompt = workflow.generatedPrompt || "";
  return `
    <div class="earnings-update-body">
      <h4>${uiLabel("أرسل التقرير إلى ChatGPT")}</h4>
      <p>${uiLabel("انسخ هذا البرومبت وأرسله إلى ChatGPT. يحتوي على المتطلبات القديمة وقالب JSON الذي يعرف Franklin استيراده.")}</p>
      <textarea class="paste-box earnings-prompt-box" readonly data-earnings-generated-prompt>${escapeHtml(prompt)}</textarea>
      <div class="earnings-update-actions">
        <button class="primary-btn" data-action="copy-earnings-update-prompt">${uiLabel("نسخ برومبت تحديث الأرباح")}</button>
        <button class="icon-btn" data-earnings-step="3">${uiLabel("الصق نتيجة ChatGPT")}</button>
      </div>
    </div>
  `;
}

function earningsJsonStep(workflow = {}, state = {}) {
  return `
    <div class="earnings-update-body">
      <h4>${uiLabel("الصق نتيجة ChatGPT")}</h4>
      <p>${uiLabel("الصق JSON الناتج كما هو. Franklin سيفحصه محليًا ثم يعرض ملخص التحديث قبل الحفظ.")}</p>
      <textarea class="paste-box earnings-json-box" data-earnings-field="responseText" placeholder="${uiLabel("Paste completed ChatGPT analysis or ExternalAnalysisReport JSON here.")}">${escapeHtml(workflow.responseText || "")}</textarea>
      ${workflow.validation?.errors?.length ? validationList(uiLabel("Validation Errors"), workflow.validation.errors, "negative") : ""}
      <div class="earnings-update-actions">
        <button class="primary-btn" data-action="parse-earnings-update-json" ${state.loading ? "disabled" : ""}>${state.loading ? uiLabel("Parsing") : uiLabel("فحص JSON")}</button>
        <button class="icon-btn" data-earnings-step="2">${uiLabel("Back")}</button>
      </div>
    </div>
  `;
}

function earningsUpdatePreview(workflow = {}, state = {}) {
  const preview = workflow.preview || {};
  const changes = preview.changes || [];
  return `
    <div class="earnings-update-body">
      <h4>${uiLabel("معاينة تحديث السهم")}</h4>
      <div class="preview-summary earnings-preview-summary">
        ${missingStat(uiLabel("fields to update"), preview.fieldsToUpdate || 0)}
        ${missingStat(uiLabel("new fields"), preview.newFields || 0)}
        ${missingStat(uiLabel("updated fields"), preview.updatedFields || 0)}
        ${missingStat(uiLabel("missing/non-existing fields"), preview.missingOrInvalidFields || 0)}
      </div>
      ${changes.length ? `
        <div class="earnings-change-list">
          ${changes.map((item) => `
            <article>
              <span>${escapeHtml(item.label)}</span>
              <small dir="ltr">${escapeHtml(item.path)}</small>
              <div><em>${escapeHtml(formatAnyValue(item.before))}</em><b>→</b><strong>${escapeHtml(formatAnyValue(item.after))}</strong></div>
            </article>
          `).join("")}
        </div>
      ` : `<p class="compact-empty-state">${uiLabel("لم تظهر تغييرات مهمة في الحقول الرئيسية. يمكنك الحفظ إذا كان JSON يمثل نسخة أرباح جديدة.")}</p>`}
      ${workflow.validation?.errors?.length ? validationList(uiLabel("Validation Errors"), workflow.validation.errors, "negative") : ""}
      <div class="earnings-update-actions">
        <button class="primary-btn" data-action="save-earnings-update" ${workflow.validation?.valid ? "" : "disabled"}>${uiLabel("تحديث السهم")}</button>
        <button class="icon-btn" data-earnings-step="3">${uiLabel("Back")}</button>
      </div>
    </div>
  `;
}

function earningsUpdateSuccess(workflow = {}) {
  const report = workflow.parsedReport || {};
  const preview = workflow.preview || {};
  return `
    <div class="earnings-update-body success">
      <h4>${uiLabel("تم تحديث السهم بنجاح")}</h4>
      <p>${escapeHtml(report.company?.ticker || "")} ${uiLabel("تم حفظ نسخة أرباح جديدة وفتح التقرير المحدّث.")}</p>
      <div class="preview-summary earnings-preview-summary">
        ${missingStat(uiLabel("fields to update"), preview.fieldsToUpdate || 0)}
        ${missingStat(uiLabel("new fields"), preview.newFields || 0)}
        ${missingStat(uiLabel("updated fields"), preview.updatedFields || 0)}
      </div>
      <div class="earnings-update-actions">
        <button class="primary-btn" data-action="close-earnings-update">${uiLabel("Open Report")}</button>
      </div>
    </div>
  `;
}

function reportSavedBanner(notice, report = {}) {
  const text = String(notice || "");
  if (!/(تم حفظ|تم تحديث|saved|updated)/i.test(text)) return "";
  return `
    <section class="save-confirmation-banner">
      <div>
        <strong>${escapeHtml(text)}</strong>
        <span>${escapeHtml(report.company?.ticker || "")} ${uiLabel("is saved in My Stocks.")}</span>
      </div>
      <div>
        <a class="primary-btn" href="#stock-report-top">${uiLabel("View Report")}</a>
        <button class="icon-btn" data-panel="home">${uiLabel("Back to My Stocks")}</button>
      </div>
    </section>
  `;
}

function reportDecisionStrip(report, completion = {}) {
  const action = externalRecommendationAction(report);
  const upside = numericValue(report.fairValue?.upsideToBasePct);
  return `
    <section class="report-decision-strip">
      ${decisionStripMetric(uiLabel("Recommendation"), localizedExternalText(action) || "-", recommendationColorCategory(action))}
      ${decisionStripMetric(uiLabel("Current Price"), money(report.market?.currentPrice ?? report.market?.priceAtAnalysis, 2), "neutral")}
      ${decisionStripMetric(uiLabel("Upside"), formatExternalPercent(report.fairValue?.upsideToBasePct), upsideColorCategory(upside))}
      ${decisionStripMetric(uiLabel("Confidence"), externalRecommendationConfidence(report), "neutral")}
    </section>
  `;
}

function externalRecommendationAction(report = {}) {
  return report.recommendation?.action || report.decision?.verdict || "";
}

function externalRecommendationConfidence(report = {}) {
  const confidence = numericValue(report.recommendation?.confidence);
  return Number.isFinite(confidence) ? `${Math.round(confidence)}% ${uiLabel("Confidence")}` : "";
}

function decisionStripMetric(label, value, category = "neutral") {
  return `
    <article class="decision-strip-card ${colorClass(category, "tone")}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function reportDataHealthCard(report, completion = {}) {
  const critical = completion.details?.criticalRequired || [];
  const recommended = completion.details?.recommended || [];
  const optional = completion.details?.optional || [];
  const errors = completion.details?.errors || [];
  const warnings = completion.details?.warnings || [];
  const pct = boundedPercent(completion.completionPct);
  const missingTotal = critical.length + recommended.length;
  const needsCompletion = completion.status !== "complete";
  return `
    <section class="panel report-data-health-card ${completionStatusClass(completion.status)}">
      <div class="report-data-health-head">
        <div>
          <p class="eyebrow">${uiLabel("Data Completion")}</p>
          <h3>${uiLabel("Data Health")}</h3>
          <p>${completionStatusSentence(completion)}</p>
        </div>
        <div class="data-health-score">
          <strong>${pct}%</strong>
          <span>${completionStatusLabel(completion.status)}</span>
        </div>
      </div>
      <div class="completion-track"><i style="width:${pct}%"></i></div>
      <div class="missing-data-stats data-health-stats">
        ${missingStat(uiLabel("Required fields"), `${completion.requiredComplete || 0}/${completion.requiredTotal || 0}`)}
        ${missingStat(uiLabel("Recommended fields"), `${completion.recommendedComplete || 0}/${completion.recommendedTotal || 0}`)}
        ${missingStat(uiLabel("Missing fields"), String(missingTotal))}
        ${missingStat(uiLabel("Invalid fields"), String(errors.length))}
        ${missingStat(uiLabel("Warnings"), String(warnings.length))}
      </div>
      <div class="supplement-missing-mini">
        ${critical.length || recommended.length
          ? [...critical, ...recommended].slice(0, 6).map((item) => `<span><b>${escapeHtml(item.labelAr || item.path)}</b><em dir="ltr">${escapeHtml(item.path)}</em></span>`).join("")
          : `<span class="complete-chip"><b>${uiLabel("All required data is complete.")}</b></span>`}
        ${optional.length ? `<span><b>${uiLabel("Optional fields missing")}</b><em dir="ltr">${optional.length}</em></span>` : ""}
      </div>
      ${needsCompletion ? `<button class="primary-btn" data-action="start-report-supplement" data-external-ticker="${escapeHtml(report.company?.ticker || "")}" data-external-report-id="${escapeHtml(report.id || "")}">${uiLabel("إكمال البيانات الناقصة")}</button>` : ""}
    </section>
  `;
}

function compactThesisView(report = {}) {
  const thesis = localizedExternalText(report.thesis?.shortSummary || report.thesis?.fullSummary);
  if (!thesis.trim()) return "";
  return `
    <section class="compact-thesis-card">
      <span>${uiLabel("Investment Thesis")}</span>
      <p>${escapeHtml(shortText(thesis, 210))}</p>
      ${thesis.length > 210 ? externalDetail(uiLabel("Full thesis"), paragraphBlock([report.thesis?.fullSummary || report.thesis?.shortSummary])) : ""}
    </section>
  `;
}

function compactScoreRowsView(report = {}) {
  const rows = [
    [financialTerm("Quality"), scoreText(report.scores?.quality, 1), qualityCompactSummary(report)],
    [financialTerm("Growth"), scoreText(report.scores?.growth, 1), growthCompactSummary(report)],
    [financialTerm("Risk"), scoreText(report.scores?.risk, 1), riskCompactSummary(report)],
    [uiLabel("Investment Score"), scoreText(report.scores?.overall, 1), investmentCompactSummary(report)]
  ].filter(([, value, detail]) => value !== "—" || localizedExternalText(detail).trim());
  if (!rows.length) return "";
  return `
    <section class="compact-score-list">
      ${rows.map(([label, value, detail]) => `
        <details class="compact-drill-row">
          <summary>
            <span>${escapeHtml(label)}</span>
            <strong dir="ltr">${escapeHtml(value)}</strong>
            <em>›</em>
          </summary>
          <p>${escapeHtml(localizedExternalText(detail) || "لا توجد تفاصيل إضافية محفوظة.")}</p>
        </details>
      `).join("")}
    </section>
  `;
}

function qualityCompactSummary(report = {}) {
  return firstUsefulText([
    report.quality?.summary,
    report.quality?.profitability,
    report.quality?.balanceSheet,
    report.businessQuality?.summary,
    report.moat?.summary,
    firstReportItemText(report.quality?.strengths),
    firstReportItemText(report.strengths)
  ]);
}

function growthCompactSummary(report = {}) {
  return firstUsefulText([
    report.growthHighlights?.summary,
    report.growthHighlights?.revenueGrowth,
    report.growthHighlights?.epsGrowth,
    report.growthHighlights?.fcfGrowth,
    report.growthHighlights?.marginTrend,
    firstReportItemText(report.companySpecificKpis),
    firstReportItemText(report.catalysts)
  ]);
}

function riskCompactSummary(report = {}) {
  const firstRisk = Array.isArray(report.risks) ? report.risks[0] : null;
  return firstUsefulText([
    report.risk?.summary,
    report.riskSummary,
    firstRisk ? [reportItemTitle(firstRisk), reportItemDetail(firstRisk), firstRisk.severity, firstRisk.whatToMonitor, firstRisk.thesisBreaker].filter(Boolean).join(" — ") : "",
    report.decision?.exitThesis
  ]);
}

function investmentCompactSummary(report = {}) {
  return firstUsefulText([
    report.decision?.rationale,
    report.recommendation?.rationale,
    report.recommendation?.reason,
    report.valuationSelectionReason
  ]);
}

function firstUsefulText(values = []) {
  for (const value of values.flat()) {
    const text = localizedExternalText(value).trim();
    if (text) return text;
  }
  return "";
}

function compactEvidenceNavigator(report = {}) {
  const sections = [
    strengthsRisksSummaryView(report),
    compactValuationMethodsSummary(report),
    compactMoreEvidenceView(report)
  ].filter(Boolean).join("");
  return sections ? `<section class="compact-evidence-list">${sections}</section>` : "";
}

function strengthsRisksSummaryView(report = {}) {
  const strengths = report.quality?.strengths || report.businessQuality?.strengths || [];
  const risks = Array.isArray(report.risks) ? report.risks : [];
  if (!strengths.length && !risks.length) return "";
  return `
    <details class="compact-drill-row strengths-risks-drill">
      <summary>
        <span>${uiLabel("Strengths & Risks")}</span>
        <strong>${strengths.length} / ${risks.length}</strong>
        <em>›</em>
      </summary>
      <div class="strength-risk-compare">
        <section>
          <h4>${uiLabel("Strengths")}</h4>
          ${compactEvidenceList(strengths, uiLabel("No verified strengths were provided."), "strength")}
        </section>
        <section>
          <h4>${uiLabel("Risks")}</h4>
          ${compactEvidenceList(risks, uiLabel("No verified risks were provided."), "risk")}
        </section>
      </div>
    </details>
  `;
}

function compactValuationMethodsSummary(report = {}) {
  const rows = Object.entries(report.valuationMethods || {})
    .map(([key, value]) => normalizeValuationMethodForDisplay(key, value))
    .filter(Boolean);
  const method = report.primaryValuationMethod || report.metadata?.primaryValuationMethod || rows[0]?.method;
  const summary = rows.slice(0, 3).map((row) => {
    const role = valuationRoleLabel(row.role);
    const weight = formatNullablePercent(row.weight);
    return `${humanValuationMethodLabel(row.method || row.key)}${role !== "—" ? ` — ${role}` : ""}${weight !== "—" ? ` — ${weight}` : ""}`;
  });
  if (!method && !summary.length && !hasRenderableContent(valuationMethodSummaryView(report))) return "";
  return `
    <details class="compact-drill-row valuation-methods-drill">
      <summary>
        <span>${uiLabel("Valuation Methods")}</span>
        <strong>${escapeHtml(shortText(summary.join(" / ") || humanValuationMethodLabel(method), 54))}</strong>
        <em>›</em>
      </summary>
      <div class="compact-detail-stack">
        ${valuationMethodSummaryView(report)}
        ${valuationMethodsView(report.valuationMethods)}
        ${financialHighlightsView(report.financialHighlights || report.growthHighlights)}
      </div>
    </details>
  `;
}

function compactMoreEvidenceView(report = {}) {
  const blocks = [
    report.catalysts?.length ? externalDetail(uiLabel("Catalysts"), compactEvidenceList(report.catalysts, "", "catalyst")) : "",
    report.watchItems?.length ? externalDetail(uiLabel("Watch List"), compactEvidenceList(report.watchItems, "", "watch")) : "",
    hasRenderableContent(companyQualityView(report)) ? externalDetail(uiLabel("Company Quality"), companyQualityView(report)) : "",
    hasRenderableContent(growthView(report)) ? externalDetail(uiLabel("Growth Section"), growthView(report)) : "",
    hasRenderableContent(externalRecommendationView(report)) ? externalDetail(uiLabel("Investment Verdict"), externalRecommendationView(report)) : "",
    hasRenderableContent(recommendationConditionsView(report)) ? externalDetail(uiLabel("Recommendation Upgrade / Downgrade Conditions"), recommendationConditionsView(report)) : ""
  ].filter(Boolean).join("");
  if (!blocks) return "";
  return `
    <details class="compact-drill-row more-evidence-drill">
      <summary>
        <span>${uiLabel("More Evidence")}</span>
        <strong>${uiLabel("Details")}</strong>
        <em>›</em>
      </summary>
      <div class="compact-detail-stack">${blocks}</div>
    </details>
  `;
}

function compactTechnicalDetails(report = {}, completion = {}, history = [], requirementSets = []) {
  const blocks = [
    externalVersionHistory(report, history) ? externalDetail(uiLabel("Historical Analyses"), externalVersionHistory(report, history)) : "",
    requirementLifecycleTimeline(requirementSets, history) ? externalDetail(uiLabel("Requirement Delivery Timeline"), requirementLifecycleTimeline(requirementSets, history)) : "",
    externalDetail(uiLabel("Data Health"), reportDataHealthCard(report, completion)),
    sourcesView(report.sources) ? externalDetail(uiLabel("Sources"), sourcesView(report.sources)) : ""
  ].filter(Boolean).join("");
  return blocks ? `<div class="compact-detail-stack">${blocks}</div>` : "";
}

export function compactEvidenceList(items = [], emptyLabel = "", type = "evidence") {
  const visible = Array.isArray(items) ? items : [];
  if (!visible.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  return `
    <ul class="compact-evidence-items">
      ${visible.map((item) => {
        const isPlainText = typeof item === "string";
        const title = reportItemTitle(item) || uiLabel("Details");
        const preview = isPlainText ? "" : reportItemPreview(item);
        const actionLabel = `${uiLabel("Open details for")}: ${title}`;
        const dialogLabel = `${evidenceTypeLabel(type)}: ${title}`;
        return `
        <li>
          <button class="compact-evidence-row" type="button" data-evidence-detail data-evidence-dialog-label="${escapeHtml(dialogLabel)}" aria-haspopup="dialog" aria-label="${escapeHtml(actionLabel)}">
            <span>
              <strong class="evidence-row-title${isPlainText ? " plain-text-preview" : ""}" dir="auto"><bdi>${escapeHtml(title)}</bdi></strong>
              ${preview ? `<small dir="auto"><bdi>${escapeHtml(preview)}</bdi></small>` : ""}
            </span>
            <b class="evidence-row-chevron" aria-hidden="true">›</b>
          </button>
          <template data-evidence-template>
            ${evidenceDetailContent(item, type)}
          </template>
        </li>
      `;
      }).join("")}
    </ul>
  `;
}

function reportItemPreview(item) {
  if (typeof item === "string") return "";
  return firstUsefulText([
    item?.focus,
    item?.currentValue,
    item?.explanation,
    item?.whyItMatters,
    item?.evidence,
    item?.whatToMonitor,
    item?.thesisBreaker,
    item?.detail,
    item?.notes
  ]);
}

function evidenceDetailContent(item, type) {
  const isPlainText = typeof item === "string";
  const title = reportItemTitle(item) || uiLabel("Details");
  const fields = evidenceDetailFields(item);
  return `
    <header class="evidence-detail-head">
      <span>${escapeHtml(evidenceTypeLabel(type))}</span>
      ${isPlainText ? "" : `<h3 dir="auto"><bdi>${escapeHtml(title)}</bdi></h3>`}
    </header>
    <div class="evidence-detail-fields">
      ${fields.map(({ label, value }) => `
        <section>
          <strong>${escapeHtml(label)}</strong>
          <p dir="auto"><bdi>${escapeHtml(value)}</bdi></p>
        </section>
      `).join("")}
    </div>
  `;
}

export function evidenceDetailFields(item) {
  if (typeof item === "string") return [{ label: uiLabel("Full text"), value: localizedExternalText(item) }];
  if (!item || typeof item !== "object") return [];
  const candidates = [
    ["currentValue", uiLabel("Current value")],
    ["focus", uiLabel("Focus")],
    ["explanation", uiLabel("Explanation")],
    ["whyItMatters", uiLabel("Why it matters")],
    ["evidence", uiLabel("Evidence")],
    ["severity", uiLabel("Severity")],
    ["importance", uiLabel("Importance")],
    ["whatToMonitor", uiLabel("What to Monitor")],
    ["thesisBreaker", uiLabel("Thesis Breaker")],
    ["evaluationNote", uiLabel("Evaluation note")],
    ["detail", uiLabel("Details")],
    ["notes", uiLabel("Notes")]
  ];
  const seen = new Set();
  return candidates.flatMap(([key, label]) => {
    const value = localizedExternalText(item[key]).trim();
    if (!value || seen.has(value)) return [];
    seen.add(value);
    return [{ label, value }];
  });
}

function evidenceTypeLabel(type) {
  if (type === "catalyst") return uiLabel("Catalyst");
  if (type === "risk") return uiLabel("Risk item");
  if (type === "watch") return uiLabel("Watch item");
  if (type === "strength") return uiLabel("Strength");
  return uiLabel("Evidence");
}

function evidenceDetailDialog() {
  return `
    <dialog class="evidence-detail-dialog" data-evidence-dialog aria-label="${uiLabel("Evidence details")}">
      <article class="evidence-detail-sheet">
        <button class="evidence-detail-close" type="button" data-action="close-evidence-detail" aria-label="${uiLabel("Close")}">×</button>
        <div data-evidence-dialog-content></div>
      </article>
    </dialog>
  `;
}

function reportItemTitle(item) {
  if (typeof item === "string") return localizedExternalText(item);
  return localizedExternalText(item?.title || item?.arabicName || item?.name || item?.metric || item?.summary || item?.text || "");
}

function reportItemDetail(item) {
  if (!item || typeof item === "string") return "";
  return localizedExternalText(item.explanation || item.whyItMatters || item.evidence || item.whatToMonitor || item.thesisBreaker || item.detail || "");
}

function firstReportItemText(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return reportItemTitle(items[0]);
}

function completionStatusSentence(completion = {}) {
  if (completion.status === "complete") return uiLabel("All critical data is complete and the report is ready.");
  if (completion.status === "has_conflicts") return uiLabel("Conflicting fields need review before the report is complete.");
  if (completion.status === "invalid") return uiLabel("Validation found fields that need review.");
  if (completion.status === "draft") return uiLabel("This report is saved as an incomplete draft.");
  return uiLabel("Some required data is still missing.");
}

function completionStatusLabel(status) {
  if (status === "complete") return uiLabel("Complete");
  if (status === "has_conflicts") return uiLabel("Has Conflicts");
  if (status === "invalid") return uiLabel("Invalid");
  if (status === "draft") return uiLabel("Draft");
  return uiLabel("Incomplete");
}

function completionStatusClass(status) {
  if (status === "complete") return "complete";
  if (status === "has_conflicts") return "has-conflicts";
  if (status === "invalid") return "invalid";
  if (status === "draft") return "draft";
  return "incomplete";
}

function boundedPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0;
}

function reportGroup(title, body, eyebrow = "", className = "") {
  if (!hasRenderableContent(body)) return "";
  return `
    <section class="report-section-group ${escapeHtml(className)}">
      <header>
        ${eyebrow ? `<span>${escapeHtml(eyebrow)}</span>` : ""}
        <h2>${escapeHtml(title)}</h2>
      </header>
      <div class="report-section-grid">${body}</div>
    </section>
  `;
}

function hasRenderableContent(body) {
  return String(body || "").replace(/<[^>]*>/g, "").replace(/\s+/g, "").length > 0;
}

function reportSection(title, body) {
  if (!hasRenderableContent(body)) return "";
  return `
    <section class="panel report-v2-section">
      <h3>${escapeHtml(title)}</h3>
      <div>${body}</div>
    </section>
  `;
}

function externalFairValueMetric(label, value) {
  return `
    <article class="scenario-card">
      <span>${escapeHtml(label)}</span>
      <strong>${formatExternalPercent(value)}</strong>
    </article>
  `;
}

function financialHighlightsView(highlights = {}) {
  const rows = Object.entries(highlights || {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!rows.length) return "";
  return `
    <div class="external-method-grid financial-highlight-grid">
      ${rows.map(([key, value]) => `
        <div>
          <span>${escapeHtml(labelFromKey(key))}</span>
          <strong>${escapeHtml(localizedExternalText(formatAnyValue(value)))}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function externalScoreCard(label, value) {
  const score = numericValue(value);
  const pct = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score * 10))) : 0;
  return `
    <article class="scenario-card score-visual-card ${scoreToneClass(score)}">
      <span>${escapeHtml(label)}</span>
      <strong>${scoreText(value, 1)}</strong>
      <div class="score-track"><i style="width:${pct}%"></i></div>
    </article>
  `;
}

function scoreToneClass(score) {
  if (!Number.isFinite(score)) return "score-missing";
  if (score >= 8) return "score-high";
  if (score >= 5.5) return "score-medium";
  return "score-low";
}

function externalDetail(title, body, open = false) {
  return `
    <details class="report-detail" ${open ? "open" : ""}>
      <summary>${escapeHtml(title)}</summary>
      <div>${body || `<p class="muted">${uiLabel("Not provided in the imported analysis.")}</p>`}</div>
    </details>
  `;
}

function latestEarningsExecutionCard(body = "") {
  return `
    <section class="latest-earnings-card">
      <header>
        <strong>${uiLabel("Latest Earnings Execution")}</strong>
        <button class="compact-inline-action" data-action="copy-new-earnings-prompt">${uiLabel("تحليل إعلان جديد")}</button>
      </header>
      <details class="report-detail">
        <summary>${uiLabel("Show details")}</summary>
        <div>${body || `<p class="muted">${uiLabel("Not provided in the imported analysis.")}</p>`}</div>
      </details>
    </section>
  `;
}

function valuationMethodsView(methods = {}) {
  const rows = Object.entries(methods || {})
    .map(([key, value]) => normalizeValuationMethodForDisplay(key, value))
    .filter(Boolean);
  if (!rows.length) return "";
  return `
    <div class="valuation-methods-readable">
      <div class="valuation-methods-title">
        <h4>${uiLabel("Valuation Methods Used")}</h4>
        <span dir="ltr">Valuation Methods</span>
      </div>
      <div class="valuation-method-card-grid">
        ${rows.map(valuationMethodCard).join("")}
      </div>
    </div>
  `;
}

function normalizeValuationMethodForDisplay(key, value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    return {
      key,
      method: methodLabel(key),
      role: null,
      fairValue: value,
      weight: null,
      confidence: null,
      explanation: null,
      limitation: null,
      assumptions: {},
      technical: {}
    };
  }
  const method = value.method || value.valuationMethod || methodLabel(key);
  const assumptions = value.assumptions && typeof value.assumptions === "object" ? value.assumptions : {};
  const inputs = value.inputs && typeof value.inputs === "object" ? value.inputs : {};
  const { visible, technical } = splitAssumptionRows({ ...inputs, ...assumptions });
  return {
    key,
    method,
    role: value.role || value.type || null,
    fairValue: value.fairValue ?? value.value ?? value.output ?? null,
    weight: value.weight ?? value.modelWeight ?? null,
    confidence: value.confidence ?? value.confidenceLevel ?? null,
    explanation: value.explanation || value.whySuitable || value.selectionReason || value.reason || null,
    limitation: value.limitation || value.limitations || null,
    assumptions: visible,
    technical
  };
}

function valuationMethodCard(method = {}) {
  return `
    <article class="valuation-method-readable-card">
      <div class="valuation-method-readable-head">
        <span>${uiLabel("طريقة التقييم")}</span>
        <strong>${escapeHtml(humanValuationMethodLabel(method.method || method.key))}</strong>
      </div>
      <div class="valuation-method-readable-metrics">
        ${readableMetric(uiLabel("Role"), valuationRoleLabel(method.role))}
        ${readableMetric(uiLabel("Output Value"), formatValuationFairValue(method.fairValue))}
        ${readableMetric(uiLabel("Weight"), formatNullablePercent(method.weight))}
        ${readableMetric(uiLabel("Confidence"), formatNullablePercent(method.confidence))}
      </div>
      ${localizedExternalText(method.explanation).trim() ? `
        <section>
          <h5>${uiLabel("Why did we use this method?")}</h5>
          <p>${escapeHtml(localizedExternalText(method.explanation))}</p>
        </section>
      ` : ""}
      ${method.assumptions.length ? `
        <section>
          <h5>${uiLabel("Key Assumptions")}</h5>
          <div class="valuation-assumption-list">
            ${method.assumptions.map(([label, value]) => readableMetric(label, formatAnyValue(value))).join("")}
          </div>
        </section>
      ` : ""}
      ${localizedExternalText(method.limitation).trim() ? `
        <section>
          <h5>${uiLabel("Method Limitation")}</h5>
          <p>${escapeHtml(localizedExternalText(method.limitation))}</p>
        </section>
      ` : ""}
      ${method.technical.length ? externalDetail(uiLabel("Technical Details"), technicalRows(method.technical)) : ""}
    </article>
  `;
}

function readableMetric(label, value) {
  const visibleValue = value === null || value === undefined || value === "" ? "—" : value;
  return `<div class="readable-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(visibleValue))}</strong></div>`;
}

function splitAssumptionRows(object = {}) {
  const visible = [];
  const technical = [];
  for (const [key, value] of Object.entries(object || {})) {
    if (value === null || value === undefined || value === "") continue;
    const label = friendlyAssumptionLabel(key);
    if (label) visible.push([label, value]);
    else technical.push([key, value]);
  }
  return { visible, technical };
}

function friendlyAssumptionLabel(key) {
  const labels = {
    normalizedEPS: "ربحية السهم الطبيعية",
    epsNormalized: "ربحية السهم الطبيعية",
    selectedMultiple: "المكرر المستخدم",
    multipleUsed: "المكرر المستخدم",
    valuationMultiple: "المكرر المستخدم",
    historicalAnchorRange: "نطاق المكرر التاريخي",
    currentPrice: uiLabel("Current Price"),
    priceAtAnalysis: uiLabel("Price at Analysis"),
    currentRevenue: financialTerm("Revenue"),
    revenue: financialTerm("Revenue"),
    revenueGrowth: financialTerm("Revenue Growth"),
    revenueGrowthPct: financialTerm("Revenue Growth"),
    grossMargin: financialTerm("Gross Margin"),
    grossMarginPct: financialTerm("Gross Margin"),
    operatingMargin: financialTerm("Operating Margin"),
    operatingMarginPct: financialTerm("Operating Margin"),
    ebitda: "EBITDA",
    evEbitda: "EV/EBITDA",
    eps: financialTerm("EPS"),
    freeCashFlow: financialTerm("Free Cash Flow"),
    fcf: financialTerm("FCF"),
    wacc: "WACC",
    terminalGrowth: "Terminal Growth",
    discountRate: "Discount Rate",
    netDebt: "Net Debt",
    shareCount: "Share Count",
    dilutedShares: "Diluted Shares",
    taxRate: "Tax Rate",
    capex: "CapEx"
  };
  return labels[key] || null;
}

function technicalRows(rows = []) {
  return `
    <div class="technical-row-list">
      ${rows.map(([key, value]) => `<p><span dir="ltr">${escapeHtml(key)}</span><strong>${escapeHtml(formatAnyValue(value))}</strong></p>`).join("")}
    </div>
  `;
}

function humanValuationMethodLabel(value) {
  const text = String(value || "").trim();
  const lower = text.toLowerCase();
  if (lower === "pe" || lower.includes("p/e")) return "مكرر الربحية (P/E)";
  if (lower.includes("dcf")) return "التدفقات النقدية المخصومة (DCF)";
  if (lower.includes("ev/ebitda") || lower.includes("ebitda")) return "مضاعف EV/EBITDA";
  if (lower.includes("peg")) return "PEG";
  if (lower.includes("sotp")) return "تقييم مجموع الأجزاء (SOTP)";
  if (lower.includes("sales") || lower.includes("p/s")) return "مضاعف المبيعات (P/S)";
  return localizedExternalText(text) || "-";
}

function valuationRoleLabel(value) {
  const clean = String(value || "").toLowerCase();
  if (clean.includes("primary") || clean.includes("أساس")) return uiLabel("Primary");
  if (clean.includes("secondary") || clean.includes("support") || clean.includes("مسان")) return uiLabel("Supporting");
  return localizedExternalText(value) || "—";
}

function formatNullablePercent(value) {
  const number = numericValue(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10}%` : "—";
}

function formatValuationFairValue(value) {
  const number = numericValue(value);
  if (Number.isFinite(number)) return money(number, 0);
  return localizedExternalText(value) || "—";
}

function externalRecommendationView(report = {}) {
  const recommendation = report.recommendation || {};
  const action = externalRecommendationAction(report);
  return `
    <div class="external-recommendation-block">
      <div class="recommendation-head ${colorClass(recommendationColorCategory(action), "tone")}">
        <span>${uiLabel("Action")}</span>
        <strong>${escapeHtml(localizedExternalText(action) || "-")}</strong>
        <em>${externalRecommendationConfidence(report)}</em>
      </div>
      ${paragraphBlock([recommendation.reason, report.decision?.rationale, report.decision?.buyZone, report.decision?.fairZone, report.decision?.expensiveZone])}
      <div class="recommendation-trigger-grid">
        ${triggerList(uiLabel("What Would Upgrade"), recommendation.whatWouldUpgrade)}
        ${triggerList(uiLabel("What Would Downgrade"), recommendation.whatWouldDowngrade)}
      </div>
    </div>
  `;
}

function recommendationConditionsView(report = {}) {
  const recommendation = report.recommendation || {};
  return `
    ${paragraphBlock([recommendation.reason])}
    <div class="recommendation-trigger-grid">
      ${triggerList(uiLabel("What Would Upgrade"), recommendation.whatWouldUpgrade)}
      ${triggerList(uiLabel("What Would Downgrade"), recommendation.whatWouldDowngrade)}
    </div>
    ${paragraphBlock([report.decision?.rationale, report.decision?.buyZone, report.decision?.fairZone, report.decision?.expensiveZone])}
  `;
}

function companyQualityView(report = {}) {
  const quality = report.quality || {};
  const summary = paragraphBlock([quality.summary]);
  const core = [
    compactCardMetric(financialTerm("Quality"), scoreText(report.scores?.quality, 1)),
    quality.moat ? compactCardMetric(uiLabel("Economic Moat"), localizedExternalText(quality.moat)) : "",
    quality.profitability ? compactCardMetric(uiLabel("Profitability"), localizedExternalText(quality.profitability)) : "",
    quality.balanceSheet ? compactCardMetric(uiLabel("Balance Sheet"), localizedExternalText(quality.balanceSheet)) : "",
    quality.capitalAllocation ? compactCardMetric(uiLabel("Capital Allocation"), localizedExternalText(quality.capitalAllocation)) : "",
    quality.earningsQuality ? compactCardMetric(uiLabel("Earnings Quality"), localizedExternalText(quality.earningsQuality)) : ""
  ].filter(Boolean).join("");
  const detail = [
    quality.strengths?.length ? externalDetail(uiLabel("Key Strengths"), simpleList(quality.strengths)) : "",
    quality.weaknesses?.length ? externalDetail(uiLabel("Weaknesses"), simpleList(quality.weaknesses)) : "",
    earningsQualityBlock(report.earningsQuality) ? externalDetail(uiLabel("Earnings Quality"), earningsQualityBlock(report.earningsQuality)) : ""
  ].filter(Boolean).join("");
  return `
    <div class="external-section-flow">
      ${core ? `<div class="requirements-summary">${core}</div>` : ""}
      ${summary}
      ${detail}
    </div>
  `;
}

function growthView(report = {}) {
  const growth = report.growthHighlights || {};
  const highlights = report.financialHighlights || {};
  const core = [
    compactCardMetric(financialTerm("Growth"), scoreText(report.scores?.growth, 1)),
    valueMetric(uiLabel("Revenue Growth"), growth.revenueGrowth ?? highlights.revenueGrowthPct),
    valueMetric(uiLabel("EPS Growth"), growth.epsGrowth),
    valueMetric(uiLabel("FCF Growth"), growth.fcfGrowth),
    valueMetric(uiLabel("Margin Trend"), growth.marginTrend),
    valueMetric(uiLabel("Segment Growth"), growth.majorSegmentGrowth),
    valueMetric(uiLabel("Market Share"), growth.marketShareTrend),
    valueMetric(uiLabel("TAM"), growth.tamComment)
  ].filter(Boolean).join("");
  return `
    <div class="external-section-flow">
      ${core ? `<div class="requirements-summary">${core}</div>` : ""}
      ${Object.keys(growth || {}).length ? externalDetail(uiLabel("Growth Details"), objectBlock(growth)) : ""}
    </div>
  `;
}

function valueMetric(label, value) {
  if (value === null || value === undefined || value === "") return "";
  return compactCardMetric(label, localizedExternalText(formatAnyValue(value)));
}

function triggerList(title, items = []) {
  const visible = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!visible.length) return "";
  return `
    <div class="trigger-list">
      <h4>${escapeHtml(title)}</h4>
      ${simpleList(visible)}
    </div>
  `;
}

function riskList(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <div class="external-list risk-monitor-list">
      ${items.map((item) => {
        if (typeof item === "string") return `<article><strong>${escapeHtml(localizedExternalText(item))}</strong></article>`;
        return `
          <article>
            <strong>${escapeHtml(localizedExternalText(item.title || item.name || uiLabel("Risk")))}</strong>
            ${item.severity ? `<span>${uiLabel("Severity")}: ${escapeHtml(localizedExternalText(item.severity))}</span>` : ""}
            ${item.explanation ? `<span>${escapeHtml(localizedExternalText(item.explanation))}</span>` : ""}
            ${item.whatToMonitor ? `<span><b>${uiLabel("What to Monitor")}</b>: ${escapeHtml(localizedExternalText(item.whatToMonitor))}</span>` : ""}
            ${item.thesisBreaker ? `<span><b>${uiLabel("Thesis Breaker")}</b>: ${escapeHtml(localizedExternalText(item.thesisBreaker))}</span>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function guidanceView(guidance = []) {
  if (!Array.isArray(guidance) || !guidance.length) return "";
  return `
    <div class="guidance-grid">
      ${guidance.map((item) => `
        <article class="guidance-card ${guidanceDirectionClass(item.direction)}">
          <div>
            <span>${escapeHtml(item.arabicTopic || item.topic || uiLabel("Guidance"))}</span>
            <em>${escapeHtml(guidanceDirectionLabel(item.direction))}</em>
          </div>
          <strong>${escapeHtml(formatAnyValue(item.currentGuidance))}</strong>
          ${item.previousGuidance ? `<small>${uiLabel("Previous Guidance")}: ${escapeHtml(formatAnyValue(item.previousGuidance))}</small>` : ""}
          ${item.interpretation ? `<p>${escapeHtml(localizedExternalText(item.interpretation))}</p>` : ""}
          <b>${escapeHtml(importanceLabel(item.importance))}</b>
        </article>
      `).join("")}
    </div>
  `;
}

function investmentDataTableArea(report = {}) {
  const panels = [
    {
      key: "requirements",
      label: uiLabel("Price Target Requirements"),
      body: priceTargetRequirementsView(report.priceTargetRequirements, { compact: true }) || emptyCompactDataView(uiLabel("Price Target Requirements"))
    },
    {
      key: "guidance",
      label: uiLabel("Guidance"),
      body: guidanceTableView(report) || emptyCompactDataView(uiLabel("Guidance"))
    },
    {
      key: "financials",
      label: uiLabel("Financial Performance"),
      body: financialPerformanceTableView(report) || emptyCompactDataView(uiLabel("Financial Performance"))
    },
    {
      key: "kpis",
      label: uiLabel("Company KPIs"),
      body: companyKpisTableView(report.companySpecificKpis) || emptyCompactDataView(uiLabel("Company KPIs"))
    }
  ];
  if (!panels.length) return "";
  return `
    <section class="investment-data-area">
      <header class="investment-data-head">
        <label class="compact-data-select-label">
          <span>${uiLabel("العرض")}</span>
          <select class="compact-data-select" data-investment-data-select aria-label="${uiLabel("Investment Data")}">
            ${panels.map((panel, index) => `<option value="${escapeHtml(panel.key)}" ${index === 0 ? "selected" : ""}>${escapeHtml(panel.label)}</option>`).join("")}
          </select>
        </label>
      </header>
      <div class="data-view-tabs compact-data-selector" aria-label="${uiLabel("Investment Data")}">
        <div class="data-view-panels">
          ${panels.map((panel, index) => `
            <section class="data-view-panel data-view-panel-${panel.key} ${index === 0 ? "active" : ""}" data-data-view-panel="${escapeHtml(panel.key)}">
              ${panel.body}
            </section>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function emptyCompactDataView(label) {
  return `<p class="compact-empty-state">${escapeHtml(label)}: ${uiLabel("Not provided in the imported analysis.")}</p>`;
}

function guidanceTableView(report = {}) {
  const rows = [];
  const renderedTopics = new Set();
  const nextGuidance = Array.isArray(report.nextQuarterGuidance?.items) ? report.nextQuarterGuidance.items : [];
  for (const item of nextGuidance) {
    const topicKey = guidanceRowKey(item);
    if (topicKey) renderedTopics.add(topicKey);
    rows.push({
      label: item.arabicTopic || item.topic || uiLabel("Guidance"),
      secondary: item.arabicTopic && item.topic ? item.topic : "",
      cells: [
        { value: item.previousGuidance || "—", dir: "ltr" },
        { value: item.guidance || "—", dir: "ltr", className: guidanceDirectionClass(item.direction) },
        { value: report.nextQuarterGuidance?.quarter || uiLabel("Next Quarter"), dir: "ltr" },
        { value: guidanceDirectionLabel(item.direction), dir: "auto" }
      ],
      detail: paragraphBlock([item.interpretation, item.importance ? `${uiLabel("Importance")}: ${importanceLabel(item.importance)}` : null])
    });
  }
  for (const item of Array.isArray(report.guidance) ? report.guidance : []) {
    if (typeof item === "string") {
      rows.push({
        label: uiLabel("Guidance"),
        cells: [
          { value: "—" },
          { value: shortText(localizedExternalText(item), 48), dir: "auto" },
          { value: report.reportPeriod || "—", dir: "ltr" },
          { value: "—" }
        ],
        detail: paragraphBlock([item])
      });
      continue;
    }
    const topicKey = guidanceRowKey(item);
    if (topicKey && renderedTopics.has(topicKey)) continue;
    if (topicKey) renderedTopics.add(topicKey);
    rows.push({
      label: item.arabicTopic || item.topic || item.title || item.name || uiLabel("Guidance"),
      secondary: item.arabicTopic && item.topic ? item.topic : "",
      cells: [
        { value: item.previousGuidance || item.previous || "—", dir: "ltr" },
        { value: item.currentGuidance || item.guidance || item.current || item.value || "—", dir: "ltr", className: guidanceDirectionClass(item.direction) },
        { value: item.quarter || item.period || report.reportPeriod || "—", dir: "ltr" },
        { value: guidanceDirectionLabel(item.direction), dir: "auto" }
      ],
      detail: paragraphBlock([item.interpretation, item.commentary, item.explanation])
    });
  }
  if (!rows.length) return "";
  return compactFinancialTable({
    caption: report.nextQuarterGuidance?.quarter ? `${uiLabel("Next Quarter Guidance")} — ${report.nextQuarterGuidance.quarter}` : uiLabel("Guidance"),
    columns: [uiLabel("Previous"), uiLabel("Current"), uiLabel("Period"), uiLabel("Direction")],
    rows
  });
}

function guidanceRowKey(item) {
  if (!item || typeof item === "string") return "";
  return String(item.topic || item.arabicTopic || item.title || item.name || "").trim().toLowerCase();
}

function financialPerformanceTableView(report = {}) {
  const source = report.financialHighlights || report.growthHighlights || {};
  const rows = Object.entries(source || {})
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 12)
    .map(([key, value]) => ({
      label: labelFromKey(key),
      cells: [
        { value: formatAnyValue(value), dir: "ltr" },
        { value: report.reportPeriod || report.analysisDate || "—", dir: "ltr" },
        { value: "—", dir: "ltr" }
      ]
    }));
  if (!rows.length) return "";
  return compactFinancialTable({
    caption: uiLabel("Financial Performance"),
    columns: [uiLabel("Value"), uiLabel("Period"), uiLabel("Change")],
    rows
  });
}

function companyKpisTableView(kpis = []) {
  if (!Array.isArray(kpis) || !kpis.length) return "";
  const rows = kpis.map((item) => ({
    label: item.arabicName || item.name || uiLabel("KPI"),
    secondary: item.arabicName && item.name ? item.name : "",
    cells: [
      { value: formatRequirementValue(item.currentValue, item.unit), dir: "ltr", className: trendClass(item.trend) },
      { value: trendLabel(item.trend), dir: "auto" },
      { value: importanceLabel(item.importance), dir: "auto" },
      { value: kpiCategoryLabel(item.category), dir: "auto" }
    ],
    detail: paragraphBlock([item.interpretation, kpiSourceText(item)])
  }));
  return compactFinancialTable({
    caption: uiLabel("Company KPIs"),
    columns: [uiLabel("Current"), uiLabel("Trend"), uiLabel("Importance"), uiLabel("Category")],
    rows
  });
}

function kpiSourceText(item = {}) {
  const source = item.sourceName || item.source;
  const url = item.sourceUrl;
  const date = item.sourceDate;
  if (!source && !url && !date) return "";
  return [
    source ? `${uiLabel("Source")}: ${source}` : "",
    item.sourceType ? `${uiLabel("Type")}: ${item.sourceType}` : "",
    date ? `${uiLabel("Updated")}: ${date}` : "",
    url ? `${uiLabel("URL")}: ${url}` : ""
  ].filter(Boolean).join(" — ");
}

function compactFinancialTable({ caption, columns = [], rows = [] } = {}) {
  if (!rows.length) return "";
  return `
    <div class="compact-table-shell mobile-data-group">
      ${caption ? `<div class="compact-table-caption">${escapeHtml(caption)}</div>` : ""}
      <div class="mobile-data-card-list">
        ${rows.map((row) => compactFinancialCard(row, columns)).join("")}
      </div>
    </div>
  `;
}

function compactFinancialCard(row = {}, columns = []) {
  const detail = localizedExternalText(row.detail).trim() ? row.detail : "";
  return `
    <article class="mobile-data-card">
      <header>${compactMetricLabel(row.label, row.secondary)}</header>
      <div class="mobile-data-values">
        ${columns.map((column, index) => {
          const cell = row.cells?.[index] || {};
          const config = typeof cell === "object" && !Array.isArray(cell) ? cell : { value: cell };
          const value = config.html ? config.value : escapeHtml(formatAnyValue(config.value ?? "—"));
          return `
            <div class="mobile-data-value ${escapeHtml(config.className || "")}">
              <span>${escapeHtml(column)}</span>
              <strong dir="${escapeHtml(config.dir || "auto")}">${config.html ? value : `<bdi>${value}</bdi>`}</strong>
            </div>
          `;
        }).join("")}
      </div>
      ${detail ? `<details class="mobile-card-details"><summary>${uiLabel("Show details")}</summary><div>${detail}</div></details>` : ""}
    </article>
  `;
}

function compactMetricLabel(primary, secondary = "") {
  return `
    <span class="compact-metric-label">
      <strong>${escapeHtml(primary || "-")}</strong>
      ${secondary ? `<small dir="ltr">${escapeHtml(secondary)}</small>` : ""}
    </span>
  `;
}

function nextQuarterGuidanceView(guidance = {}) {
  const items = Array.isArray(guidance?.items) ? guidance.items : [];
  if (!items.length) return "";
  return `
    <div class="next-quarter-guidance-block">
      <div class="requirements-cycle-copy">
        <strong>${uiLabel("Next Quarter Guidance")} — ${escapeHtml(guidance.quarter || uiLabel("Next Quarter"))}</strong>
      </div>
      <div class="guidance-grid next-quarter-guidance-grid">
        ${items.map((item) => `
          <article class="guidance-card ${guidanceDirectionClass(item.direction)}">
            <div>
              <span>${escapeHtml(item.arabicTopic || item.topic || uiLabel("Guidance"))}</span>
              <em>${escapeHtml(guidanceDirectionLabel(item.direction))}</em>
            </div>
            <strong>${escapeHtml(formatAnyValue(item.guidance))}</strong>
            ${item.previousGuidance ? `<small>${uiLabel("Previous Guidance")}: ${escapeHtml(formatAnyValue(item.previousGuidance))}</small>` : ""}
            ${item.interpretation ? `<p>${escapeHtml(localizedExternalText(item.interpretation))}</p>` : ""}
            <b>${escapeHtml(importanceLabel(item.importance))}</b>
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function companyKpisView(kpis = []) {
  if (!Array.isArray(kpis) || !kpis.length) return "";
  return `
    <div class="company-kpi-grid">
      ${kpis.map((item) => `
        <article class="kpi-card ${trendClass(item.trend)}">
          <div>
            <span>${escapeHtml(item.arabicName || item.name || uiLabel("KPI"))}</span>
            <em>${escapeHtml(kpiCategoryLabel(item.category))}</em>
          </div>
          <strong>${escapeHtml(formatRequirementValue(item.currentValue, item.unit))}</strong>
          <b>${escapeHtml(trendLabel(item.trend))} / ${escapeHtml(importanceLabel(item.importance))}</b>
          ${item.interpretation ? `<p>${escapeHtml(localizedExternalText(item.interpretation))}</p>` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function priceTargetRequirementsView(requirementsBlock = {}) {
  const requirements = requirementsBlock?.requirements || [];
  if (!Array.isArray(requirements) || !requirements.length) return "";
  const targetValue = requirementsBlock.targetValue ?? requirementsBlock.nextTargetValue;
  const previousQuarter = requirementsBlock.previousQuarter || uiLabel("Previous Quarter");
  const targetQuarter = requirementsBlock.targetQuarter || requirementsBlock.earningsPeriod || uiLabel("Target Quarter");
  return `
    <div class="price-requirements-block">
      <div class="next-target-bridge">
        <article>
          <span>${uiLabel("Current Justified Value")}</span>
          <strong>${money(requirementsBlock.currentJustifiedValue, 0)}</strong>
        </article>
        <b aria-hidden="true">→</b>
        <article class="target">
          <span>${uiLabel("Next Target")}</span>
          <strong>${money(targetValue, 0)}</strong>
        </article>
        <article>
          <span>${uiLabel("Target Scenario")}</span>
          <strong dir="auto"><bdi>${escapeHtml(targetScenarioLabel(requirementsBlock.targetScenario))}</bdi></strong>
        </article>
        <article>
          <span>${uiLabel("Earnings Period")}</span>
          <strong>${escapeHtml(requirementsBlock.earningsPeriod || "-")}</strong>
        </article>
      </div>
      <div class="requirements-cycle-copy">
        <strong>${uiLabel("What must the company deliver to justify")} <bdi dir="ltr">${isArabicUi() ? `${money(targetValue, 0).replace("$", "")} USD` : money(targetValue, 0)}</bdi>${isArabicUi() ? "؟" : "?"}</strong>
        ${requirementsBlock.summary || requirementsBlock.targetDescription ? `<p>${escapeHtml(localizedExternalText(requirementsBlock.summary || requirementsBlock.targetDescription))}</p>` : ""}
      </div>
      ${requirementsComparisonView(requirements, {
        previousQuarter,
        targetQuarter,
        targetValue,
        pending: true
      })}
    </div>
  `;
}

function historicalRequirementMatchPreview(match = {}) {
  if (!match || match.status === "none" || !match.status) return "";
  if (match.status === "ambiguous") {
    return `
      <section class="requirement-match-card ambiguous">
        <div class="table-title">
          <div>
            <p class="eyebrow">${uiLabel("Historical Requirements")}</p>
            <h4>${uiLabel("Select the requirement set this earnings report should evaluate.")}</h4>
            <p>${uiLabel("Franklin found more than one open requirement set and will not choose silently.")}</p>
          </div>
        </div>
        <div class="requirement-set-picker">
          ${(match.candidates || []).map((set) => `
            <button class="icon-btn" data-requirement-set-select="${escapeHtml(set.requirementSetId)}">
              <strong>${escapeHtml(set.earningsPeriod || "-")} / ${money(set.targetValue, 0)} ${escapeHtml(set.targetScenario || "")}</strong>
              <span>${uiLabel("Created")}: ${escapeHtml(formatDateShort(set.createdAt))} / ${set.requirements?.length || 0} ${uiLabel("Requirements")}</span>
            </button>
          `).join("")}
        </div>
      </section>
    `;
  }
  const evaluation = match.evaluationPreview;
  const set = match.set || evaluation || {};
  if (!set.requirementSetId) return "";
  return `
    <section class="requirement-match-card matched">
      <div class="table-title">
        <div>
          <p class="eyebrow">${uiLabel("Historical Requirements")}</p>
          <h4>${match.matchType === "single_open_suggested" ? uiLabel("Suggested previous requirement set") : uiLabel("Matched previous requirement set")}</h4>
          <p>${uiLabel("Earnings period")}: ${escapeHtml(set.earningsPeriod || "-")} / ${uiLabel("Created")}: ${escapeHtml(formatDateShort(set.createdAt))}</p>
        </div>
        <strong>${money(set.targetValue, 0)} ${escapeHtml(set.targetScenario || "")}</strong>
      </div>
      ${evaluation ? previousRequirementExecutionView(evaluation) : ""}
    </section>
  `;
}

function previousRequirementExecutionView(evaluation = {}) {
  const requirements = evaluation.requirements || [];
  if (!requirements.length) return "";
  const assessment = evaluation.requirementsAssessment || {};
  const previousQuarter = evaluation.previousQuarter || uiLabel("Previous Quarter");
  const targetQuarter = evaluation.targetQuarter || evaluation.earningsPeriod || uiLabel("Target Quarter");
  return `
    <div class="previous-execution-block">
      <div class="requirements-summary">
        ${Number.isFinite(numericValue(evaluation.targetValue)) ? compactCardMetric(uiLabel("Target being tested"), `${money(evaluation.targetValue, 0)} ${localizedExternalText(evaluation.targetScenario || "")}`) : ""}
        ${compactCardMetric(uiLabel("Requirement achievement"), Number.isFinite(numericValue(assessment.weightedAchievement)) ? `${Math.round(numericValue(assessment.weightedAchievement))}%` : "—")}
        ${compactCardMetric(uiLabel("Reported Requirements"), assessmentCountText(assessment.reportedRequirements, assessment.totalRequirements))}
        ${compactCardMetric(uiLabel("Earnings Period"), targetQuarter || "-")}
      </div>
      ${requirementsComparisonView(requirements, {
        previousQuarter,
        targetQuarter,
        targetValue: evaluation.targetValue,
        pending: false
      })}
      ${assessment.overallStatus ? `<p><b>${uiLabel("Overall")}:</b> ${escapeHtml(requirementsStatusLabel(assessment.overallStatus))}</p>` : ""}
      ${assessment.summary ? `<p>${escapeHtml(localizedExternalText(assessment.summary))}</p>` : ""}
    </div>
  `;
}

function requirementLifecycleTimeline(requirementSets = [], reports = []) {
  const events = [];
  for (const set of requirementSets || []) {
    events.push({
      date: set.createdAt,
      title: `${uiLabel("Created")} ${set.earningsPeriod || ""} ${uiLabel("Requirements")}`,
      detail: `${uiLabel("Target")}: ${money(set.targetValue, 0)} ${localizedExternalText(set.targetScenario || "")}`,
      status: set.status
    });
    if (set.status === "EVALUATED") {
      const report = (reports || []).find((item) => item.id === set.evaluatedByAnalysisId);
      events.push({
        date: set.evaluatedAt || report?.analysisDate,
        title: `${set.earningsPeriod || ""} ${uiLabel("evaluated")}`,
        detail: `${uiLabel("Weighted Achievement")}: ${Number.isFinite(numericValue(set.requirementsAssessment?.weightedAchievement)) ? `${Math.round(numericValue(set.requirementsAssessment.weightedAchievement))}%` : "—"}${report ? ` / Base ${money(report.fairValue?.base, 0)} / ${localizedExternalText(externalRecommendationAction(report) || "-")}` : ""}`,
        status: "EVALUATED"
      });
    }
  }
  if (!events.length) return "";
  return `
    <div class="requirement-timeline">
      ${events.sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()).map((event) => `
        <article class="${String(event.status || "").toLowerCase()}">
          <span>${escapeHtml(formatDateShort(event.date))}</span>
          <strong>${escapeHtml(event.title)}</strong>
          <p>${escapeHtml(event.detail)}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function requirementsComparisonView(requirements = [], options = {}) {
  if (!Array.isArray(requirements) || !requirements.length) return "";
  const previousHeader = `${uiLabel("Figures")} ${options.previousQuarter || uiLabel("Previous Quarter")}`;
  const targetHeader = `${uiLabel("Required To Justify")} \u2066${money(options.targetValue, 0)}\u2069`;
  const actualHeader = `${uiLabel("Figures")} ${options.targetQuarter || uiLabel("Target Quarter")}`;
  return `
    <div class="requirements-comparison">
      <div class="compact-table-caption">${uiLabel("Price Target Requirements")}</div>
      <div class="requirements-comparison-mobile">
        ${requirements.map((item) => requirementComparisonMobileRow(item, {
          ...options,
          previousHeader,
          targetHeader,
          actualHeader
        })).join("")}
      </div>
    </div>
  `;
}

function requirementComparisonMobileRow(item = {}, options = {}) {
  const hasDetails = Boolean(item.whyItMatters || item.evaluationNote || item.direction || item.impact);
  return `
    <article class="requirement-comparison-row">
      <header>
        ${requirementMetricCell(item)}
        <span class="requirement-weight">${uiLabel("Weight")}: <bdi>${requirementWeightText(item.weight)}</bdi></span>
        ${requirementStatusBadge(item.status)}
      </header>
      <div class="requirement-comparison-grid">
        ${comparisonCell(options.previousHeader || uiLabel("Previous"), requirementPreviousText(item), "ltr")}
        ${comparisonCell(options.targetHeader || uiLabel("Required"), requirementRequiredText(item), "ltr")}
        ${comparisonCell(options.actualHeader || uiLabel("Actual"), requirementActualCell(item, options.pending), "ltr", true)}
      </div>
      ${hasDetails ? `
        <details class="mobile-card-details">
          <summary>${uiLabel("Show details")}</summary>
          <div>
            ${item.whyItMatters ? `<p><b>${uiLabel("Why does it matter?")}</b> ${escapeHtml(localizedExternalText(item.whyItMatters))}</p>` : ""}
            ${item.evaluationNote ? `<p><b>${uiLabel("Result explanation")}</b> ${escapeHtml(localizedExternalText(item.evaluationNote))}</p>` : ""}
            ${item.direction ? `<p><b>${uiLabel("Direction")}</b> ${escapeHtml(directionLabel(item.direction))}</p>` : ""}
            ${item.impact ? `<p><b>${uiLabel("Investment Impact")}</b> ${escapeHtml(impactLabel(item.impact))}</p>` : ""}
          </div>
        </details>
      ` : ""}
    </article>
  `;
}

function comparisonCell(label, value, direction = "auto", valueIsHtml = false) {
  return `
    <div class="comparison-cell">
      <span>${escapeHtml(label)}</span>
      <strong dir="${escapeHtml(direction)}">${valueIsHtml ? value : escapeHtml(String(value))}</strong>
    </div>
  `;
}

function requirementMetricCell(item = {}) {
  const english = item.name || item.metric || "";
  const arabic = item.arabicName || "";
  const primary = localizedRequirementName(arabic || english || "-");
  const secondary = arabic && english && arabic !== english ? english : "";
  return `
    <div class="requirement-metric-name">
      <strong>${escapeHtml(primary)}</strong>
      ${secondary ? `<small dir="ltr">${escapeHtml(secondary)}</small>` : ""}
    </div>
  `;
}

function localizedRequirementName(value) {
  const text = String(value || "-").trim();
  const generic = text.match(/^Requirement\s+(\d+)$/i);
  if (generic && isArabicUi()) return `المتطلب ${generic[1]}`;
  return text;
}

function requirementWeightText(value) {
  return Number.isFinite(numericValue(value)) ? `${numericValue(value)}%` : "—";
}

function requirementPreviousText(item = {}) {
  return item.previousDisplay || formatRequirementValue(item.previousValue ?? item.currentLevel, item.unit);
}

function requirementRequiredText(item = {}) {
  return item.requiredDisplay || formatRequirementThreshold(item);
}

function requirementActualText(item = {}) {
  if (item.actualDisplay) return item.actualDisplay;
  if (item.actualValue !== null && item.actualValue !== undefined && item.actualValue !== "") {
    return formatRequirementValue(item.actualValue, item.unit);
  }
  return "";
}

function requirementActualCell(item = {}, pending = false) {
  const actual = requirementActualText(item);
  if (!actual) {
    const waiting = pending || String(item.status || "NOT_REPORTED").toUpperCase() === "NOT_REPORTED";
    return `<span class="requirement-actual missing">${waiting ? uiLabel("Waiting for announcement") : "—"}</span>`;
  }
  const impact = requirementImpactClass(item.impact);
  return `<span class="requirement-actual ${impact}">${escapeHtml(actual)}</span>${directionIndicator(item.direction)}`;
}

function directionIndicator(direction) {
  const clean = String(direction || "unknown").toLowerCase();
  if (clean === "up") return `<span class="direction-arrow direction-up" aria-label="${uiLabel("Direction Up")}">▲</span>`;
  if (clean === "down") return `<span class="direction-arrow direction-down" aria-label="${uiLabel("Direction Down")}">▼</span>`;
  if (clean === "flat") return `<span class="direction-arrow direction-flat" aria-label="${uiLabel("Direction Flat")}">—</span>`;
  return "";
}

function directionLabel(direction) {
  const clean = String(direction || "unknown").toLowerCase();
  if (clean === "up") return uiLabel("Direction Up");
  if (clean === "down") return uiLabel("Direction Down");
  if (clean === "flat") return uiLabel("Direction Flat");
  return uiLabel("Unknown");
}

function requirementImpactClass(impact) {
  const clean = String(impact || "unknown").toLowerCase();
  if (["positive", "negative", "mixed", "neutral"].includes(clean)) return `impact-${clean}`;
  return "impact-unknown";
}

function impactLabel(impact) {
  const clean = String(impact || "unknown").toLowerCase();
  if (clean === "positive") return uiLabel("Positive");
  if (clean === "negative") return uiLabel("Negative");
  if (clean === "mixed") return uiLabel("Mixed");
  if (clean === "neutral") return uiLabel("Neutral");
  return uiLabel("Unknown");
}

function formatRequirementThreshold(item = {}) {
  const type = String(item.type || "").toLowerCase();
  const prefix = type.includes("minimum") ? ">= " : type.includes("maximum") ? "<= " : "";
  return `${prefix}${formatRequirementValue(item.requiredValue, item.unit)}`;
}

function assessmentNumberText(value) {
  const number = numericValue(value);
  return Number.isFinite(number) ? number : "—";
}

function assessmentCountText(value, total) {
  const reported = assessmentNumberText(value);
  const reportedTotal = assessmentNumberText(total);
  return reported === "—" && reportedTotal === "—" ? "—" : `${reported}/${reportedTotal}`;
}

function requirementsAssessmentView(assessment = {}, requirementsBlock = {}) {
  const requirements = requirementsBlock?.requirements || [];
  const hasSuppliedAssessment = [
    assessment?.weightedAchievement,
    assessment?.reportedRequirements,
    assessment?.totalRequirements,
    assessment?.passed,
    assessment?.failed,
    assessment?.exceeded,
    assessment?.partiallyPassed,
    assessment?.notReported,
    assessment?.overallStatus,
    assessment?.summary
  ].some((value) => value !== null && value !== undefined && value !== "");
  if (!hasSuppliedAssessment && !requirements.length) return "";
  return `
    <div class="requirements-assessment-card ${requirementsStatusClass(assessment.overallStatus)}">
      <div class="assessment-score">
        <span>${uiLabel("Weighted Achievement")}</span>
        <strong>${Number.isFinite(numericValue(assessment.weightedAchievement)) ? `${Math.round(numericValue(assessment.weightedAchievement))}%` : "—"}</strong>
      </div>
      <div class="assessment-metrics">
        ${compactCardMetric(uiLabel("Reported Requirements"), assessmentCountText(assessment.reportedRequirements, assessment.totalRequirements))}
        ${compactCardMetric(uiLabel("Passed"), assessmentNumberText(assessment.passed))}
        ${compactCardMetric(uiLabel("Failed"), assessmentNumberText(assessment.failed))}
        ${compactCardMetric(uiLabel("Exceeded"), assessmentNumberText(assessment.exceeded))}
      </div>
      ${assessment.overallStatus ? `<p><b>${uiLabel("Thesis Status")}:</b> ${escapeHtml(requirementsStatusLabel(assessment.overallStatus))}</p>` : ""}
      ${assessment.summary ? `<p>${escapeHtml(localizedExternalText(assessment.summary))}</p>` : ""}
    </div>
  `;
}

function valuationMethodSummaryView(report = {}) {
  const method = report.primaryValuationMethod || report.metadata?.primaryValuationMethod;
  const reason = report.valuationSelectionReason || report.metadata?.valuationSelectionReason;
  const scenarioRows = Object.entries(report.scenarios || {}).filter(([, value]) => value);
  if (!method && !reason && !scenarioRows.length) return "";
  return `
    <div class="valuation-method-summary">
      ${method ? compactCardMetric(uiLabel("Primary Valuation Method"), method) : ""}
      ${reason ? `<p>${escapeHtml(localizedExternalText(reason))}</p>` : ""}
      ${scenarioRows.length ? `
        <div class="scenario-assumption-grid">
          ${scenarioRows.map(([label, scenario]) => `
            <article class="${valuationScenarioClass(label)}">
              <strong>${escapeHtml(label)} ${money(scenario.fairValue, 0)}</strong>
              ${scenario.valuationMethod ? `<span>${uiLabel("Method")}: ${escapeHtml(scenario.valuationMethod)}</span>` : ""}
              ${scenario.revenueAssumption ? `<span>Revenue: ${escapeHtml(formatAnyValue(scenario.revenueAssumption))}</span>` : ""}
              ${scenario.marginAssumption ? `<span>Margin: ${escapeHtml(formatAnyValue(scenario.marginAssumption))}</span>` : ""}
              ${scenario.multipleUsed ? `<span>${uiLabel("Multiple Used")}: ${escapeHtml(formatAnyValue(scenario.multipleUsed))}</span>` : ""}
              ${scenario.timeHorizon ? `<span>${uiLabel("Time Horizon")}: ${escapeHtml(scenario.timeHorizon)}</span>` : ""}
              ${scenario.thesis ? `<p>${escapeHtml(localizedExternalText(scenario.thesis))}</p>` : ""}
            </article>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

function businessQualityBlock(quality = {}) {
  return [
    quality.summary,
    quality.moat ? `Economic Moat: ${quality.moat}` : null,
    quality.profitability ? `Profitability: ${quality.profitability}` : null,
    quality.balanceSheet ? `Balance Sheet: ${quality.balanceSheet}` : null,
    quality.capitalAllocation ? `Capital Allocation: ${quality.capitalAllocation}` : null,
    quality.earningsQuality ? `Earnings Quality: ${quality.earningsQuality}` : null,
    quality.strengths?.length ? `Strengths: ${quality.strengths.join(" / ")}` : null,
    quality.weaknesses?.length ? `Weaknesses: ${quality.weaknesses.join(" / ")}` : null
  ].filter(Boolean).map((item) => `<p>${escapeHtml(item)}</p>`).join("");
}

function earningsQualityBlock(quality = {}) {
  return paragraphBlock([
    quality.status,
    quality.reportedVsNormalizedExplanation,
    ...(quality.oneOffItems || [])
  ]);
}

function paragraphBlock(items = []) {
  const visible = items.map((item) => localizedExternalText(item)).filter((item) => item.trim());
  return visible.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
}

function objectBlock(object = {}) {
  const rows = Object.entries(object || {}).filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!rows.length) return "";
  return rows.map(([key, value]) => `<p><strong>${escapeHtml(labelFromKey(key))}</strong>: ${escapeHtml(localizedExternalText(formatAnyValue(value)))}</p>`).join("");
}

function itemList(items = [], detailKeys = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <div class="external-list">
      ${items.map((item) => {
        if (typeof item === "string") return `<p>${escapeHtml(localizedExternalText(item))}</p>`;
        const title = item.title || item.name || item.sourceType || "-";
        const details = detailKeys.map((key) => localizedExternalText(item[key])).filter((value) => value.trim());
        return `<article><strong>${escapeHtml(localizedExternalText(title))}</strong>${details.map((detail) => `<span>${escapeHtml(localizedExternalText(detail))}</span>`).join("")}</article>`;
      }).join("")}
    </div>
  `;
}

function sourcesView(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `
    <div class="source-card-list">
      ${items.map((item) => {
        const title = localizedExternalText(item.title || item.name || item.sourceTitle || item.publisher || uiLabel("Sources"));
        const publisher = localizedExternalText(item.publisher || item.sourceType || item.type || item.date || "");
        const url = item.url ? String(item.url) : "";
        return `
          <article class="source-readable-card">
            <div>
              <strong>${escapeHtml(title || uiLabel("Sources"))}</strong>
              ${publisher ? `<span>${escapeHtml(publisher)}</span>` : ""}
            </div>
            ${/^https?:\/\//i.test(url) ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer noopener">${uiLabel("Open Source")}</a>` : ""}
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function simpleList(items = []) {
  const visible = Array.isArray(items) ? items.map((item) => localizedExternalText(item)).filter((item) => item.trim()) : [];
  return visible.length ? `<ul>${visible.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
}

function externalVersionHistory(currentReport, history = []) {
  return `
    <div class="version-list external-version-list">
      ${history.map((report) => `
        <button class="${report.id === currentReport.id ? "active" : ""}" data-external-history-ticker="${escapeHtml(report.company?.ticker)}" data-external-history-id="${escapeHtml(report.id)}">
          <strong>${escapeHtml(report.reportPeriod || report.analysisDate || report.id)}</strong>
          <span>${escapeHtml(report.analysisDate || "-")} / ${localizedExternalText(externalRecommendationAction(report) || "-")} / ${uiLabel("Weighted Achievement")}: ${Number.isFinite(numericValue(report.requirementsAssessment?.weightedAchievement)) ? `${Math.round(numericValue(report.requirementsAssessment.weightedAchievement))}%` : "—"}</span>
          <small>
            Bear ${money(report.fairValue?.bear, 0)} / Base ${money(report.fairValue?.base, 0)} / Bull ${money(report.fairValue?.bull, 0)}
            · Quality ${scoreText(report.scores?.quality, 1)} · Growth ${scoreText(report.scores?.growth, 1)} · Risk ${scoreText(report.scores?.risk, 1)}
          </small>
        </button>
      `).join("")}
    </div>
  `;
}

function methodLabel(key) {
  const labels = { dcf: "DCF", pe: "P/E", evEbitda: "EV/EBITDA", ps: "P/S", peg: "PEG", sotp: "SOTP", other: "Other" };
  return labels[key] || labelFromKey(key);
}

function guidanceDirectionClass(value) {
  const clean = String(value || "not_applicable");
  if (clean === "raised") return "raised";
  if (clean === "lowered") return "lowered";
  if (clean === "maintained") return "maintained";
  if (clean === "new") return "new";
  return "neutral";
}

function guidanceDirectionLabel(value) {
  const labels = {
    raised: uiLabel("Raised"),
    maintained: uiLabel("Maintained"),
    lowered: uiLabel("Lowered"),
    new: uiLabel("New"),
    not_applicable: uiLabel("Not Applicable")
  };
  return labels[String(value || "not_applicable")] || uiLabel("Not Applicable");
}

function trendClass(value) {
  const clean = String(value || "unknown");
  if (clean === "improving") return "improving";
  if (clean === "deteriorating") return "deteriorating";
  if (clean === "stable") return "stable";
  return "unknown";
}

function trendLabel(value) {
  const labels = {
    improving: uiLabel("Improving"),
    stable: uiLabel("Stable"),
    deteriorating: uiLabel("Deteriorating"),
    unknown: uiLabel("Unknown")
  };
  return labels[String(value || "unknown")] || uiLabel("Unknown");
}

function importanceLabel(value) {
  const labels = {
    critical: uiLabel("Critical"),
    high: uiLabel("High"),
    medium: uiLabel("Medium"),
    low: uiLabel("Low")
  };
  return labels[String(value || "medium")] || uiLabel("Medium");
}

function kpiCategoryLabel(value) {
  const labels = {
    growth: financialTerm("Growth"),
    profitability: uiLabel("Profitability"),
    demand: uiLabel("Demand"),
    capacity: uiLabel("Capacity"),
    customer: uiLabel("Customer"),
    pricing: uiLabel("Pricing"),
    backlog: uiLabel("Backlog"),
    operational: uiLabel("Operational"),
    other: uiLabel("Other")
  };
  return labels[String(value || "other")] || uiLabel("Other");
}

function requirementStatusBadge(status) {
  const clean = String(status || "NOT_REPORTED").toUpperCase();
  return `<span class="requirement-status ${requirementStatusClass(clean)}">${escapeHtml(requirementStatusLabel(clean))}</span>`;
}

function requirementStatusClass(status) {
  if (status === "EXCEEDED") return "exceeded";
  if (status === "PASSED") return "passed";
  if (status === "PARTIALLY_PASSED") return "partial";
  if (status === "FAILED") return "failed";
  return "not-reported";
}

function requirementStatusLabel(status) {
  const labels = {
    EXCEEDED: uiLabel("Exceeded"),
    PASSED: uiLabel("Passed"),
    PARTIALLY_PASSED: uiLabel("Partially Passed"),
    FAILED: uiLabel("Failed"),
    NOT_REPORTED: uiLabel("Not Reported")
  };
  return labels[String(status || "NOT_REPORTED").toUpperCase()] || uiLabel("Not Reported");
}

function requirementsStatusClass(status) {
  const clean = String(status || "").toLowerCase();
  if (clean.includes("strengthened")) return "strengthened";
  if (clean.includes("broken")) return "broken";
  if (clean.includes("weakened")) return "weakened";
  return "unchanged";
}

function requirementsStatusLabel(status) {
  const labels = {
    bull_case_strengthened: uiLabel("Bull Case Strengthened"),
    bull_case_unchanged: uiLabel("Bull Case Unchanged"),
    bull_case_weakened: uiLabel("Bull Case Weakened"),
    thesis_strengthened: uiLabel("Thesis Strengthened"),
    thesis_weakened: uiLabel("Thesis Weakened"),
    thesis_broken: uiLabel("Thesis Broken"),
    NO_PRIOR_SET: uiLabel("لا توجد متطلبات سابقة للمقارنة.")
  };
  return labels[String(status || "")] || localizedExternalText(status || "-");
}

function targetScenarioLabel(value) {
  const clean = String(value || "").trim().toLowerCase();
  if (clean === "bear" || clean === "downside") return "Bear";
  if (clean === "base" || clean === "base_case") return "Base";
  if (clean === "bull" || clean === "optimistic") return clean === "bull" ? "Bull" : "Optimistic";
  return localizedExternalText(value || "—").replaceAll("_", " ");
}

function formatRequirementValue(value, unit) {
  if (value === null || value === undefined || value === "") return "—";
  const formatted = formatAnyValue(value);
  if (!unit || unit === "text" || unit === "other") return formatted;
  const cleanUnit = String(unit).trim();
  const cleanValue = String(formatted).trim();
  if (!cleanUnit || cleanValue.endsWith(cleanUnit)) return cleanValue;
  if (cleanUnit === "%" && cleanValue.endsWith("%")) return cleanValue;
  return `${cleanValue} ${cleanUnit}`;
}

function valuationWorkspacePanel(state) {
  const workspace = state.valuationWorkspace;
  if (!workspace) {
    return emptyAnalysisWorkspace(state);
  }
  const review = workspace.dataReview || {};
  const report = workspace.report;
  if (state.loading) return processingStatePanel(workspace, state);
  if (report) {
    return `
      <section class="investment-report-shell">
        ${investmentReportExperience(workspace, state)}
      </section>
    `;
  }
  return `
    <section class="analysis-flow-shell">
      ${analysisWorkspaceHeader(workspace, review, state)}
      ${workflowSteps(workspace, state)}
      ${workspace.pastePreview ? pastePreviewCard(workspace) : ""}
      <section class="analysis-flow-grid">
        <article class="panel paste-stage">${analystBrainPastePanel(workspace, state)}</article>
        <article class="panel review-stage">${dataReviewPanel(workspace, state)}</article>
      </section>
    </section>
  `;
}

function emptyAnalysisWorkspace(state) {
  return `
    <section class="analysis-flow-shell">
      <article class="panel workflow-empty analysis-empty">
        <div class="app-logo large"><img src="./assets/icon-192.png" alt=""></div>
        <p class="eyebrow">${uiLabel("New Analysis")}</p>
        <h2>${uiLabel("Start with one company data block")}</h2>
        <p>${uiLabel("Paste the company data once. The app extracts fields, asks you to review them, then shows the investment report first.")}</p>
        <div class="analysis-empty-actions">
          <button class="primary-btn" data-action="new-analysis">${uiLabel("Open Paste Box")}</button>
          <button class="icon-btn" data-action="load-demo-analysis">${uiLabel("Load Demo Data")}</button>
        </div>
      </article>
      ${searchBlock(state)}
    </section>
  `;
}

function analysisWorkspaceHeader(workspace, review, state) {
  return `
    <article class="analysis-header">
      <div>
        <p class="eyebrow">${uiLabel("Investment Analyst")}</p>
        <h2>${escapeHtml(workspace.companyName || workspace.ticker || uiLabel("New Analysis"))}</h2>
        <p>${uiLabel("One paste box, one review, one investment report.")}</p>
      </div>
      <div class="analysis-header-metrics">
        ${miniMetric(uiLabel("Status"), workflowStatusLabel(workspace.status, state.language))}
        ${miniMetric(uiLabel("Data Review"), `${review.requiredConfirmed || 0}/${review.requiredTotal || 0}`)}
        ${miniMetric(uiLabel("Completeness"), `${review.completeness || 0}/100`)}
      </div>
    </article>
  `;
}

function analystBrainPastePanel(workspace, state) {
  const pasteLength = String(workspace.analystBrainPaste || "").trim().length;
  return `
    <div class="analyst-paste-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Investment Analyst Brain v1.1</p>
          <h3>${uiLabel("Paste one company data block")}</h3>
          <p class="muted">${uiLabel("Paste company profile, financials, estimates, Morningstar notes, and your notes in one place. No long form is required before parsing.")}</p>
        </div>
      </div>
      <div class="analysis-input-row">
        <label>${uiLabel("Ticker")}
          <input data-workflow-field="ticker" value="${escapeHtml(workspace.inputs?.ticker?.value || workspace.ticker || "")}" autocomplete="off" autocapitalize="characters" placeholder="AAPL">
        </label>
        <label>${uiLabel("Company Name")}
          <input data-workflow-field="companyName" value="${escapeHtml(workspace.inputs?.companyName?.value || workspace.companyName || "")}" autocomplete="off" placeholder="${uiLabel("Optional before paste")}">
        </label>
      </div>
      <textarea class="paste-box brain-paste-box" data-brain-paste placeholder="${uiLabel("Paste one unstructured company data block here.")}">${escapeHtml(workspace.analystBrainPaste || "")}</textarea>
      ${workspace.aiParseNotes?.length ? `<div class="parse-notes">${workspace.aiParseNotes.map((note) => `<span>${escapeHtml(note)}</span>`).join("")}</div>` : ""}
      <div class="brain-actions">
        <div class="brain-action-buttons">
          <button class="primary-btn" data-action="analyze-brain" ${state.loading ? "disabled" : ""}>${state.loading ? uiLabel("Analyzing") : uiLabel("Analyze Paste")}</button>
          <button class="icon-btn" data-action="load-demo-analysis">${uiLabel("Load Demo Data")}</button>
          <button class="icon-btn" data-action="clear-analysis-paste">${uiLabel("Clear")}</button>
        </div>
        <span>${uiLabel("Drafts stay private until approval.")} ${pasteLength ? `${pasteLength.toLocaleString()} ${uiLabel("characters")}` : ""}</span>
      </div>
    </div>
  `;
}

function analystBrainMethodologyPanel() {
  return `
    <div class="methodology-card">
      <p class="eyebrow">${uiLabel("Methodology")}</p>
      <h3>Investment Analyst Brain v1</h3>
      <p class="muted">${uiLabel("The fixed methodology controls classification, model selection, forecasts, WACC, scenarios, fair value, recommendation, monitoring, and JSON output.")}</p>
      <div class="method-tags">
        ${["Classification", "Quality", "Forecasts", "WACC", "Scenarios", "Fair Value", "Recommendation", "JSON"].map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
    </div>
  `;
}

function workflowSteps(workspace, state) {
  const steps = [
    ["1", uiLabel("Paste"), Boolean(workspace.analystBrainPaste || workspace.inputs?.ticker?.value)],
    ["2", uiLabel("Review"), (workspace.dataReview?.confirmed?.length || 0) > 0],
    ["3", uiLabel("Analyze"), workspace.dataReview?.canRun],
    ["4", uiLabel("Report"), Boolean(workspace.report)],
    ["5", uiLabel("Approve"), workspace.status === WORKFLOW_STATUS.APPROVED]
  ];
  return `
    <div class="workflow-steps">
      ${steps.map(([number, label, done]) => `
        <span class="${done ? "done" : ""}"><b>${number}</b>${escapeHtml(label)}</span>
      `).join("")}
    </div>
  `;
}

function processingStatePanel(workspace, state) {
  const active = state.processingStage || "running-engine";
  const stages = [
    ["parsing-paste", uiLabel("Reading pasted data"), uiLabel("Extracting only values present in your text.")],
    ["reviewing-data", uiLabel("Reviewing data"), uiLabel("Checking confirmed, missing, and conflicting fields.")],
    ["running-engine", uiLabel("Running deterministic engine"), uiLabel("Calculations come from code, not AI narrative.")],
    ["building-report", uiLabel("Building report"), uiLabel("Preparing the investment committee view.")]
  ];
  return `
    <section class="processing-screen" data-screen="Processing">
      <div class="processing-mark" aria-hidden="true">${escapeHtml(String(workspace.ticker || "AI").slice(0, 3))}</div>
      <p class="eyebrow">${uiLabel("Analysis in progress")}</p>
      <h2>${escapeHtml(workspace.companyName || workspace.ticker || uiLabel("Investment Report"))}</h2>
      <p>${uiLabel("Please keep this page open while the report is prepared.")}</p>
      <div class="processing-steps">
        ${stages.map(([key, label, detail]) => `
          <div class="${key === active ? "active" : stages.findIndex(([stage]) => stage === key) < stages.findIndex(([stage]) => stage === active) ? "done" : ""}">
            <b></b>
            <span>${escapeHtml(label)}</span>
            <small>${escapeHtml(detail)}</small>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function workflowSection(workspace, sectionId, label, openBasics = true) {
  const fields = FIELD_DEFINITIONS.filter((field) => field.sectionId === sectionId);
  const source = workspace.sectionSources?.[sectionId] || {};
  return `
    <details class="workflow-section" ${openBasics && sectionId === "basics" ? "open" : ""}>
      <summary>
        <strong>${uiLabel(label)}</strong>
        <span>${fields.filter((field) => workspace.inputs?.[field.id]?.userConfirmed).length}/${fields.length}</span>
      </summary>
      <div class="workflow-source-row">
        <label>${uiLabel("Source")}<input data-workflow-source="${sectionId}" data-source-field="source" value="${escapeHtml(source.source || "Manual Paste")}"></label>
        <label>${uiLabel("Source Date")}<input type="date" data-workflow-source="${sectionId}" data-source-field="sourceDate" value="${escapeHtml(source.sourceDate || "")}"></label>
      </div>
      <textarea class="paste-box" data-workflow-paste="${sectionId}" placeholder="${uiLabel("Paste copied tables, plain text, tab-separated data, or CSV-style data here.")}">${escapeHtml(workspace.pasteDrafts?.[sectionId] || "")}</textarea>
      <button class="icon-btn" data-action="parse-paste" data-section="${sectionId}">${uiLabel("Parse pasted data")}</button>
      <div class="workflow-fields">
        ${fields.map((field) => workflowField(workspace, field)).join("")}
      </div>
    </details>
  `;
}

function workflowField(workspace, field) {
  const item = workspace.inputs?.[field.id] || {};
  const inputType = field.type === "number" ? "text" : field.type === "date" ? "date" : "text";
  const status = item.userConfirmed ? uiLabel("Confirmed") : item.value !== undefined && item.value !== null && item.value !== "" ? uiLabel("Needs confirmation") : field.required ? uiLabel("Required") : uiLabel("Optional");
  const statusClass = item.userConfirmed ? "ready" : field.required ? "limited" : "";
  return `
    <label class="workflow-field ${statusClass}">
      <span>${uiLabel(field.label)} ${field.required ? "<b>*</b>" : ""}</span>
      <input data-workflow-field="${field.id}" type="${inputType}" value="${escapeHtml(item.value ?? "")}" placeholder="${field.type === "number" ? "0" : ""}">
      <small>${escapeHtml(status)} / ${escapeHtml(item.source || uiLabel("No source"))}</small>
    </label>
  `;
}

function investmentReportExperience(workspace, state) {
  const report = workspace.report;
  return `
    <article class="investment-report" data-legacy-report-anchor="Executive Summary">
      ${reportCompanyHeader(workspace, report)}
      ${decisionCenterCard(report)}
      <section class="report-story polished-report-story">
        ${investmentTakeaways(report, state.language)}
        ${scenarioCards(report)}
        ${fairValueVisual(report)}
        ${businessQualityOverview(report)}
        ${riskSnapshot(report)}
        ${valuationModelsSnapshot(report)}
        ${forecastSnapshot(report)}
        ${monitoringSnapshot(report)}
        <article class="report-section" data-screen="What Changes My Mind">
          <p class="eyebrow">${uiLabel("What Could Change This Decision")}</p>
          ${listReport(report.whatWouldChangeTheValuation)}
        </article>
        ${finalActionsBlock(workspace, report)}
      </section>
      ${collapsibleReportDetails(workspace, report)}
    </article>
  `;
}

function reportCompanyHeader(workspace, report) {
  const c = report.executiveConclusion;
  const company = report.companyAndValuationDate;
  const classification = report.companyClassification?.classification || uiLabel("Data driven");
  const sector = report.companyProfile?.sector || report.companyProfile?.industry || report.company?.sector || report.company?.industry || classification;
  return `
    <header class="report-cover report-company-header">
      <div class="company-identity">
        <div class="ticker-avatar large premium-ticker-avatar">${escapeHtml(String(company.ticker || "").slice(0, 3))}</div>
        <div>
          <p class="eyebrow">${uiLabel("Investment Report")}</p>
          <h1>${escapeHtml(company.companyName)}</h1>
          <p class="muted company-meta-line">
            <span>${escapeHtml(company.ticker)}</span>
            <span>${escapeHtml(sector)}</span>
            <span>${uiLabel("Valuation Date")}: ${escapeHtml(company.valuationDate)}</span>
            <span>${uiLabel("Methodology")}: ${escapeHtml(report.methodologyVersion)}</span>
          </p>
        </div>
      </div>
      <div class="report-hero-metrics">
        <div>
          <span>${uiLabel("Current Price")}</span>
          <strong>${money(c.currentPrice, 2)}</strong>
        </div>
        <div>
          <span>${uiLabel("Fair Value")}</span>
          <strong>${money(c.rangeFairValue, 0)}</strong>
        </div>
        <div class="${String(c.recommendation).toLowerCase()}">
          <span>${uiLabel("Recommendation")}</span>
          <strong>${escapeHtml(decisionLabel(c.recommendation))}</strong>
        </div>
        <div>
          <span>${uiLabel("Confidence")}</span>
          <strong>${Math.round(c.confidence || 0)}%</strong>
        </div>
      </div>
      <div class="report-actions">
        <button class="icon-btn" data-action="edit-workspace-data">${uiLabel("Edit Data and Re-run")}</button>
        <button class="primary-btn" data-action="approve-and-export" ${workspace.status === WORKFLOW_STATUS.APPROVED ? "disabled" : ""}>${uiLabel("Approve and Export")}</button>
      </div>
    </header>
  `;
}

function decisionCenterCard(report) {
  const item = report.executiveConclusion;
  const decision = decisionLabel(item.recommendation);
  const score = Math.round(item.investmentScore || 0);
  const confidence = Math.round(item.confidence || 0);
  const why = shortText(item.why || report.finalInvestmentDecision?.why || executiveReportSummary(report, "ar"), 150);
  return `
    <section class="decision-card product-decision-card ${String(item.recommendation).toLowerCase()}" data-screen="Decision Summary">
      <div class="decision-card-main">
        <span>${uiLabel("Recommendation")}</span>
        <strong>${escapeHtml(decision)}</strong>
        <p>${escapeHtml(why)}</p>
      </div>
      <div class="decision-metric-grid">
        ${decisionMetric(uiLabel("Fair Value"), money(item.rangeFairValue, 0), "hero")}
        ${decisionMetric(uiLabel("Upside %"), formatSignedPercent(item.expectedUpside), colorClass(upsideColorCategory(item.expectedUpside)))}
        ${decisionMetric(uiLabel("Current Price"), money(item.currentPrice, 2))}
        ${decisionMetric(uiLabel("Maximum Upside"), formatSignedPercent(item.maximumUpside), colorClass(upsideColorCategory(item.maximumUpside)))}
      </div>
      <div class="decision-score-row">
        <div class="confidence-ring" style="--value:${clampNumber(confidence, 0, 100)}"><b>${confidence}%</b><span>${uiLabel("Confidence")}</span></div>
        <div class="investment-score-pill">
          <span>${uiLabel("Investment Score")}</span>
          <strong>${score}</strong>
        </div>
      </div>
    </section>
  `;
}

function decisionMetric(label, value, tone = "") {
  return `
    <div class="decision-metric ${escapeHtml(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function investmentTakeaways(report, language) {
  const positives = takeReportItems(report.finalInvestmentDecision?.mainPositiveDrivers, report.catalysts, 3);
  const risks = takeReportItems(report.finalInvestmentDecision?.mainNegativeDrivers, report.risks, 3);
  const conclusion = shortText(report.finalInvestmentDecision?.why || report.executiveConclusion?.why || executiveReportSummary(report, language), 170);
  return `
    <article class="report-section full takeaway-section" data-screen="Investment Thesis">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">${uiLabel("Investment Thesis")}</p>
          <h3>${uiLabel("Decision Snapshot")}</h3>
        </div>
      </div>
      <div class="takeaway-grid">
        <div>
          <h4>${uiLabel("Key Positives")}</h4>
          ${compactList(positives)}
        </div>
        <div>
          <h4>${uiLabel("Key Risks")}</h4>
          ${compactList(risks)}
        </div>
        <div class="short-conclusion">
          <h4>${uiLabel("Short Conclusion")}</h4>
          <p>${escapeHtml(conclusion || uiLabel("The decision is based only on confirmed inputs."))}</p>
        </div>
      </div>
    </article>
  `;
}

function quickSummaryCard(report) {
  const item = report.executiveConclusion;
  return `
    <section class="quick-summary-card">
      <div class="quick-decision ${String(item.recommendation).toLowerCase()}">
        <span>${uiLabel("Recommendation")}</span>
        <strong>${escapeHtml(decisionLabel(item.recommendation))}</strong>
      </div>
      ${quickMetric(uiLabel("Confidence"), `${Math.round(item.confidence)}%`)}
      ${quickMetric(uiLabel("Investment Score"), Math.round(item.investmentScore))}
      ${quickMetric(uiLabel("Fair Value"), money(item.rangeFairValue, 0))}
      ${quickMetric(uiLabel("Current Price"), money(item.currentPrice, 2))}
      ${quickMetric(uiLabel("Upside %"), formatSignedPercent(item.expectedUpside))}
      ${quickMetric(uiLabel("Maximum Upside"), formatSignedPercent(item.maximumUpside))}
    </section>
  `;
}

function quickMetric(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function miniMetric(label, value) {
  return `<div class="mini-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value ?? "—"))}</strong></div>`;
}

function compactList(items = []) {
  const visible = items.map(normalizeReportItem).filter(Boolean).slice(0, 3);
  return visible.length
    ? `<ul class="compact-list">${visible.map((item) => `<li>${escapeHtml(shortText(item, 92))}</li>`).join("")}</ul>`
    : `<p class="muted">${uiLabel("Missing")}</p>`;
}

function takeReportItems(primary = [], fallback = [], count = 3) {
  return [...(primary || []), ...(fallback || [])].map(normalizeReportItem).filter(Boolean).slice(0, count);
}

function normalizeReportItem(item) {
  if (item === null || item === undefined) return "";
  if (typeof item === "string") return item;
  if (typeof item === "number") return String(item);
  return item.title || item.name || item.metric || item.explanation || item.why || item.focus || "";
}

function shortText(text, maxLength = 120) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, Math.max(0, maxLength - 1)).trim()}…` : clean;
}

function scenarioCards(report) {
  const currentPrice = report.executiveConclusion.currentPrice;
  const scenarios = [
    scenarioView("Bear", report.bearScenario || report.scenarios?.Conservative),
    scenarioView("Base", report.baseScenario || report.scenarios?.Base),
    scenarioView("Bull", report.bullScenario || report.scenarios?.Optimistic)
  ].filter((item) => item.scenario);
  return `
    <article class="report-section full scenario-report-section product-scenario-section" data-screen="Bear Base Bull Cards">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">${uiLabel("Scenarios")}</p>
          <h3>Bear / Base / Bull</h3>
        </div>
        <span>${uiLabel("Probability weighted")}</span>
      </div>
      <div class="scenario-report-grid">
        ${scenarios.map(({ label, scenario }) => `
          <div class="scenario-report-card ${label.toLowerCase()}">
            <div class="scenario-card-head">
              <span>${escapeHtml(label)}</span>
              <small>${Math.round((scenario.probability || 0) * 100)}% ${uiLabel("Probability")}</small>
            </div>
            <strong>${money(scenario.fairValue, 0)}</strong>
            <div class="scenario-mini-grid">
              ${miniMetric(uiLabel("Upside %"), scenarioUpside(scenario, currentPrice))}
              ${miniMetric(uiLabel("Main condition"), scenarioMainCondition(scenario))}
              ${miniMetric(uiLabel("Main risk"), scenarioMainRisk(scenario))}
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function scenarioView(label, scenario) {
  return { label, scenario };
}

function scenarioText(scenario, currentPrice) {
  const upside = Number.isFinite(scenario?.fairValue) && Number.isFinite(currentPrice)
    ? formatSignedPercent((scenario.fairValue - currentPrice) / currentPrice)
    : "—";
  const risk = (scenario?.keyRisks || [])[0];
  const catalyst = (scenario?.keyCatalysts || [])[0];
  return [upside, catalyst, risk].filter(Boolean).join(" / ");
}

function scenarioUpside(scenario, currentPrice) {
  return Number.isFinite(scenario?.fairValue) && Number.isFinite(currentPrice)
    ? formatSignedPercent((scenario.fairValue - currentPrice) / currentPrice)
    : "—";
}

function scenarioMainCondition(scenario = {}) {
  return shortText((scenario.keyCatalysts || scenario.conditions || [])[0] || scenario.revenueAssumption || scenario.summary || "—", 58);
}

function scenarioMainRisk(scenario = {}) {
  return shortText((scenario.keyRisks || [])[0] || scenario.risk || "—", 58);
}

function priceScenarioChart(report) {
  const c = report.executiveConclusion;
  const values = [
    ["Current", c.currentPrice],
    ["Bear", c.bearFairValue],
    ["Base", c.baseFairValue],
    ["Bull", c.bullFairValue]
  ].filter(([, value]) => Number.isFinite(value));
  const max = Math.max(...values.map(([, value]) => value), 1);
  return `
    <div class="price-scenario-chart" data-screen="Price Scenario Chart">
      ${values.map(([label, value]) => `
        <div>
          <span>${escapeHtml(label)}</span>
          <i style="height:${Math.max(12, Math.round((value / max) * 86))}px"></i>
          <strong>${money(value, 0)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}

function fairValueVisual(report) {
  const c = report.executiveConclusion;
  const points = [c.currentPrice, c.bearFairValue, c.baseFairValue, c.bullFairValue, c.rangeFairValue].filter(Number.isFinite);
  if (!points.length) {
    return `
      <article class="report-section full fair-value-card" data-screen="Fair Value Range">
        <p class="eyebrow">${uiLabel("Fair Value Range")}</p>
        <h3>${uiLabel("Data Unavailable")}</h3>
        <p>${uiLabel("Fair value visualization requires confirmed price and valuation outputs.")}</p>
      </article>
    `;
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = Math.max((max - min) * 0.14, Math.max(max, 1) * 0.06);
  const domainMin = min - pad;
  const domainMax = max + pad;
  const position = (value) => Number.isFinite(value) ? clampNumber(((value - domainMin) / Math.max(domainMax - domainMin, 1)) * 100, 0, 100) : null;
  const rangeStart = Math.min(position(c.bearFairValue) ?? 0, position(c.bullFairValue) ?? 100);
  const rangeEnd = Math.max(position(c.bearFairValue) ?? 0, position(c.bullFairValue) ?? 100);
  return `
    <article class="report-section full fair-value-card" data-screen="Fair Value Range">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">${uiLabel("Fair Value Range")}</p>
          <h3>${money(c.rangeFairValue, 0)} ${uiLabel("vs")} ${money(c.currentPrice, 2)}</h3>
        </div>
        <strong class="${colorClass(upsideColorCategory(c.expectedUpside))}">${formatSignedPercent(c.expectedUpside)}</strong>
      </div>
      <div class="premium-fair-range" aria-label="${uiLabel("Fair Value Range")}">
        <div class="fair-axis">
          <span class="fair-axis-muted"></span>
          <span class="fair-axis-range" style="inset-inline-start:${rangeStart}%; width:${Math.max(rangeEnd - rangeStart, 4)}%"></span>
          ${valueMarker(uiLabel("Current Price"), c.currentPrice, position(c.currentPrice), "current")}
          ${valueMarker(uiLabel("Fair Value"), c.rangeFairValue, position(c.rangeFairValue), "fair")}
        </div>
        <div class="fair-stage-row">
          ${fairStage("Bear", c.bearFairValue)}
          ${fairStage("Base", c.baseFairValue)}
          ${fairStage("Bull", c.bullFairValue)}
        </div>
      </div>
      <div class="fair-value-legend">
        ${miniMetric("Bear", money(c.bearFairValue, 0))}
        ${miniMetric("Base", money(c.baseFairValue, 0))}
        ${miniMetric("Bull", money(c.bullFairValue, 0))}
        ${miniMetric(uiLabel("Range FV"), money(c.rangeFairValue, 0))}
      </div>
    </article>
  `;
}

function valueMarker(label, value, position, tone = "") {
  if (position === null) return "";
  return `<span class="value-marker ${escapeHtml(tone)}" style="inset-inline-start:${position}%"><b>${escapeHtml(label)}</b><small>${money(value, 0)}</small></span>`;
}

function fairStage(label, value) {
  return `
    <div class="fair-stage ${escapeHtml(label.toLowerCase())}">
      <span>${escapeHtml(label)}</span>
      <strong>${money(value, 0)}</strong>
    </div>
  `;
}

function businessQualityOverview(report) {
  const quality = report.businessQuality || {};
  const components = (quality.components || []).slice(0, 6);
  const strengths = qualityStrengths(quality, report).slice(0, 3);
  const weaknesses = qualityWeaknesses(quality, report).slice(0, 3);
  return `
    <article class="report-section full business-quality-card" data-screen="Business Quality">
      <div class="section-title-row">
        <div>
          <p class="eyebrow">${financialTerm("Quality")}</p>
          <h3>${Math.round(quality.score || report.executiveConclusion.investmentScore || 0)}/100</h3>
        </div>
        <div class="quality-summary-meta">
          <span>${escapeHtml(quality.rating || uiLabel("Data driven"))}</span>
          <small>${uiLabel("Confidence")} ${Math.round(quality.confidence || report.executiveConclusion.confidence || 0)}%</small>
        </div>
      </div>
      <div class="quality-two-col">
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
      ${metricHtml("Conservative", fairValueSignal(item.bearFairValue, item.currentPrice))}
      ${metricHtml("Base", fairValueSignal(item.baseFairValue, item.currentPrice))}
      ${metricHtml("Optimistic", fairValueSignal(item.bullFairValue, item.currentPrice))}
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
        ${compactCardMetric(uiLabel("Evaluated Companies"), preview.evaluatedCompanies ?? 0)}
        ${compactCardMetric(uiLabel("Watchlist"), preview.watchListItems ?? 0)}
      </div>
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
  root.querySelector("[data-action='copy-full-analysis-prompt']")?.addEventListener("click", () => {
    const tickerHint = root.querySelector("[data-external-ticker-hint]")?.value || "";
    copyExternalAnalysisPrep(store, "prompt", tickerHint);
  });
  root.querySelector("[data-action='copy-external-json-template']")?.addEventListener("click", () => {
    const tickerHint = root.querySelector("[data-external-ticker-hint]")?.value || "";
    copyExternalAnalysisPrep(store, "template", tickerHint);
  });
  root.querySelectorAll("[data-action='copy-new-earnings-prompt']").forEach((button) => {
    button.addEventListener("click", () => copyNewEarningsAnalysisPrompt(store));
  });
  root.querySelectorAll("[data-action='open-earnings-update']").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      store.openEarningsUpdate();
    });
  });
  root.querySelector("[data-action='close-earnings-update']")?.addEventListener("click", store.closeEarningsUpdate);
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
      area?.querySelectorAll("[data-data-view-panel]").forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.dataViewPanel === select.value);
      });
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

async function copySelectedExternalReport(store) {
  const report = selectedExternalReport(store);
  if (!report) return;
  const json = copyableExternalAnalysisJson(report);
  await navigator.clipboard?.writeText(json);
  store.set({ notice: store.state.language === "ar" ? "تم نسخ JSON." : "JSON copied." });
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
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(result.text);
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
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
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
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
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
  const text = isTemplate
    ? store.currentExternalAnalysisJsonTemplate?.(tickerHint)
    : store.currentFullAnalysisPrompt?.(tickerHint);
  if (!text) return;
  const copiedNotice = isTemplate
    ? (store.state.language === "ar" ? "تم نسخ JSON Template." : "JSON Template copied.")
    : (store.state.language === "ar" ? "تم نسخ برومبت تحليل السهم." : "Analysis prompt copied.");
  const fallbackTitle = isTemplate
    ? (store.state.language === "ar" ? "انسخ JSON Template يدويًا" : "Copy JSON Template manually")
    : (store.state.language === "ar" ? "انسخ برومبت التحليل يدويًا" : "Copy analysis prompt manually");
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(text);
    store.set({
      externalImport: {
        ...store.state.externalImport,
        tickerHint,
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
        tickerHint,
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
