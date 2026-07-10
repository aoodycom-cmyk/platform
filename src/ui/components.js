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

const panels = [
  ["home", "Home"],
  ["summary", "Executive"],
  ["valuation", "Valuation"],
  ["quality", "Quality"],
  ["growth", "Growth"],
  ["moat", "Moat"],
  ["risk", "Risk"],
  ["research", "Research"],
  ["watchlist", "Watchlist"],
  ["settings", "Settings"],
  ["history", "History"]
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
  root.innerHTML = `
    <aside class="rail">
      <div class="brand">
        <div class="mark">V5.1</div>
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
      ${searchBlock(state)}
      ${state.notice ? `<div class="notice">${escapeHtml(state.notice)}</div>` : ""}
      ${executiveSummary(state)}
      ${panelContent(state)}
    </main>
    <nav class="mobile-nav">
      ${panels.filter(([key]) => ["home", "summary", "research", "risk", "settings"].includes(key)).map(([key, label]) => `<button class="${state.activePanel === key ? "active" : ""}" data-panel="${key}">${uiLabel(label)}</button>`).join("")}
    </nav>
  `;
  bind(root, store, actions);
}

function homeDashboard(state) {
  return `
    <main class="home-workspace">
      <header class="home-topbar">
        <div>
          <p class="eyebrow">${uiLabel("Version 6")}</p>
          <h1>${uiLabel("AI Equity Research Platform")}</h1>
        </div>
        <div class="home-actions">
          ${languageToggle(state)}
          <button class="icon-btn" data-action="toggle-theme" title="${uiLabel("Toggle theme")}">${state.theme === "dark" ? uiLabel("Light") : uiLabel("Dark")}</button>
        </div>
      </header>
      ${homeSearchBlock(state)}
      ${evaluatedCompaniesTable(state)}
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

function homeSearchBlock(state) {
  return `
    <section class="home-search">
      <div class="search-line">
        <input id="searchInput" value="${escapeHtml(state.query)}" placeholder="${uiLabel("Search by company name or ticker")}" autocomplete="off">
        <button class="primary-btn" data-action="search">${state.loading ? uiLabel("Searching") : uiLabel("Search")}</button>
      </div>
      ${state.notice ? `<p class="home-note">${escapeHtml(state.notice)}</p>` : ""}
      ${state.searchResults.length ? `<div class="results home-results">
        <p>${uiLabel("Search Results")}</p>
        ${state.searchResults.map(searchResult).join("")}
      </div>` : ""}
    </section>
  `;
}

function topBar(state) {
  return `
    <header class="topbar compact">
      <div>
        <p class="eyebrow">${uiLabel("Version 6")}</p>
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
      <small>${escapeHtml(company.exchange || company.sector || uiLabel("Market"))}</small>
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
    ["recommendation", uiLabel("Recommendation"), "text"]
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
      <td>${recommendationBadge(item)}</td>
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
        <label>${uiLabel("FMP API key")}<input type="password" data-key="fmp" value="${escapeHtml(state.apiKeys.fmp)}" placeholder="بيانات السوق"></label>
        <label>${uiLabel("OpenAI key")}<input type="password" data-key="openai" value="${escapeHtml(state.apiKeys.openai)}" placeholder="للشرح فقط"></label>
        <label>${uiLabel("Average cost")}<input data-manual="averageCost" value="${escapeHtml(state.manualInputs.averageCost)}" inputmode="decimal" placeholder="اختياري"></label>
        <label>${uiLabel("Morningstar FV")}<input data-manual="morningstarFairValue" value="${escapeHtml(state.manualInputs.morningstarFairValue)}" inputmode="decimal" placeholder="اختياري"></label>
      </div>
      <label class="notes-field">${uiLabel("Research notes")}<textarea data-manual="notes" placeholder="ملاحظات اختيارية للفرضية">${escapeHtml(state.manualInputs.notes)}</textarea></label>
      <div class="settings-note">
        ${analysisText("API keys stay in this browser session. Financial calculations are deterministic; AI is reserved for explanation and challenge only.")}
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
  root.querySelector("[data-action='search']")?.addEventListener("click", actions.search);
  root.querySelector("#searchInput")?.addEventListener("input", (event) => store.set({ query: event.target.value }));
  root.querySelector("#searchInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") actions.search();
  });
  root.querySelectorAll("[data-key]").forEach((input) => {
    input.addEventListener("input", () => store.setApiKey(input.dataset.key, input.value));
  });
  root.querySelectorAll("[data-manual]").forEach((input) => {
    input.addEventListener("input", () => store.setManualInput(input.dataset.manual, input.value));
  });
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
      const existing = store.state.evaluatedCompanies.find((item) => item.ticker.toLowerCase() === clean.toLowerCase());
      if (existing) {
        store.openEvaluatedCompany(existing.ticker);
        return;
      }
      store.set({ loading: true, notice: store.state.language === "ar" ? "جاري البحث في السوق..." : "Searching market universe..." });
      try {
        const results = await searchCompanies(store.state.query, store.state.apiKeys);
        const noKeyHint = store.state.apiKeys.fmp
          ? ""
          : store.state.language === "ar"
            ? " أضف مفتاح FMP من الإعدادات لتحميل القوائم المالية الحية."
            : " Add an FMP key in Settings for live financial statements.";
        const notice = results.length
          ? (store.state.language === "ar" ? `اختر شركة لتشغيل التقييم.${noKeyHint}` : `Select a company to run the evaluation.${noKeyHint}`)
          : (store.state.language === "ar" ? `لم يتم العثور على شركات.${noKeyHint}` : `No companies found.${noKeyHint}`);
        store.set({ searchResults: results, loading: false, notice });
      } catch {
        store.set({ loading: false, notice: analysisText("Search failed. Check the market data key in Settings.") });
      }
    },
    async loadCompany(ticker) {
      const existing = store.state.evaluatedCompanies.find((item) => item.ticker === ticker);
      if (existing) {
        store.openEvaluatedCompany(ticker);
        return;
      }
      store.set({ loading: true, notice: store.state.language === "ar" ? `جاري تحليل ${ticker}...` : `Analyzing ${ticker}...` });
      try {
        const company = await fetchResearchData(ticker, store.state.apiKeys, store.state.manualInputs, store.state.company);
        store.setCompany(company);
      } catch {
        store.set({ loading: false, notice: analysisText("Could not load live data. Check the market data key in Settings.") });
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
