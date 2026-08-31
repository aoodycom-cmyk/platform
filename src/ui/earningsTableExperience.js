import { buildQuarterlyScorecard } from "../externalAnalysis/quarterlyScorecard.js";

export const EARNINGS_TABLE_EXPERIENCE_VERSION = "v57";

const MOBILE_MAX_WIDTH = 899;
const HUB_SELECTOR = ".franklin-earnings-hub";
const ACTIVE_CLASS = "franklin-quarterly-earnings-active";
const STYLE_LINK_ID = "franklin-earnings-table-styles";
const STYLE_HREF = "./styles-earnings-compact-v56.css?v=v57-earnings-single-source";
const VIEW_STATES = new Map();
const BEAT_STATUSES = new Set(["EXCEEDED", "PASSED"]);

let frame = 0;

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function isArabicUi() {
  if (!isBrowser()) return true;
  return document.documentElement.dir === "rtl"
    || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function currentStore() {
  return isBrowser() ? window.__equityResearchStore || null : null;
}

function scheduleEnhancement() {
  if (!isBrowser()) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhanceQuarterlyEarningsExperience);
}

function enhanceQuarterlyEarningsExperience() {
  ensureStylesheet();
  const shell = document.querySelector(".quarterly-scorecard-shell");
  if (!shell) {
    deactivateExperience();
    return;
  }

  if (window.innerWidth > MOBILE_MAX_WIDTH) {
    removeMobileEnhancement(shell);
    deactivateExperience();
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

  document.documentElement.classList.add(ACTIVE_CLASS);
  shell.dataset.earningsTableEnhanced = "true";

  let host = shell.querySelector(HUB_SELECTOR);
  if (!host) {
    host = document.createElement("section");
    host.className = "franklin-earnings-hub";
    const header = shell.querySelector(":scope > .quarterly-scorecard-header");
    if (header) header.insertAdjacentElement("afterend", host);
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
  const rawQuarters = Array.isArray(scorecard.quarters) ? scorecard.quarters : [];
  const rawRows = Array.isArray(scorecard.rows) ? scorecard.rows : [];
  const latestReportedQuarter = numberOrNull(scorecard.latestReportedQuarter);

  const prepared = rawQuarters
    .map((quarter) => {
      const quarterNumber = Number(quarter?.quarter);
      const rows = rawRows
        .map((row) => ({
          key: row?.key || "",
          label: row?.label || "",
          secondaryLabel: row?.secondaryLabel || "",
          cell: row?.cells?.[quarterNumber] ? { ...row.cells[quarterNumber] } : null
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
        targetScenario: quarter?.targetScenario || null,
        outlook: quarter?.outlook ? { ...quarter.outlook } : null,
        rows,
        counts,
        hasData
      };
    })
    .filter((quarter) => Number.isFinite(quarter.quarter) && quarter.hasData);

  const targetQuarter = selectTargetQuarter(prepared, latestReportedQuarter);
  const quarters = prepared
    .map((quarter) => {
      const phase = quarterPhase(quarter, latestReportedQuarter, targetQuarter);
      return {
        ...quarter,
        phase,
        tone: quarterTone(quarter, phase)
      };
    })
    .sort((left, right) => right.quarter - left.quarter);

  return {
    ticker: scorecard.ticker || "",
    companyName: scorecard.companyName || scorecard.ticker || "",
    year: numberOrNull(scorecard.year),
    latestReportedQuarter,
    reportedQuarterCount: numberOrNull(scorecard.reportedQuarterCount) || 0,
    trajectory: scorecard.trajectory || null,
    overallStatus: scorecard.overallStatus || null,
    target: scorecard.target ? { ...scorecard.target } : null,
    fairValue: scorecard.fairValue ? { ...scorecard.fairValue } : null,
    quarters,
    targetQuarter,
    defaultQuarter: defaultQuarter(quarters, latestReportedQuarter, targetQuarter)
  };
}

function selectTargetQuarter(quarters = [], latestReportedQuarter = null) {
  const candidates = quarters.filter((quarter) => !quarter.evaluated && quarter.rows.length);
  if (!candidates.length) return null;
  if (Number.isFinite(latestReportedQuarter)) {
    return candidates
      .filter((quarter) => quarter.quarter > latestReportedQuarter)
      .sort((left, right) => left.quarter - right.quarter)[0]?.quarter || null;
  }
  return candidates.sort((left, right) => right.quarter - left.quarter)[0]?.quarter || null;
}

function quarterPhase(quarter = {}, latestReportedQuarter = null, targetQuarter = null) {
  if (quarter.evaluated) return "reported";
  if (quarter.quarter === targetQuarter) {
    return Number.isFinite(latestReportedQuarter) ? "upcoming" : "target";
  }
  if (Number.isFinite(targetQuarter) && quarter.quarter > targetQuarter) return "future";
  return "missing";
}

function defaultQuarter(quarters = [], latestReportedQuarter = null, targetQuarter = null) {
  if (!quarters.length) return null;
  const target = quarters.find((quarter) => quarter.quarter === targetQuarter);
  if (target) return target.quarter;
  const latest = quarters.find((quarter) => quarter.quarter === latestReportedQuarter);
  if (latest) return latest.quarter;
  return quarters[0].quarter;
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

function quarterTone(quarter = {}, phase = "missing") {
  if (phase !== "reported") return phase === "missing" ? "neutral" : "upcoming";
  const counts = quarter.counts || {};
  if (counts.miss > 0 && counts.beat === 0 && counts.mixed === 0) return "miss";
  if (counts.miss > 0 || counts.mixed > 0) return "mixed";
  if (counts.beat > 0) return "beat";
  return "neutral";
}

function renderExperience(model, selectedQuarter, activeTab) {
  const quarter = model.quarters.find((item) => item.quarter === Number(selectedQuarter)) || model.quarters[0] || null;
  if (!quarter) return emptyExperience(model);
  const ar = isArabicUi();

  return `
    <div class="fet-section-tabs" role="tablist" aria-label="${escapeHtml(ar ? "أقسام متابعة الأرباح" : "Earnings sections")}">
      <button type="button" role="tab" data-fet-tab="summary" aria-selected="${activeTab === "summary"}" class="${activeTab === "summary" ? "active" : ""}">${escapeHtml(ar ? "الملخص" : "Summary")}</button>
      <button type="button" role="tab" data-fet-tab="earnings" aria-selected="${activeTab === "earnings"}" class="${activeTab === "earnings" ? "active" : ""}">${escapeHtml(ar ? "الأرباح" : "Earnings")}</button>
    </div>

    <div class="fet-quarter-rail" role="list" aria-label="${escapeHtml(ar ? "اختيار الربع" : "Select quarter")}">
      ${model.quarters.map((item) => quarterButton(item, model.year, item.quarter === quarter.quarter)).join("")}
    </div>

    <div class="fet-tab-panel" role="tabpanel">
      ${activeTab === "summary" ? renderSummary(model, quarter) : renderEarningsTable(model, quarter)}
    </div>
  `;
}

function quarterButton(quarter, year, selected) {
  return `
    <button type="button" role="listitem" data-fet-quarter="${quarter.quarter}" class="fet-quarter-pill tone-${quarter.tone} phase-${quarter.phase} ${selected ? "active" : ""}" aria-pressed="${selected}">
      <strong dir="ltr">${escapeHtml(`${quarter.label} ${year || ""}`.trim())}</strong>
      <span dir="auto">${escapeHtml(quarterPillMeta(quarter))}</span>
    </button>
  `;
}

function quarterPillMeta(quarter = {}) {
  const ar = isArabicUi();
  if (quarter.phase === "upcoming") return ar ? "بانتظار الإعلان" : "Awaiting report";
  if (quarter.phase === "target") return ar ? "هدف محفوظ" : "Saved target";
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

function renderEarningsTable(model, quarter) {
  const reported = quarter.phase === "reported";
  const ar = isArabicUi();
  return `
    <article class="fet-quarter-card tone-${quarter.tone} phase-${quarter.phase}">
      <header class="fet-quarter-card-head">
        <div>
          <h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3>
          <span>${escapeHtml(quarterContextLabel(quarter))}</span>
        </div>
        <b class="fet-state-badge">${escapeHtml(quarterStateLabel(quarter))}</b>
      </header>

      <div class="fet-table-title">
        <h4>${escapeHtml(reported
          ? (ar ? "النتائج مقابل متطلبات Bull" : "Results versus Bull requirements")
          : (ar ? "المطلوب للوصول إلى Bull" : "Requirements to reach the Bull case"))}</h4>
        <span>${escapeHtml(requirementCountLabel(quarter.counts.total))}</span>
      </div>

      ${quarter.rows.length ? earningsTable(quarter, reported) : emptyQuarterRows(quarter)}
      ${quarterHighlights(quarter)}
    </article>
  `;
}

function earningsTable(quarter, reported) {
  const ar = isArabicUi();
  const tableClass = reported ? "fet-table-reported" : "fet-table-pending";
  return `
    <div class="fet-table-wrap" role="region" aria-label="${escapeHtml(ar ? "جدول نتائج الأرباح" : "Earnings results table")}">
      <table class="fet-table ${tableClass}">
        <colgroup>${reported ? "<col><col><col>" : "<col><col>"}</colgroup>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(ar ? "المقياس" : "Metric")}</th>
            <th scope="col">${escapeHtml(ar ? "Bull" : "Bull requirement")}</th>
            ${reported ? `<th scope="col">${escapeHtml(ar ? "الفعلي" : "Actual")}</th>` : ""}
          </tr>
        </thead>
        <tbody>
          ${quarter.rows.map((row) => earningsRow(row, reported)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function earningsRow(row, reported) {
  const cell = row.cell || {};
  const status = normalizedStatus(cell.status);
  const tone = resultTone(status, cell.reported);
  const secondary = textOrNull(row.secondaryLabel);
  const metricTitle = secondary ? ` title="${escapeHtml(secondary)}"` : "";
  const actual = cell.reported ? displayActualValue(cell) : "—";
  return `
    <tr class="tone-${tone}">
      <th scope="row"${metricTitle}>
        <strong dir="auto">${escapeHtml(row.label || secondary || "—")}</strong>
        ${secondary ? `<span class="fet-sr-only">${escapeHtml(secondary)}</span>` : ""}
      </th>
      <td class="fet-required"><bdi dir="auto">${escapeHtml(displayRequirementValue(cell))}</bdi></td>
      ${reported ? `
        <td class="fet-actual tone-${tone}">
          <bdi dir="auto">${escapeHtml(actual)}</bdi>
          ${resultMarkup(cell)}
        </td>` : ""}
    </tr>
  `;
}

function resultMarkup(cell = {}) {
  const status = normalizedStatus(cell.status);
  const tone = resultTone(status, cell.reported);
  const label = resultLabel(status, cell.reported, cell.observation);
  const variance = favorableVariancePercent(cell);
  if (!label && !Number.isFinite(variance)) return "";
  return `
    <span class="fet-result tone-${tone}">
      ${label ? `<strong>${escapeHtml(label)}</strong>` : ""}
      ${Number.isFinite(variance) ? `<small dir="ltr">${escapeHtml(formatSignedPercent(variance))}</small>` : ""}
    </span>
  `;
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
    || summaryFallback(quarter);

  return `
    <article class="fet-summary-card tone-${quarter.tone} phase-${quarter.phase}">
      <header>
        <div>
          <h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3>
          <span>${escapeHtml(quarterContextLabel(quarter))}</span>
        </div>
        <b>${escapeHtml(quarterStateLabel(quarter))}</b>
      </header>

      <div class="fet-summary-hero">
        <span>${escapeHtml(reported ? (ar ? "تحقيق المتطلبات" : "Requirements achievement") : (ar ? "حالة الربع" : "Quarter status"))}</span>
        <strong dir="auto">${escapeHtml(reported ? achievement : quarterStateLabel(quarter))}</strong>
        <p>${escapeHtml(summaryText)}</p>
      </div>

      <div class="fet-summary-grid">
        ${summaryMetric(ar ? "المتطلبات" : "Requirements", quarter.counts.total, "neutral")}
        ${summaryMetric("Beat", quarter.counts.beat, "beat")}
        ${summaryMetric("Miss", quarter.counts.miss, "miss")}
        ${summaryMetric(ar ? "قيد الانتظار" : "Pending", quarter.counts.pending, "pending")}
      </div>

      ${outlookBlock(quarter.outlook)}
      ${quarterHighlights(quarter, true)}
    </article>
  `;
}

function summaryFallback(quarter = {}) {
  const ar = isArabicUi();
  if (quarter.phase === "upcoming") return ar ? "يعرض Franklin الأهداف المحفوظة للربع القادم دون اختراع توقعات سوق." : "Franklin shows saved next-quarter targets without inventing market forecasts.";
  if (quarter.phase === "target") return ar ? "هذه أهداف محفوظة في Franklin، ولا توجد نتيجة فصلية سابقة مرتبطة بها بعد." : "These are saved Franklin targets with no linked reported quarter yet.";
  if (quarter.phase === "future") return ar ? "هدف مستقبلي محفوظ، ولم يحن وقت تقييمه بعد." : "A saved future target that is not due for evaluation yet.";
  if (quarter.phase === "missing") return ar ? "لا توجد نتيجة محفوظة لهذا الربع، ولن يعرض Franklin أرقامًا غير موجودة." : "No result is saved for this quarter, and Franklin will not invent figures.";
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
    <details class="fet-highlights">
      <summary>
        <span>${escapeHtml(isArabicUi() ? "أبرز الملاحظات" : "Highlights")}</span>
        <b aria-hidden="true">⌄</b>
      </summary>
      <div>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div>
    </details>
  `;
}

function emptyQuarterRows(quarter = {}) {
  const ar = isArabicUi();
  return `<div class="fet-empty-quarter"><strong>${escapeHtml(ar ? "لا توجد متطلبات محفوظة لهذا الربع" : "No saved requirements for this quarter")}</strong><span>${escapeHtml(quarter.phase === "reported" ? "" : (ar ? "لن يعرض Franklin أرقامًا غير موجودة." : "Franklin will not display invented figures."))}</span></div>`;
}

function emptyExperience(model = {}) {
  const ar = isArabicUi();
  return `
    <article class="fet-empty-experience">
      <strong>${escapeHtml(ar ? "لا توجد أرباع متاحة بعد" : "No quarters are available yet")}</strong>
      <p>${escapeHtml(ar ? "أضف متطلبات ربع أو استورد تحديث أرباح لعرض الجدول هنا." : "Add quarterly requirements or import an earnings update to populate this table.")}</p>
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

function quarterContextLabel(quarter = {}) {
  const ar = isArabicUi();
  if (quarter.phase === "reported") return ar ? "ربع معلن" : "Reported quarter";
  if (quarter.phase === "upcoming") return ar ? "الربع القادم" : "Upcoming quarter";
  if (quarter.phase === "target") return ar ? "هدف Franklin المحفوظ" : "Saved Franklin target";
  if (quarter.phase === "future") return ar ? "هدف مستقبلي" : "Future target";
  return ar ? "لا توجد نتيجة محفوظة" : "No saved result";
}

function quarterStateLabel(quarter = {}) {
  const ar = isArabicUi();
  if (quarter.phase === "upcoming") return ar ? "قادم" : "Upcoming";
  if (quarter.phase === "target") return ar ? "هدف" : "Target";
  if (quarter.phase === "future") return ar ? "مستقبلي" : "Future";
  if (quarter.phase === "missing") return ar ? "غير متوفر" : "Unavailable";
  if (quarter.tone === "beat") return "Beat";
  if (quarter.tone === "miss") return "Miss";
  if (quarter.tone === "mixed") return ar ? "مختلط" : "Mixed";
  return ar ? "معلن" : "Reported";
}

function resultLabel(status, reported, observation) {
  if (BEAT_STATUSES.has(status)) return "Beat";
  if (status === "FAILED") return "Miss";
  if (status === "PARTIALLY_PASSED") return isArabicUi() ? "قريب" : "Mixed";
  if (reported && observation) return isArabicUi() ? "ملاحظة" : "Observed";
  if (reported) return isArabicUi() ? "معلن" : "Reported";
  return "";
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

export function displayRequirementValue(cell = {}) {
  const operator = requirementOperator(cell.type, cell.requiredDisplay);
  const value = compactFinancialValue(cell.requiredValue, cell.requiredDisplay, cell.unit);
  return value === "—" ? value : `${operator}${operator ? " " : ""}${value}`;
}

export function displayActualValue(cell = {}) {
  return compactFinancialValue(cell.actualValue, cell.actualDisplay, cell.unit, cell.actualRaw);
}

function requirementOperator(type, display) {
  const normalizedType = String(type || "").toLowerCase();
  if (normalizedType.includes("minimum")) return "≥";
  if (normalizedType.includes("maximum")) return "≤";
  const text = String(display || "");
  if (/أو أكثر|على الأقل|at least|or more/i.test(text)) return "≥";
  if (/أو أقل|بحد أقصى|at most|or less/i.test(text)) return "≤";
  return "";
}

function compactFinancialValue(value, display, unit, raw = null) {
  const number = numberOrNull(value);
  const unitText = String(unit || "").trim();
  const displayText = textOrNull(display) || (typeof raw === "string" ? textOrNull(raw) : null);
  const unitHint = `${unitText} ${displayText || ""}`.toLowerCase();

  if (Number.isFinite(number)) {
    if (unitText === "%" || /percent|percentage|٪|%/.test(unitHint)) return `${formatNumber(number, 2)}%`;
    if (/billion|\bbn\b|مليار/.test(unitHint) && /usd|dollar|دولار|\$/.test(unitHint)) return `$${formatNumber(number, 2)}B`;
    if (/million|\bmm\b|مليون/.test(unitHint) && /usd|dollar|دولار|\$/.test(unitHint)) return `$${formatNumber(number, 2)}M`;
    if (/billion|\bbn\b|مليار/.test(unitHint) && /share|سهم/.test(unitHint)) return `${formatNumber(number, 2)}B ${isArabicUi() ? "سهم" : "shares"}`;
    if (/million|\bmm\b|مليون/.test(unitHint) && /subscriber|customer|مشترك|عميل/.test(unitHint)) return `${formatNumber(number, 2)}M`;
    if (unitText === "$" || /^(usd|dollar)$/i.test(unitText)) return `$${formatNumber(number, 2)}`;
    if (unitText && unitText.length <= 10) return `${formatNumber(number, 2)} ${unitText}`.trim();
    if (!displayText) return formatNumber(number, 2);
  }

  return compactDisplayText(displayText) || "—";
}

function compactDisplayText(value) {
  const text = textOrNull(value);
  if (!text) return null;
  const clean = text
    .replace(/\s+(?:أو أكثر|على الأقل|أو أقل|بحد أقصى)$/i, "")
    .replace(/\s+(?:or more|at least|or less|at most)$/i, "")
    .trim();
  const numberMatch = clean.match(/-?\d+(?:[.,]\d+)?/);
  if (!numberMatch) return clean;
  const number = numberMatch[0].replace(",", ".");
  if (/مليار دولار|billion dollars?|usd\s*bn|\$\s*\d+(?:\.\d+)?\s*b/i.test(clean)) return `$${number}B`;
  if (/مليون دولار|million dollars?|usd\s*mm|\$\s*\d+(?:\.\d+)?\s*m/i.test(clean)) return `$${number}M`;
  if (/مليار سهم|billion shares?/i.test(clean)) return `${number}B ${isArabicUi() ? "سهم" : "shares"}`;
  if (/مليون(?:ًا)?\s+(?:مشترك|عميل)|million subscribers?|million customers?/i.test(clean)) return `${number}M`;
  if (/%|٪|percent/i.test(clean)) return `${number}%`;
  return clean;
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

function removeMobileEnhancement(shell) {
  shell.removeAttribute("data-earnings-table-enhanced");
  shell.querySelector(HUB_SELECTOR)?.remove();
}

function deactivateExperience() {
  if (!isBrowser()) return;
  document.documentElement.classList.remove(ACTIVE_CLASS);
}

function ensureStylesheet() {
  if (!isBrowser() || document.getElementById(STYLE_LINK_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_LINK_ID;
  link.rel = "stylesheet";
  link.href = STYLE_HREF;
  link.dataset.franklinEarningsStyles = EARNINGS_TABLE_EXPERIENCE_VERSION;
  document.head.append(link);
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

if (isBrowser()) {
  ensureStylesheet();
  window.__FRANKLIN_EARNINGS_TABLE_EXPERIENCE__ = EARNINGS_TABLE_EXPERIENCE_VERSION;
  const store = currentStore();
  store?.subscribe?.(scheduleEnhancement);
  const app = document.getElementById("app");
  if (app) new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
  window.addEventListener("resize", scheduleEnhancement, { passive: true });
  window.addEventListener("pageshow", scheduleEnhancement);
  scheduleEnhancement();
}
