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
  ["home", "Home"],
  ["workspace", "New Analysis"],
  ["research", "Research"],
  ["watchlist", "Watchlist"],
  ["settings", "Settings"]
];

export function mountApp(root, store) {
  const actions = createActions(store);
  store.subscribe(() => render(root, store, actions));
  render(root, store, actions);
}

function render(root, store, actions) {
  const { state } = store;
  setupArabicDocument(state.language);
  document.documentElement.dataset.theme = state.theme;
  if (state.activePanel === "home") {
    root.innerHTML = homeDashboard(state);
    bind(root, store, actions);
    return;
  }
  const isWorkflow = state.activePanel === "workspace";
  root.innerHTML = `
    <aside class="rail">
      <div class="brand">
        <div class="mark">V9</div>
        <div>
          <h1>${uiLabel("Institutional Research")}</h1>
          <p>${uiLabel("Equity research layer")}</p>
        </div>
      </div>
      <nav class="rail-nav">
        ${panels.map(([key, label]) => `<button class="${state.activePanel === key ? "active" : ""}" data-panel="${key}">${uiLabel(label)}</button>`).join("")}
      </nav>
      <div class="rail-card">
        <span>${escapeHtml(state.company.ticker)}</span>
        <strong>${money(state.company.quote?.price, 2)}</strong>
        <p>${escapeHtml(state.company.name)}</p>
      </div>
    </aside>
    <main class="workspace">
      ${topBar(state)}
      ${isWorkflow ? "" : searchBlock(state)}
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      ${isWorkflow ? "" : executiveSummary(state)}
      ${panelContent(state)}
    </main>
    <nav class="mobile-nav">
      ${panels.filter(([key]) => ["home", "workspace", "summary", "research", "settings"].includes(key)).map(([key, label]) => `<button class="${state.activePanel === key ? "active" : ""}" data-panel="${key}">${uiLabel(label)}</button>`).join("")}
    </nav>
  `;
  bind(root, store, actions);
}

function homeDashboard(state) {
  return `
    <main class="home-workspace polished-home product-home">
      <header class="home-topbar home-hero-polish product-hero">
        <div class="home-brand-line">
          <img class="app-logo" src="./assets/icon-192.png" alt="">
          <div>
            <p class="eyebrow">${uiLabel("Version 10.0.0")}</p>
            <h1>${uiLabel("Franklin Research")}</h1>
            <small>${uiLabel("AI Equity Research Platform")}</small>
          </div>
        </div>
        <div class="home-actions">
          ${languageToggle(state)}
          <button class="primary-btn" data-action="new-analysis">${uiLabel("New Analysis")}</button>
          <button class="icon-btn" data-action="toggle-theme" title="${uiLabel("Toggle theme")}">${state.theme === "dark" ? uiLabel("Light") : uiLabel("Dark")}</button>
        </div>
      </header>
      ${homePolishedSearch(state)}
      ${homeQuickActions(state)}
      <section class="home-polished-grid">
        ${homeRecentAnalysesSection(state)}
        ${homeWatchlistPanel(state)}
      </section>
    </main>
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
    <section class="home-search home-search-premium">
      <div class="search-signature">
        <span>${uiLabel("Ask the one question")}</span>
        <strong>${uiLabel("Should I buy this stock today?")}</strong>
      </div>
      <div class="search-line">
        <input id="searchInput" value="${escapeHtml(state.query)}" placeholder="${uiLabel("Search by company name or ticker")}" autocomplete="off">
        <button class="primary-btn" data-action="search">${state.loading ? uiLabel("Searching") : uiLabel("Search")}</button>
      </div>
      <div class="home-search-footer">
        <div class="quick-tickers" aria-label="${uiLabel("Common examples")}">
          ${["AAPL", "MSFT", "NVDA", "AMZN"].map((ticker) => `<button data-sample-query="${ticker}">${ticker}</button>`).join("")}
        </div>
        <button class="icon-btn" data-action="load-demo-analysis">${uiLabel("Load Demo Data")}</button>
      </div>
      ${state.notice ? `<p class="home-note">${escapeHtml(state.notice)}</p>` : ""}
      ${state.searchResults.length ? `<div class="results home-results">
        <p>${uiLabel("Search Results")}</p>
        ${state.searchResults.map(searchResult).join("")}
      </div>` : ""}
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
      <strong>${escapeHtml(String(value || "—"))}</strong>
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

function topBar(state) {
  return `
    <header class="topbar compact product-topbar">
      <div>
        <p class="eyebrow">${uiLabel("Version 10.0.0")}</p>
        <h2>${escapeHtml(state.company.name)}</h2>
      </div>
      <div class="top-actions">
        ${languageToggle(state)}
        <button class="icon-btn" data-panel="home">${uiLabel("Home")}</button>
        <button class="icon-btn" data-action="toggle-theme" title="${uiLabel("Toggle theme")}">${state.theme === "dark" ? uiLabel("Light") : uiLabel("Dark")}</button>
        <button class="icon-btn" data-panel="settings">${uiLabel("Settings")}</button>
      </div>
    </header>
  `;
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
  const r = state.research;
  if (state.activePanel === "workspace") return valuationWorkspacePanel(state);
  if (state.activePanel === "valuation") return valuationPanel(r, state.company);
  if (state.activePanel === "quality") return enginePanel(uiLabel("Quality Engine"), r.quality);
  if (state.activePanel === "growth") return enginePanel(uiLabel("Growth Engine"), r.growth);
  if (state.activePanel === "moat") return businessPanel(r);
  if (state.activePanel === "risk") return riskPanel(r);
  if (state.activePanel === "research") return institutionalResearchPanel(state);
  if (state.activePanel === "watchlist") return watchListPanel(state);
  if (state.activePanel === "settings") return settingsPanel(state);
  if (state.activePanel === "history") return historyPanel(state);
  return summaryPanel(r);
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
  return `
    <section class="panel settings-panel">
      <h3>${uiLabel("Settings")}</h3>
      <div class="settings-grid">
        <div class="settings-status">
          <span>${uiLabel("Private Server")}</span>
          <strong>${uiLabel("API keys are configured on the private server only.")}</strong>
        </div>
        <label>${uiLabel("Average cost")}<input data-manual="averageCost" value="${escapeHtml(state.manualInputs.averageCost)}" inputmode="decimal" placeholder="اختياري"></label>
        <label>${uiLabel("Morningstar FV")}<input data-manual="morningstarFairValue" value="${escapeHtml(state.manualInputs.morningstarFairValue)}" inputmode="decimal" placeholder="اختياري"></label>
      </div>
      <label class="notes-field">${uiLabel("Research notes")}<textarea data-manual="notes" placeholder="ملاحظات اختيارية للفرضية">${escapeHtml(state.manualInputs.notes)}</textarea></label>
      <button class="icon-btn danger-action" data-action="clear-local-data">${uiLabel("Clear Local Data")}</button>
      <div class="settings-note">
        ${analysisText("API keys are stored only as server-side environment variables. Draft pasted data is not persisted automatically. Approved reports and saved watchlist items remain local until cleared.")}
      </div>
    </section>
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
  root.querySelector("[data-action='save-run']")?.addEventListener("click", store.saveRun);
  root.querySelectorAll("[data-action='new-analysis']").forEach((button) => {
    button.addEventListener("click", store.startBlankAnalysis);
  });
  root.querySelectorAll("[data-action='load-demo-analysis']").forEach((button) => {
    button.addEventListener("click", store.loadDemoAnalysis);
  });
  root.querySelector("[data-action='clear-analysis-paste']")?.addEventListener("click", store.clearAnalystPaste);
  root.querySelector("[data-action='search']")?.addEventListener("click", actions.search);
  root.querySelector("#searchInput")?.addEventListener("input", (event) => {
    store.state.query = event.target.value;
  });
  root.querySelector("#searchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") actions.search();
  });
  root.querySelectorAll("[data-sample-query]").forEach((button) => {
    button.addEventListener("click", () => {
      store.set({ query: button.dataset.sampleQuery });
      actions.search();
    });
  });
  root.querySelector("[data-action='clear-local-data']")?.addEventListener("click", store.clearLocalData);
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}
