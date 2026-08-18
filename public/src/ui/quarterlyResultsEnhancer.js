import { buildQuarterlyEarningsDigestIndex } from "../externalAnalysis/quarterlyEarningsDigest.js";

const SECTION_CLASS = "quarterly-results-overview";

function isArabicUi() {
  return document.documentElement.dir === "rtl" || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function enhanceQuarterlyResults() {
  const shell = document.querySelector(".quarterly-scorecard-shell[data-scorecard-ticker]");
  const store = window.__equityResearchStore;
  if (!shell || !store?.state) return;

  const existing = shell.querySelector(`.${SECTION_CLASS}`);
  if (existing) {
    keepResultsBeforeOutlook(shell, existing);
    return;
  }

  const ticker = String(shell.dataset.scorecardTicker || "").trim().toUpperCase();
  const year = Number(shell.dataset.scorecardYear);
  const reports = store.state.externalAnalyses?.[ticker] || [];
  const digestByQuarter = buildQuarterlyEarningsDigestIndex(reports, year);
  const quarters = [1, 2, 3, 4]
    .map((quarter) => ({ quarter, digest: digestByQuarter[quarter] || null }))
    .filter((item) => item.digest);
  if (!quarters.length) return;

  ensureStyles();
  const section = document.createElement("section");
  section.className = `panel ${SECTION_CLASS}`;
  section.innerHTML = `
    <header class="quarterly-results-head">
      <div>
        <span>Quarter Results</span>
        <h3>${isArabicUi() ? "نتائج الأرباع" : "Quarterly results"}</h3>
        <p>${isArabicUi() ? "ما حدث فعليًا في كل ربع، مستقلًا عن القيمة العادلة والتوصية." : "What actually happened each quarter, separate from fair value and the core recommendation."}</p>
      </div>
    </header>
    <div class="quarterly-results-grid">
      ${quarters.map(({ quarter, digest }) => resultCard(quarter, digest)).join("")}
    </div>
  `;

  const outlook = shell.querySelector(".quarterly-forward-outlook");
  const annual = shell.querySelector(".quarterly-annual-summary");
  if (outlook) outlook.insertAdjacentElement("beforebegin", section);
  else if (annual) annual.insertAdjacentElement("afterend", section);
  else shell.prepend(section);
}

function keepResultsBeforeOutlook(shell, section) {
  const outlook = shell.querySelector(".quarterly-forward-outlook");
  if (outlook && section.nextElementSibling !== outlook) section.insertAdjacentElement("afterend", outlook);
}

function resultCard(quarter, digest = {}) {
  const metrics = selectMetrics(digest.metrics || {});
  const kpis = (digest.companyKpis || []).slice(0, 2);
  const highlight = digest.highlights?.[0] || null;
  const concern = digest.concerns?.[0] || null;
  return `
    <article class="quarterly-result-card">
      <header>
        <strong dir="ltr">Q${quarter}</strong>
        ${digest.reportDate ? `<span dir="ltr">${escapeHtml(digest.reportDate)}</span>` : ""}
      </header>
      ${digest.summary ? `<p class="quarterly-result-summary">${escapeHtml(digest.summary)}</p>` : ""}
      <div class="quarterly-result-metrics">
        ${metrics.map(metricRow).join("")}
      </div>
      ${kpis.length ? `<div class="quarterly-result-kpis">${kpis.map(kpiRow).join("")}</div>` : ""}
      ${(highlight || concern) ? `
        <div class="quarterly-result-signals">
          ${highlight ? `<p class="positive"><span>+</span>${escapeHtml(highlight)}</p>` : ""}
          ${concern ? `<p class="negative"><span>−</span>${escapeHtml(concern)}</p>` : ""}
        </div>
      ` : ""}
    </article>
  `;
}

function selectMetrics(metrics = {}) {
  const candidates = [
    [isArabicUi() ? "الإيرادات" : "Revenue", metrics.revenue],
    [isArabicUi() ? "نمو الإيرادات" : "Revenue growth", metrics.revenueGrowthPct],
    ["EPS", metrics.eps],
    [isArabicUi() ? "الهامش التشغيلي" : "Operating margin", metrics.operatingMarginPct],
    [isArabicUi() ? "الهامش الإجمالي" : "Gross margin", metrics.grossMarginPct],
    ["FCF", metrics.freeCashFlow]
  ];
  const result = [];
  for (const [label, metric] of candidates) {
    if (!hasMetric(metric)) continue;
    if ((label === (isArabicUi() ? "الهامش الإجمالي" : "Gross margin")) && result.some((item) => item.label === (isArabicUi() ? "الهامش التشغيلي" : "Operating margin"))) continue;
    result.push({ label, metric });
    if (result.length === 5) break;
  }
  return result;
}

function metricRow({ label, metric }) {
  const result = String(metric.result || "NA").toUpperCase();
  const actual = metric.display || (Number.isFinite(metric.value) ? String(metric.value) : "—");
  const expected = metric.consensusDisplay;
  return `
    <div class="quarterly-result-metric ${result.toLowerCase()}">
      <span>${escapeHtml(label)}</span>
      <div>
        <strong dir="ltr">${escapeHtml(actual)}</strong>
        ${result !== "NA" ? `<em>${escapeHtml(resultLabel(result))}</em>` : ""}
        ${expected ? `<small>${isArabicUi() ? "متوقع" : "Est."} <bdi>${escapeHtml(expected)}</bdi></small>` : ""}
      </div>
    </div>
  `;
}

function kpiRow(kpi = {}) {
  const result = String(kpi.result || "NA").toUpperCase();
  return `
    <div class="quarterly-result-kpi ${result.toLowerCase()}">
      <span>${escapeHtml(kpi.name || "KPI")}</span>
      <strong dir="ltr">${escapeHtml(kpi.actualDisplay || "—")}</strong>
    </div>
  `;
}

function resultLabel(value) {
  if (value === "BEAT") return isArabicUi() ? "أفضل" : "Beat";
  if (value === "MISS") return isArabicUi() ? "أقل" : "Miss";
  if (value === "INLINE") return isArabicUi() ? "متوافق" : "Inline";
  return "";
}

function hasMetric(metric) {
  return Boolean(metric && (metric.display || Number.isFinite(metric.value)));
}

function ensureStyles() {
  if (document.getElementById("quarterly-results-overview-styles")) return;
  const style = document.createElement("style");
  style.id = "quarterly-results-overview-styles";
  style.textContent = `
    .quarterly-results-overview { margin-block: 14px; overflow: hidden; }
    .quarterly-results-head { margin-bottom: 14px; }
    .quarterly-results-head span { font-size: 12px; opacity: .65; letter-spacing: .04em; }
    .quarterly-results-head h3 { margin: 3px 0 5px; font-size: 18px; }
    .quarterly-results-head p { margin: 0; max-width: 760px; opacity: .72; font-size: 13px; line-height: 1.65; }
    .quarterly-results-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; direction: ltr; }
    .quarterly-result-card { direction: rtl; min-width: 0; padding: 14px; border: 1px solid rgba(148,163,184,.18); border-radius: 16px; background: rgba(15,23,42,.34); }
    html[dir="ltr"] .quarterly-result-card { direction: ltr; }
    .quarterly-result-card > header { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px; }
    .quarterly-result-card > header strong { font-size: 16px; }
    .quarterly-result-card > header span { font-size: 11px; opacity: .55; }
    .quarterly-result-summary { margin: 0 0 11px; font-size: 12px; line-height: 1.6; opacity: .82; }
    .quarterly-result-metrics { display: grid; gap: 2px; }
    .quarterly-result-metric { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid rgba(148,163,184,.11); }
    .quarterly-result-metric > span { font-size: 11px; opacity: .62; }
    .quarterly-result-metric > div { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px 6px; text-align: end; }
    .quarterly-result-metric strong { font-size: 12px; }
    .quarterly-result-metric em { padding: 2px 6px; border-radius: 999px; font-size: 9px; font-style: normal; background: rgba(148,163,184,.12); }
    .quarterly-result-metric.beat em { background: rgba(34,197,94,.12); color: #86efac; }
    .quarterly-result-metric.miss em { background: rgba(239,68,68,.12); color: #fca5a5; }
    .quarterly-result-metric small { flex-basis: 100%; font-size: 9px; opacity: .48; }
    .quarterly-result-kpis { display: grid; gap: 6px; margin-top: 8px; }
    .quarterly-result-kpi { display: flex; justify-content: space-between; gap: 8px; padding: 7px 9px; border-radius: 10px; background: rgba(148,163,184,.07); }
    .quarterly-result-kpi span, .quarterly-result-kpi strong { font-size: 10px; }
    .quarterly-result-signals { display: grid; gap: 5px; margin-top: 10px; }
    .quarterly-result-signals p { display: flex; align-items: flex-start; gap: 6px; margin: 0; font-size: 10px; line-height: 1.5; }
    .quarterly-result-signals p span { flex: 0 0 auto; font-weight: 800; }
    .quarterly-result-signals .positive { color: #86efac; }
    .quarterly-result-signals .negative { color: #fca5a5; }
    @media (max-width: 899px) {
      .quarterly-results-grid { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: minmax(260px, 86vw); overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: x proximity; padding-bottom: 4px; }
      .quarterly-result-card { scroll-snap-align: start; }
    }
  `;
  document.head.append(style);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let frame = 0;
function scheduleEnhancement() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhanceQuarterlyResults);
}

const app = document.getElementById("app");
if (app) new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
window.addEventListener("resize", scheduleEnhancement, { passive: true });
scheduleEnhancement();
