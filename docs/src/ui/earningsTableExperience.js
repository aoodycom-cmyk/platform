import { buildQuarterlyScorecard } from "../externalAnalysis/quarterlyScorecard.js";

export const EARNINGS_TABLE_EXPERIENCE_VERSION = "v57";

const MOBILE_MAX_WIDTH = 899;
const STYLESHEET_ID = "franklin-earnings-table-v57";
const STYLESHEET_URL = "./styles-earnings-compact-v56.css?v=v57-earnings-clean";
const HUB_SELECTOR = ".franklin-earnings-hub";
const ACTIVE_CLASS = "franklin-quarterly-earnings-active";
const VIEW_STATES = new Map();
const BEAT_STATUSES = new Set(["EXCEEDED", "PASSED"]);

let frame = 0;
let stylesheetReady = false;

function isArabicUi() {
  if (typeof document === "undefined") return true;
  return document.documentElement.dir === "rtl"
    || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function currentStore() {
  return typeof window === "undefined" ? null : window.__equityResearchStore || null;
}

function scheduleEnhancement() {
  if (typeof window === "undefined") return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhanceQuarterlyEarningsExperience);
}

function enhanceQuarterlyEarningsExperience() {
  if (!stylesheetReady || typeof document === "undefined") return;
  const shell = document.querySelector(".quarterly-scorecard-shell");
  if (!shell || window.innerWidth > MOBILE_MAX_WIDTH) {
    removeMobileEnhancement(shell);
    return;
  }

  const store = currentStore();
  const state = store?.state;
  if (!state) return;

  const selection = state.quarterlyScorecard || {};
  const ticker = String(shell.dataset.scorecardTicker || selection.ticker || "").trim().toUpperCase();
  const year = Number(shell.dataset.scorecardYear || selection.year) || null;
  if (!ticker) return;

  const scorecard = buildQuarterlyScorecard({
    historicalRequirementSets: state.historicalRequirementSets,
    externalAnalyses: state.externalAnalyses,
    ticker,
    year
  });
  const model = buildQuarterlyEarningsViewModel(scorecard);
  const viewKey = `${model.ticker || ticker}:${model.year || year || "latest"}`;
  const remembered = VIEW_STATES.get(viewKey) || {};
  const selectedQuarter = model.quarters.some((quarter) => quarter.quarter === Number(remembered.selectedQuarter))
    ? Number(remembered.selectedQuarter)
    : model.defaultQuarter;
  const activeTab = remembered.activeTab === "summary" ? "summary" : "earnings";
  VIEW_STATES.set(viewKey, { selectedQuarter, activeTab });

  shell.dataset.earningsTableEnhanced = "true";
  document.documentElement.classList.add(ACTIVE_CLASS);

  let host = shell.querySelector(HUB_SELECTOR);
  if (!host) {
    host = document.createElement("section");
    host.className = "franklin-earnings-hub";
    const timeline = shell.querySelector(":scope > .quarterly-earnings-timeline");
    const header = shell.querySelector(":scope > .quarterly-scorecard-header");
    if (timeline) timeline.insertAdjacentElement("afterend", host);
    else if (header) header.insertAdjacentElement("afterend", host);
    else shell.prepend(host);
  }

  const signature = JSON.stringify({
    language: isArabicUi() ? "ar" : "en",
    activeTab,
    selectedQuarter,
    model
  });
  if (host.dataset.renderSignature === signature) return;
  host.dataset.renderSignature = signature;
  host.innerHTML = renderExperience(model, selectedQuarter, activeTab);
  bindExperience(host, viewKey);
  revealSelectedQuarter(host);
}

export function buildQuarterlyEarningsViewModel(scorecard = {}) {
  const rawRows = Array.isArray(scorecard.rows) ? scorecard.rows : [];
  const rawQuarters = Array.isArray(scorecard.quarters) ? scorecard.quarters : [];
  const latestReportedQuarter = numberOrNull(scorecard.latestReportedQuarter);
  const quarters = rawQuarters
    .map((quarter) => {
      const quarterNumber = Number(quarter?.quarter);
      const rows = rawRows
        .map((row) => ({
          key: row?.key || "",
          label: row?.label || "",
          secondaryLabel: row?.secondaryLabel || "",
          cell: row?.cells?.[quarterNumber] || null
        }))
        .filter((row) => row.cell);
      const counts = statusCounts(rows);
      const hasData = Boolean(
        rows.length
        || quarter?.evaluated
        || quarter?.lifecycleStatus
        || quarter?.outlook
        || Number.isFinite(Number(quarter?.targetValue))
      );
      return {
        quarter: quarterNumber,
        label: quarter?.label || `Q${quarterNumber}`,
        evaluated: Boolean(quarter?.evaluated),
        lifecycleStatus: quarter?.lifecycleStatus || null,
        weightedAchievement: numberOrNull(quarter?.weightedAchievement),
        overallStatus: quarter?.overallStatus || null,
        summary: textOrNull(quarter?.summary),
        targetValue: numberOrNull(quarter?.targetValue),
        targetScenario: textOrNull(quarter?.targetScenario),
        outlook: quarter?.outlook || null,
        rows,
        counts,
        hasData
      };
    })
    .filter((quarter) => Number.isFinite(quarter.quarter) && quarter.hasData)
    .sort((left, right) => right.quarter - left.quarter);

  const upcomingQuarter = resolveUpcomingQuarter(quarters, latestReportedQuarter);
  quarters.forEach((quarter) => {
    quarter.phase = quarterPhase(quarter, latestReportedQuarter, upcomingQuarter);
    quarter.tone = quarterTone(quarter);
  });

  return {
    ticker: scorecard.ticker || "",
    companyName: scorecard.companyName || scorecard.ticker || "",
    year: numberOrNull(scorecard.year),
    latestReportedQuarter,
    reportedQuarterCount: numberOrNull(scorecard.reportedQuarterCount) || 0,
    trajectory: scorecard.trajectory || null,
    overallStatus: scorecard.overallStatus || null,
    target: scorecard.target || null,
    fairValue: scorecard.fairValue || null,
    quarters,
    defaultQuarter: defaultQuarter(quarters)
  };
}

function resolveUpcomingQuarter(quarters = [], latestReportedQuarter = null) {
  const candidates = quarters.filter((quarter) => !quarter.evaluated && quarter.rows.length);
  if (!candidates.length) return null;
  if (Number.isFinite(latestReportedQuarter)) {
    return [...candidates]
      .filter((quarter) => quarter.quarter > latestReportedQuarter)
      .sort((left, right) => left.quarter - right.quarter)[0]?.quarter || null;
  }
  return [...candidates].sort((left, right) => right.quarter - left.quarter)[0]?.quarter || null;
}

function quarterPhase(quarter = {}, latestReportedQuarter = null, upcomingQuarter = null) {
  if (quarter.evaluated) return "reported";
  if (quarter.quarter === upcomingQuarter) return "upcoming";
  if (Number.isFinite(upcomingQuarter) && quarter.quarter > upcomingQuarter) return "future";
  if (Number.isFinite(latestReportedQuarter) && quarter.quarter > latestReportedQuarter) return "future";
  return "missing";
}

function defaultQuarter(quarters = []) {
  if (!quarters.length) return null;
  return quarters.find((quarter) => quarter.phase === "upcoming")?.quarter
    || quarters.find((quarter) => quarter.phase === "reported")?.quarter
    || quarters[0].quarter;
}

function statusCounts(rows = []) {
  return rows.reduce((counts, row) => {
    const status = normalizedStatus(row?.cell?.status);
    const reported = Boolean(row?.cell?.reported);
    counts.total += 1;
    if (BEAT_STATUSES.has(status)) counts.beat += 1;
    else if (status === "FAILED") counts.miss += 1;
    else if (status === "PARTIALLY_PASSED") counts.mixed += 1;
    else if (reported) counts.observed += 1;
    else counts.pending += 1;
    if (reported) counts.reported += 1;
    return counts;
  }, { total: 0, reported: 0, beat: 0, miss: 0, mixed: 0, observed: 0, pending: 0 });
}

function quarterTone(quarter = {}) {
  if (quarter.phase !== "reported") return quarter.phase || "missing";
  if (quarter.counts.miss > 0 && quarter.counts.beat === 0 && quarter.counts.mixed === 0) return "miss";
  if (quarter.counts.miss > 0 || quarter.counts.mixed > 0) return "mixed";
  if (quarter.counts.beat > 0) return "beat";
  return "neutral";
}

function renderExperience(model, selectedQuarter, activeTab) {
  const quarter = model.quarters.find((item) => item.quarter === Number(selectedQuarter)) || model.quarters[0] || null;
  if (!quarter) return emptyExperience(model);
  const ar = isArabicUi();
  return `
    <nav class="fet-section-tabs" role="tablist" aria-label="${escapeHtml(ar ? "أقسام متابعة الأرباح" : "Earnings sections")}">
      <button type="button" role="tab" data-fet-tab="summary" aria-selected="${activeTab === "summary"}" class="${activeTab === "summary" ? "active" : ""}">${escapeHtml(ar ? "الملخص" : "Summary")}</button>
      <button type="button" role="tab" data-fet-tab="earnings" aria-selected="${activeTab === "earnings"}" class="${activeTab === "earnings" ? "active" : ""}">${escapeHtml(ar ? "الأرباح" : "Earnings")}</button>
    </nav>
    <div class="fet-quarter-rail" role="list" aria-label="${escapeHtml(ar ? "اختيار الربع" : "Select quarter")}">
      ${model.quarters.map((item) => quarterButton(item, model.year, item.quarter === quarter.quarter)).join("")}
    </div>
    <div class="fet-tab-panel" role="tabpanel">
      ${activeTab === "summary" ? renderSummary(model, quarter) : renderEarningsPanel(model, quarter)}
    </div>
  `;
}

function quarterButton(quarter, year, selected) {
  return `
    <button type="button" role="listitem" data-fet-quarter="${quarter.quarter}" class="fet-quarter-pill tone-${quarter.tone} ${selected ? "active" : ""}" aria-pressed="${selected}">
      <strong dir="ltr">${escapeHtml(`${quarter.label} ${year || ""}`.trim())}</strong>
      <span>${escapeHtml(quarterPillMeta(quarter))}</span>
    </button>
  `;
}

function quarterPillMeta(quarter = {}) {
  const ar = isArabicUi();
  if (quarter.phase === "upcoming") return ar ? "بانتظار الإعلان" : "Awaiting report";
  if (quarter.phase === "future") return ar ? "هدف مستقبلي" : "Future target";
  if (quarter.phase === "missing") return ar ? "لا توجد نتيجة" : "No saved result";
  const achievement = Number.isFinite(quarter.weightedAchievement)
    ? `${formatNumber(quarter.weightedAchievement, 1)}%`
    : "";
  if (quarter.tone === "beat") return `Beat${achievement ? ` ${achievement}` : ""}`;
  if (quarter.tone === "miss") return `Miss${achievement ? ` ${achievement}` : ""}`;
  if (quarter.tone === "mixed") return `${ar ? "مختلط" : "Mixed"}${achievement ? ` ${achievement}` : ""}`;
  return achievement || (ar ? "تم الإعلان" : "Reported");
}

function renderEarningsPanel(model, quarter) {
  const ar = isArabicUi();
  const reported = quarter.phase === "reported";
  const countText = requirementCountLabel(quarter.counts.total);
  const context = reported
    ? (ar ? `${countText} مقابل متطلبات Bull المحفوظة` : `${countText} versus saved Bull requirements`)
    : unreportedContext(quarter, countText);
  return `
    <article class="fet-quarter-card tone-${quarter.tone}">
      <header class="fet-quarter-card-head">
        <div>
          <span>${escapeHtml(quarterPhaseLabel(quarter.phase))}</span>
          <h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3>
        </div>
        <b class="fet-state-badge">${escapeHtml(quarterStateLabel(quarter))}</b>
      </header>
      <p class="fet-quarter-context">${escapeHtml(context)}</p>
      ${quarter.rows.length ? earningsTable(quarter, reported) : emptyQuarterRows(quarter.phase)}
      ${quarterHighlights(quarter)}
    </article>
  `;
}

function unreportedContext(quarter, countText) {
  const ar = isArabicUi();
  if (quarter.phase === "upcoming") return ar
    ? `${countText} محفوظة للوصول إلى Bull — دون إضافة توقعات غير موجودة.`
    : `${countText} saved for the Bull case — no invented forecasts.`;
  if (quarter.phase === "future") return ar
    ? `${countText} محفوظة كهدف مستقبلي.`
    : `${countText} saved as a future target.`;
  return ar
    ? `${countText} محفوظة، لكن لا توجد نتيجة فعلية محفوظة لهذا الربع.`
    : `${countText} are saved, but no actual result is stored for this quarter.`;
}

function earningsTable(quarter, reported) {
  const ar = isArabicUi();
  const columns = reported ? "reported" : "target";
  return `
    <div class="fet-table-wrap" role="region" aria-label="${escapeHtml(ar ? "جدول الأرباح" : "Earnings table")}">
      <table class="fet-table fet-table-${columns}">
        <colgroup>${reported ? "<col><col><col>" : "<col><col>"}</colgroup>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(ar ? "المقياس" : "Metric")}</th>
            <th scope="col">${escapeHtml(reported ? (ar ? "المطلوب" : "Required") : (ar ? "Bull" : "Bull target"))}</th>
            ${reported ? `<th scope="col">${escapeHtml(ar ? "الفعلي" : "Actual")}</th>` : ""}
          </tr>
        </thead>
        <tbody>${quarter.rows.map((row) => earningsRow(row, reported)).join("")}</tbody>
      </table>
    </div>
  `;
}

function earningsRow(row, reported) {
  const cell = row.cell || {};
  const status = normalizedStatus(cell.status);
  const tone = resultTone(status, cell.reported);
  const fullMetric = [row.label, row.secondaryLabel].filter(Boolean).join(" — ");
  const required = compactRequirementDisplay(cell);
  const actual = cell.reported ? compactActualDisplay(cell) : "—";
  return `
    <tr class="tone-${tone}">
      <th scope="row" title="${escapeHtml(fullMetric)}">
        <strong dir="auto">${escapeHtml(row.label || row.secondaryLabel || "—")}</strong>
      </th>
      <td title="${escapeHtml(textOrNull(cell.requiredDisplay) || required)}"><bdi dir="ltr">${escapeHtml(required)}</bdi></td>
      ${reported ? `<td class="fet-actual-cell tone-${tone}" title="${escapeHtml(textOrNull(cell.actualDisplay) || actual)}">${actualMarkup(cell)}</td>` : ""}
    </tr>
  `;
}

function actualMarkup(cell = {}) {
  const status = normalizedStatus(cell.status);
  const tone = resultTone(status, cell.reported);
  const actual = compactActualDisplay(cell);
  const label = resultLabel(status, cell.reported, cell.observation);
  const variance = favorableVariancePercent(cell);
  return `
    <strong class="fet-actual tone-${tone}" dir="ltr">${escapeHtml(actual)}</strong>
    <small class="fet-result tone-${tone}">${escapeHtml(label)}${Number.isFinite(variance) ? ` <bdi dir="ltr">${escapeHtml(formatSignedPercent(variance))}</bdi>` : ""}</small>
  `;
}

export function compactRequirementDisplay(cell = {}) {
  const display = textOrNull(cell.requiredDisplay);
  const number = numberOrNull(cell.requiredValue);
  if (!Number.isFinite(number)) return display || "—";
  const operator = thresholdOperator(cell.type, display);
  const compact = compactNumericValue(number, cell.unit, display);
  return `${operator}${operator ? " " : ""}${compact}`;
}

function compactActualDisplay(cell = {}) {
  const number = numberOrNull(cell.actualValue);
  const display = textOrNull(cell.actualDisplay)
    || (typeof cell.actualRaw === "string" ? textOrNull(cell.actualRaw) : null);
  if (!Number.isFinite(number)) return display || "—";
  return compactNumericValue(number, cell.unit, display);
}

function thresholdOperator(type, display) {
  const text = `${String(type || "")} ${String(display || "")}`.toLowerCase();
  if (/maximum|at most|or less|أو أقل|على الأكثر|عدم تجاوز/.test(text)) return "≤";
  if (/minimum|at least|or more|أو أكثر|على الأقل/.test(text)) return "≥";
  return "";
}

function compactNumericValue(value, unit, display) {
  const source = `${String(unit || "")} ${String(display || "")}`.toLowerCase();
  const absolute = Math.abs(value);
  const isUsd = /\$|usd|dollar|دولار/.test(source);
  const isShares = /share|سهم/.test(source);
  const saysBillion = /\bbn\b|billion|مليار/.test(source);
  const saysMillion = /\bmn\b|million|مليون/.test(source);
  const isPercent = /%|percent|percentage/.test(source) || String(unit || "").trim() === "%";

  if (isPercent) return `${formatNumber(value, 2)}%`;
  if (isUsd && (absolute >= 1e9 || saysBillion)) {
    const scaled = absolute >= 1e8 ? value / 1e9 : value;
    return `$${formatNumber(scaled, 2)}B`;
  }
  if (isUsd && (absolute >= 1e6 || saysMillion)) {
    const scaled = absolute >= 1e5 ? value / 1e6 : value;
    return `$${formatNumber(scaled, 2)}M`;
  }
  if (isShares && (absolute >= 1e9 || saysBillion)) {
    const scaled = absolute >= 1e8 ? value / 1e9 : value;
    return `${formatNumber(scaled, 2)}B ${isArabicUi() ? "سهم" : "shares"}`;
  }
  if (isShares && (absolute >= 1e6 || saysMillion)) {
    const scaled = absolute >= 1e5 ? value / 1e6 : value;
    return `${formatNumber(scaled, 2)}M ${isArabicUi() ? "سهم" : "shares"}`;
  }
  if (isUsd) return `$${formatNumber(value, 2)}`;
  const unitText = String(unit || "").trim();
  return `${formatNumber(value, 2)}${unitText ? ` ${unitText}` : ""}`;
}

function favorableVariancePercent(cell = {}) {
  const required = numberOrNull(cell.requiredValue);
  const actual = numberOrNull(cell.actualValue);
  if (!Number.isFinite(required) || !Number.isFinite(actual) || required === 0) return null;
  const type = String(cell.type || "").trim().toLowerCase();
  if (!type.includes("minimum") && !type.includes("maximum")) return null;
  const raw = ((actual - required) / Math.abs(required)) * 100;
  return type.includes("maximum") ? -raw : raw;
}

function renderSummary(model, quarter) {
  const ar = isArabicUi();
  const reported = quarter.phase === "reported";
  const achievement = Number.isFinite(quarter.weightedAchievement)
    ? `${formatNumber(quarter.weightedAchievement, 1)}%`
    : "—";
  const summaryText = quarter.summary
    || quarter.outlook?.summary
    || defaultSummaryText(quarter.phase);
  return `
    <article class="fet-summary-card tone-${quarter.tone}">
      <header>
        <div>
          <span>${escapeHtml(ar ? "ملخص الربع" : "Quarter summary")}</span>
          <h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3>
        </div>
        <b>${escapeHtml(quarterStateLabel(quarter))}</b>
      </header>
      <div class="fet-summary-hero">
        <strong dir="auto">${escapeHtml(reported ? achievement : quarterStateLabel(quarter))}</strong>
        <p>${escapeHtml(summaryText)}</p>
      </div>
      <div class="fet-summary-grid">
        ${summaryMetric(ar ? "المتطلبات" : "Requirements", quarter.counts.total, "neutral")}
        ${summaryMetric("Beat", quarter.counts.beat, "beat")}
        ${summaryMetric("Miss", quarter.counts.miss, "miss")}
        ${summaryMetric(ar ? "معلّق" : "Pending", quarter.counts.pending, "pending")}
      </div>
      ${outlookBlock(quarter.outlook)}
      ${quarterHighlights(quarter, true)}
    </article>
  `;
}

function defaultSummaryText(phase) {
  const ar = isArabicUi();
  if (phase === "upcoming") return ar
    ? "الربع القادم يعرض فقط متطلبات Bull المحفوظة في Franklin."
    : "The upcoming quarter shows only Bull requirements saved in Franklin.";
  if (phase === "future") return ar ? "هدف محفوظ لربع مستقبلي." : "Saved target for a future quarter.";
  if (phase === "missing") return ar ? "لا توجد نتيجة فعلية محفوظة لهذا الربع." : "No actual result is stored for this quarter.";
  return ar ? "لا يوجد ملخص إضافي محفوظ لهذا الربع." : "No additional saved summary is available for this quarter.";
}

function summaryMetric(label, value, tone) {
  return `<div class="fet-summary-metric tone-${tone}"><span>${escapeHtml(label)}</span><strong dir="ltr">${escapeHtml(String(value ?? 0))}</strong></div>`;
}

function outlookBlock(outlook) {
  if (!outlook) return "";
  const ar = isArabicUi();
  const items = [
    [ar ? "النمو" : "Growth", outlookValue("growth", outlook.growthOutlook)],
    [ar ? "الهوامش" : "Margins", outlookValue("margin", outlook.marginOutlook)],
    [ar ? "التوجيه" : "Guidance", outlookValue("guidance", outlook.guidanceTrend)],
    [ar ? "أثر الفرضية" : "Thesis impact", outlookValue("thesis", outlook.thesisImpact)]
  ].filter(([, value]) => value);
  if (!items.length) return "";
  return `
    <section class="fet-outlook-block">
      <h4>${escapeHtml(ar ? "النظرة بعد الإعلان" : "Post-earnings outlook")}</h4>
      <div>${items.map(([label, value]) => `<span><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></span>`).join("")}</div>
    </section>
  `;
}

function quarterHighlights(quarter, summaryMode = false) {
  const notes = uniqueText([
    summaryMode ? null : quarter.summary,
    summaryMode ? null : quarter.outlook?.summary,
    ...quarter.rows.map((row) => row.cell?.evaluationNote)
  ]);
  if (!notes.length) return "";
  return `
    <details class="fet-highlights" ${summaryMode ? "open" : ""}>
      <summary><span>${escapeHtml(isArabicUi() ? "أبرز الملاحظات" : "Highlights")}</span><b aria-hidden="true">⌄</b></summary>
      <div>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div>
    </details>
  `;
}

function emptyQuarterRows(phase) {
  const ar = isArabicUi();
  const note = phase === "reported"
    ? (ar ? "لا توجد مقاييس محفوظة لهذا الإعلان." : "No saved metrics for this report.")
    : (ar ? "لن يعرض Franklin أرقامًا غير موجودة." : "Franklin will not display invented figures.");
  return `<div class="fet-empty-quarter"><strong>${escapeHtml(ar ? "لا توجد متطلبات محفوظة لهذا الربع" : "No saved requirements for this quarter")}</strong><span>${escapeHtml(note)}</span></div>`;
}

function emptyExperience(model = {}) {
  const ar = isArabicUi();
  return `
    <article class="fet-empty-experience">
      <strong>${escapeHtml(ar ? "لا توجد أرباع متاحة بعد" : "No quarters are available yet")}</strong>
      <p>${escapeHtml(ar ? "أضف متطلبات الربع القادم أو استورد تحديث أرباح لعرض الجدول هنا." : "Add next-quarter requirements or import an earnings update to populate this table.")}</p>
      ${model.ticker ? `<span dir="ltr">${escapeHtml(model.ticker)}</span>` : ""}
    </article>
  `;
}

function requirementCountLabel(count) {
  if (!isArabicUi()) return `${count} ${count === 1 ? "requirement" : "requirements"}`;
  if (count === 1) return "متطلب واحد";
  if (count === 2) return "متطلبان";
  if (count >= 3 && count <= 10) return `${count} متطلبات`;
  return `${count} متطلبًا`;
}

function quarterPhaseLabel(phase) {
  const ar = isArabicUi();
  if (phase === "reported") return ar ? "ربع معلن" : "Reported quarter";
  if (phase === "upcoming") return ar ? "الربع القادم" : "Upcoming quarter";
  if (phase === "future") return ar ? "هدف مستقبلي" : "Future target";
  return ar ? "نتيجة غير محفوظة" : "No saved result";
}

function quarterStateLabel(quarter = {}) {
  if (quarter.phase === "upcoming") return isArabicUi() ? "بانتظار الإعلان" : "Awaiting report";
  if (quarter.phase === "future") return isArabicUi() ? "مستقبلي" : "Future";
  if (quarter.phase === "missing") return isArabicUi() ? "غير متوفر" : "Unavailable";
  if (quarter.tone === "beat") return "Beat";
  if (quarter.tone === "miss") return "Miss";
  if (quarter.tone === "mixed") return isArabicUi() ? "مختلط" : "Mixed";
  return isArabicUi() ? "تم الإعلان" : "Reported";
}

function resultLabel(status, reported, observation) {
  if (BEAT_STATUSES.has(status)) return "Beat";
  if (status === "FAILED") return "Miss";
  if (status === "PARTIALLY_PASSED") return isArabicUi() ? "قريب" : "Mixed";
  if (reported && observation) return isArabicUi() ? "ملاحظة" : "Observed";
  if (reported) return isArabicUi() ? "معلن" : "Reported";
  return isArabicUi() ? "معلّق" : "Pending";
}

function resultTone(status, reported) {
  if (BEAT_STATUSES.has(status)) return "beat";
  if (status === "FAILED") return "miss";
  if (status === "PARTIALLY_PASSED") return "mixed";
  return reported ? "neutral" : "pending";
}

function normalizedStatus(value) {
  return String(value || "NOT_REPORTED").trim().toUpperCase();
}

function formatNumber(value, maximumFractionDigits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0
  }).format(number);
}

function formatSignedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const sign = number > 0 ? "+" : number < 0 ? "−" : "";
  return `${sign}${formatNumber(Math.abs(number), 2)}%`;
}

function outlookValue(type, value) {
  const key = String(value || "").trim().toLowerCase();
  const ar = {
    growth: { accelerating: "يتسارع", stable: "مستقر", slowing: "يتباطأ", unclear: "غير واضح" },
    margin: { improving: "تتحسن", stable: "مستقرة", pressured: "تحت ضغط", unclear: "غير واضح" },
    guidance: { raised: "مرفوع", maintained: "مثبّت", lowered: "مخفض", mixed: "مختلط", new: "جديد", not_reported: "غير معلن" },
    thesis: { supports: "يدعم الفرضية", neutral: "لا يغير الفرضية", weakens: "يضعف الفرضية", unclear: "غير واضح" }
  };
  const en = {
    growth: { accelerating: "Accelerating", stable: "Stable", slowing: "Slowing", unclear: "Unclear" },
    margin: { improving: "Improving", stable: "Stable", pressured: "Under pressure", unclear: "Unclear" },
    guidance: { raised: "Raised", maintained: "Maintained", lowered: "Lowered", mixed: "Mixed", new: "New", not_reported: "Not reported" },
    thesis: { supports: "Supports thesis", neutral: "No thesis change", weakens: "Weakens thesis", unclear: "Unclear" }
  };
  return (isArabicUi() ? ar : en)[type]?.[key] || "";
}

function bindExperience(host, viewKey) {
  host.querySelectorAll("[data-fet-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const current = VIEW_STATES.get(viewKey) || {};
      VIEW_STATES.set(viewKey, { ...current, activeTab: button.dataset.fetTab === "summary" ? "summary" : "earnings" });
      host.dataset.renderSignature = "";
      scheduleEnhancement();
    });
  });
  host.querySelectorAll("[data-fet-quarter]").forEach((button) => {
    button.addEventListener("click", () => {
      const quarter = Number(button.dataset.fetQuarter);
      if (!Number.isFinite(quarter)) return;
      const current = VIEW_STATES.get(viewKey) || {};
      VIEW_STATES.set(viewKey, { ...current, selectedQuarter: quarter });
      host.dataset.renderSignature = "";
      scheduleEnhancement();
    });
  });
}

function revealSelectedQuarter(host) {
  const active = host.querySelector(".fet-quarter-pill.active");
  if (!active) return;
  requestAnimationFrame(() => {
    try { active.scrollIntoView({ block: "nearest", inline: "center" }); }
    catch { active.scrollIntoView(); }
  });
}

function removeMobileEnhancement(shell = null) {
  shell?.removeAttribute("data-earnings-table-enhanced");
  shell?.querySelector(HUB_SELECTOR)?.remove();
  if (typeof document !== "undefined") document.documentElement.classList.remove(ACTIVE_CLASS);
}

function uniqueText(values = []) {
  return [...new Set(values.map(textOrNull).filter(Boolean))];
}

function textOrNull(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function installStylesheet() {
  if (typeof document === "undefined") return;
  const existing = document.getElementById(STYLESHEET_ID);
  if (existing) {
    stylesheetReady = true;
    scheduleEnhancement();
    return;
  }
  const link = document.createElement("link");
  link.id = STYLESHEET_ID;
  link.rel = "stylesheet";
  link.href = STYLESHEET_URL;
  link.addEventListener("load", () => {
    stylesheetReady = true;
    scheduleEnhancement();
  }, { once: true });
  link.addEventListener("error", () => {
    stylesheetReady = false;
    removeMobileEnhancement(document.querySelector(".quarterly-scorecard-shell"));
  }, { once: true });
  document.head.appendChild(link);
}

if (typeof document !== "undefined" && typeof window !== "undefined") {
  installStylesheet();
  const app = document.getElementById("app");
  if (app) new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
  window.addEventListener("resize", scheduleEnhancement, { passive: true });
  window.addEventListener("pageshow", scheduleEnhancement);
}
