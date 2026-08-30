import { buildQuarterlyScorecard } from "../externalAnalysis/quarterlyScorecard.js";

const MOBILE_MAX_WIDTH = 899;
const STYLE_ID = "franklin-earnings-table-experience-styles";
const HUB_SELECTOR = ".franklin-earnings-hub";
const VIEW_STATES = new Map();
const BEAT_STATUSES = new Set(["EXCEEDED", "PASSED"]);

let frame = 0;

function isArabicUi() {
  return document.documentElement.dir === "rtl"
    || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function currentStore() {
  return window.__equityResearchStore || null;
}

function scheduleEnhancement() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhanceQuarterlyEarningsExperience);
}

function enhanceQuarterlyEarningsExperience() {
  const shell = document.querySelector(".quarterly-scorecard-shell");
  if (!shell) return;

  if (window.innerWidth > MOBILE_MAX_WIDTH) {
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

  ensureStyles();
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
        summary: quarter?.summary || null,
        targetValue: numberOrNull(quarter?.targetValue),
        targetScenario: quarter?.targetScenario || null,
        outlook: quarter?.outlook || null,
        rows,
        counts,
        hasData,
        tone: quarterTone({ quarter, rows, counts })
      };
    })
    .filter((quarter) => Number.isFinite(quarter.quarter) && quarter.hasData)
    .sort((left, right) => right.quarter - left.quarter);

  return {
    ticker: scorecard.ticker || "",
    companyName: scorecard.companyName || scorecard.ticker || "",
    year: numberOrNull(scorecard.year),
    latestReportedQuarter: numberOrNull(scorecard.latestReportedQuarter),
    reportedQuarterCount: numberOrNull(scorecard.reportedQuarterCount) || 0,
    trajectory: scorecard.trajectory || null,
    overallStatus: scorecard.overallStatus || null,
    target: scorecard.target || null,
    fairValue: scorecard.fairValue || null,
    quarters,
    defaultQuarter: defaultQuarter(quarters, scorecard.latestReportedQuarter)
  };
}

function defaultQuarter(quarters = [], latestReportedQuarter = null) {
  if (!quarters.length) return null;
  const latest = Number(latestReportedQuarter);
  const upcoming = quarters
    .filter((quarter) => !quarter.evaluated && quarter.rows.length && (!Number.isFinite(latest) || quarter.quarter > latest))
    .sort((left, right) => left.quarter - right.quarter)[0];
  if (upcoming) return upcoming.quarter;

  const open = quarters
    .filter((quarter) => !quarter.evaluated && quarter.rows.length)
    .sort((left, right) => left.quarter - right.quarter)[0];
  if (open) return open.quarter;

  const latestReported = quarters.find((quarter) => quarter.quarter === latest);
  if (latestReported) return latestReported.quarter;
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

function quarterTone({ quarter = {}, counts = {} } = {}) {
  if (!quarter.evaluated) return "upcoming";
  if (counts.miss > 0 && counts.beat === 0 && counts.mixed === 0) return "miss";
  if (counts.miss > 0 || counts.mixed > 0) return "mixed";
  if (counts.beat > 0) return "beat";
  return "neutral";
}

function renderExperience(model, selectedQuarter, activeTab) {
  const quarter = model.quarters.find((item) => item.quarter === Number(selectedQuarter)) || model.quarters[0] || null;
  if (!quarter) return emptyExperience(model);
  const ar = isArabicUi();
  const summaryLabel = ar ? "الملخص" : "Summary";
  const earningsLabel = ar ? "الأرباح" : "Earnings";

  return `
    <div class="fet-section-tabs" role="tablist" aria-label="${escapeHtml(ar ? "أقسام متابعة الأرباح" : "Earnings sections")}">
      <button type="button" role="tab" data-fet-tab="summary" aria-selected="${activeTab === "summary"}" class="${activeTab === "summary" ? "active" : ""}">${escapeHtml(summaryLabel)}</button>
      <button type="button" role="tab" data-fet-tab="earnings" aria-selected="${activeTab === "earnings"}" class="${activeTab === "earnings" ? "active" : ""}">${escapeHtml(earningsLabel)}</button>
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
  const ar = isArabicUi();
  const meta = quarterPillMeta(quarter);
  return `
    <button type="button" role="listitem" data-fet-quarter="${quarter.quarter}" class="fet-quarter-pill tone-${quarter.tone} ${selected ? "active" : ""}" aria-pressed="${selected}">
      <strong dir="ltr">${escapeHtml(`${quarter.label} ${year || ""}`.trim())}</strong>
      <span dir="auto">${escapeHtml(meta)}</span>
      ${quarter.tone === "upcoming" ? `<small>${escapeHtml(ar ? "الربع القادم" : "Upcoming")}</small>` : ""}
    </button>
  `;
}

function quarterPillMeta(quarter = {}) {
  const ar = isArabicUi();
  if (!quarter.evaluated) return ar ? "بانتظار الإعلان" : "Awaiting report";
  const achievement = Number.isFinite(quarter.weightedAchievement)
    ? `${formatNumber(quarter.weightedAchievement, 1)}%`
    : "";
  if (quarter.tone === "beat") return `${ar ? "Beat" : "Beat"}${achievement ? ` ${achievement}` : ""}`;
  if (quarter.tone === "miss") return `${ar ? "Miss" : "Miss"}${achievement ? ` ${achievement}` : ""}`;
  if (quarter.tone === "mixed") return `${ar ? "Mixed" : "Mixed"}${achievement ? ` ${achievement}` : ""}`;
  return achievement || (ar ? "تم الإعلان" : "Reported");
}

function renderEarningsTable(model, quarter) {
  const ar = isArabicUi();
  const upcoming = !quarter.evaluated;
  const title = upcoming
    ? (ar ? "المطلوب تحقيقه للوصول إلى Bull" : "Requirements to reach the Bull case")
    : (ar ? "نتائج الربع مقابل متطلبات Bull" : "Quarter results versus Bull requirements");
  const subtitle = upcoming
    ? (ar ? "لا توجد نتيجة فعلية بعد. يعرض Franklin فقط الأهداف المحفوظة لهذا الربع دون اختراع توقعات جديدة." : "No actual result is available yet. Franklin shows only saved targets and does not invent forecasts.")
    : (ar ? "الفعلي يتلوّن بالأخضر عند Beat وبالأحمر عند Miss." : "Actuals are green for a Beat and red for a Miss.");

  return `
    <article class="fet-quarter-card tone-${quarter.tone}">
      <header class="fet-quarter-card-head">
        <div>
          <span>${escapeHtml(upcoming ? (ar ? "الربع القادم" : "Upcoming quarter") : (ar ? "ربع معلن" : "Reported quarter"))}</span>
          <h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <b class="fet-state-badge">${escapeHtml(quarterStateLabel(quarter))}</b>
      </header>

      <div class="fet-table-title">
        <h4>${escapeHtml(title)}</h4>
        <span>${escapeHtml(requirementCountLabel(quarter.counts.total))}</span>
      </div>

      ${quarter.rows.length ? earningsTable(quarter, upcoming) : emptyQuarterRows(upcoming)}
      ${quarterHighlights(quarter)}
    </article>
  `;
}

function earningsTable(quarter, upcoming) {
  const ar = isArabicUi();
  return `
    <div class="fet-table-wrap" role="region" aria-label="${escapeHtml(ar ? "جدول نتائج الأرباح" : "Earnings results table")}">
      <table class="fet-table">
        <colgroup><col class="fet-col-metric"><col><col><col></colgroup>
        <thead>
          <tr>
            <th scope="col">${escapeHtml(ar ? "المقياس" : "Metric")}</th>
            <th scope="col">${escapeHtml(upcoming ? (ar ? "المطلوب للـ Bull" : "Bull requirement") : (ar ? "المطلوب" : "Required"))}</th>
            <th scope="col">${escapeHtml(ar ? "الفعلي" : "Actual")}</th>
            <th scope="col">${escapeHtml(upcoming ? (ar ? "الحالة" : "Status") : (ar ? "النتيجة" : "Result"))}</th>
          </tr>
        </thead>
        <tbody>
          ${quarter.rows.map((row) => earningsRow(row, upcoming)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function earningsRow(row, upcoming) {
  const cell = row.cell || {};
  const status = normalizedStatus(cell.status);
  const actualTone = resultTone(status, cell.reported);
  const required = displayFinancialValue(cell.requiredValue, cell.requiredDisplay, cell.unit);
  const actual = cell.reported
    ? displayFinancialValue(cell.actualValue, cell.actualDisplay, cell.unit, cell.actualRaw)
    : "—";
  const result = upcoming && !cell.reported
    ? pendingResultMarkup()
    : resultMarkup(cell);
  return `
    <tr class="tone-${actualTone}">
      <th scope="row">
        <strong dir="auto">${escapeHtml(row.label || "—")}</strong>
        ${row.secondaryLabel ? `<small dir="auto">${escapeHtml(row.secondaryLabel)}</small>` : ""}
      </th>
      <td><bdi dir="ltr">${escapeHtml(required)}</bdi></td>
      <td class="fet-actual tone-${actualTone}"><bdi dir="ltr">${escapeHtml(actual)}</bdi></td>
      <td class="fet-result-cell">${result}</td>
    </tr>
  `;
}

function resultMarkup(cell = {}) {
  const status = normalizedStatus(cell.status);
  const tone = resultTone(status, cell.reported);
  const label = resultLabel(status, cell.reported, cell.observation);
  const variance = favorableVariancePercent(cell);
  return `
    <span class="fet-result tone-${tone}">
      <strong>${escapeHtml(label)}</strong>
      ${Number.isFinite(variance) ? `<small dir="ltr">${escapeHtml(formatSignedPercent(variance))}</small>` : ""}
    </span>
  `;
}

function pendingResultMarkup() {
  return `<span class="fet-result tone-pending"><strong>${escapeHtml(isArabicUi() ? "بانتظار الإعلان" : "Pending")}</strong></span>`;
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
  const upcoming = !quarter.evaluated;
  const achievement = Number.isFinite(quarter.weightedAchievement)
    ? `${formatNumber(quarter.weightedAchievement, 1)}%`
    : "—";
  const summaryText = quarter.summary
    || quarter.outlook?.summary
    || (upcoming
      ? (ar ? "هذا الربع لم يُعلن بعد. الأهداف أدناه هي متطلبات Franklin المحفوظة لسيناريو Bull." : "This quarter has not reported yet. The items below are Franklin's saved Bull-case requirements.")
      : (ar ? "لا يوجد ملخص إضافي محفوظ لهذا الربع." : "No additional saved summary is available for this quarter."));

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
        <span>${escapeHtml(upcoming ? (ar ? "الحالة" : "Status") : (ar ? "نسبة تحقيق المتطلبات" : "Requirements achievement"))}</span>
        <strong dir="auto">${escapeHtml(upcoming ? (ar ? "بانتظار الإعلان" : "Awaiting report") : achievement)}</strong>
        <p>${escapeHtml(summaryText)}</p>
      </div>

      <div class="fet-summary-grid">
        ${summaryMetric(ar ? "إجمالي المتطلبات" : "Requirements", quarter.counts.total, "neutral")}
        ${summaryMetric("Beat", quarter.counts.beat, "beat")}
        ${summaryMetric("Miss", quarter.counts.miss, "miss")}
        ${summaryMetric(ar ? "قيد الانتظار" : "Pending", quarter.counts.pending, "pending")}
      </div>

      ${outlookBlock(quarter.outlook)}
      ${quarterHighlights(quarter, true)}
    </article>
  `;
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
  const ar = isArabicUi();
  const notes = uniqueText([
    summaryMode ? null : quarter.summary,
    summaryMode ? null : quarter.outlook?.summary,
    ...quarter.rows.map((row) => row.cell?.evaluationNote)
  ]);
  if (!notes.length) return "";
  return `
    <details class="fet-highlights" ${summaryMode ? "open" : ""}>
      <summary>
        <span>${escapeHtml(ar ? "أبرز الملاحظات" : "Highlights")}</span>
        <b aria-hidden="true">⌄</b>
      </summary>
      <div>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div>
    </details>
  `;
}

function emptyQuarterRows(upcoming) {
  return `<div class="fet-empty-quarter"><strong>${escapeHtml(isArabicUi() ? "لا توجد متطلبات محفوظة لهذا الربع" : "No saved requirements for this quarter")}</strong><span>${escapeHtml(upcoming ? (isArabicUi() ? "لن يعرض Franklin أرقامًا غير موجودة." : "Franklin will not display invented figures.") : "")}</span></div>`;
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

function quarterStateLabel(quarter = {}) {
  if (!quarter.evaluated) return isArabicUi() ? "قادم" : "Upcoming";
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
  return isArabicUi() ? "بانتظار الإعلان" : "Pending";
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

function displayFinancialValue(value, display, unit, raw = null) {
  const displayText = textOrNull(display);
  if (displayText) return displayText;
  const rawText = typeof raw === "string" ? textOrNull(raw) : null;
  if (rawText) return rawText;
  const number = numberOrNull(value);
  if (!Number.isFinite(number)) return "—";
  const unitText = String(unit || "").trim();
  if (unitText === "%" || /percent/i.test(unitText)) return `${formatNumber(number, 2)}%`;
  if (unitText === "$" || /usd|dollar/i.test(unitText)) return `$${formatNumber(number, 2)}`;
  return `${formatNumber(number, 2)}${unitText ? ` ${unitText}` : ""}`;
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

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @media (max-width: 899px) {
      .quarterly-scorecard-shell[data-earnings-table-enhanced="true"] {
        overflow-x: hidden !important;
      }
      .quarterly-scorecard-shell[data-earnings-table-enhanced="true"] > :not(.quarterly-scorecard-header):not(.franklin-earnings-hub) {
        display: none !important;
      }
      .franklin-earnings-hub {
        --fet-bg: #0b0e14;
        --fet-panel: #0d1117;
        --fet-panel-2: #101722;
        --fet-line: rgba(148, 163, 184, .18);
        --fet-line-strong: rgba(148, 163, 184, .28);
        --fet-text: #f4f7fb;
        --fet-muted: #94a3b8;
        --fet-blue: #60a5fa;
        --fet-green: #34d399;
        --fet-red: #fb7185;
        --fet-amber: #fbbf24;
        display: grid;
        gap: 14px;
        min-width: 0;
        margin: 0;
        padding: 0 0 calc(18px + env(safe-area-inset-bottom));
        color: var(--fet-text);
        direction: rtl;
      }
      html[dir="ltr"] .franklin-earnings-hub { direction: ltr; }
      .fet-section-tabs {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        min-height: 52px;
        border-bottom: 1px solid var(--fet-line);
        background: rgba(13, 17, 23, .72);
      }
      .fet-section-tabs button {
        position: relative;
        min-height: 52px;
        border: 0;
        background: transparent;
        color: var(--fet-muted);
        font: inherit;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }
      .fet-section-tabs button::after {
        content: "";
        position: absolute;
        inset-inline: 18%;
        bottom: -1px;
        height: 3px;
        border-radius: 999px 999px 0 0;
        background: transparent;
      }
      .fet-section-tabs button.active { color: var(--fet-text); }
      .fet-section-tabs button.active::after { background: var(--fet-blue); }
      .fet-quarter-rail {
        display: flex;
        gap: 9px;
        width: 100%;
        min-width: 0;
        overflow-x: auto;
        overflow-y: hidden;
        padding: 0 2px 3px;
        direction: ltr;
        scroll-snap-type: x proximity;
        overscroll-behavior-inline: contain;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .fet-quarter-rail::-webkit-scrollbar { display: none; }
      .fet-quarter-pill {
        position: relative;
        flex: 0 0 auto;
        min-width: 142px;
        min-height: 66px;
        display: grid;
        align-content: center;
        gap: 3px;
        padding: 10px 13px;
        border: 1px solid var(--fet-line-strong);
        border-radius: 15px;
        background: rgba(13, 17, 23, .84);
        color: var(--fet-muted);
        text-align: start;
        direction: ltr;
        scroll-snap-align: center;
        font: inherit;
        cursor: pointer;
      }
      .fet-quarter-pill strong { color: #d9e1ec; font-size: 14px; font-weight: 760; }
      .fet-quarter-pill span { font-size: 12px; font-weight: 720; }
      .fet-quarter-pill small {
        position: absolute;
        top: 7px;
        inset-inline-end: 8px;
        font-size: 9.5px;
        color: var(--fet-blue);
      }
      .fet-quarter-pill.tone-beat span { color: var(--fet-green); }
      .fet-quarter-pill.tone-miss span { color: var(--fet-red); }
      .fet-quarter-pill.tone-mixed span { color: var(--fet-amber); }
      .fet-quarter-pill.tone-upcoming span { color: var(--fet-blue); }
      .fet-quarter-pill.active {
        border-color: var(--fet-blue);
        background: linear-gradient(180deg, rgba(96, 165, 250, .13), rgba(13, 17, 23, .92));
        box-shadow: inset 0 0 0 1px rgba(96, 165, 250, .18), 0 10px 30px rgba(0, 0, 0, .18);
      }
      .fet-quarter-pill.active strong { color: #fff; }
      .fet-tab-panel { min-width: 0; }
      .fet-quarter-card,
      .fet-summary-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid rgba(96, 165, 250, .24);
        border-radius: 20px;
        background:
          radial-gradient(circle at 8% 0%, rgba(96, 165, 250, .10), transparent 34%),
          linear-gradient(180deg, rgba(16, 23, 34, .98), rgba(10, 15, 22, .98));
        box-shadow: 0 22px 50px rgba(0, 0, 0, .20);
      }
      .fet-quarter-card.tone-beat,
      .fet-summary-card.tone-beat { border-color: rgba(52, 211, 153, .30); }
      .fet-quarter-card.tone-miss,
      .fet-summary-card.tone-miss { border-color: rgba(251, 113, 133, .30); }
      .fet-quarter-card.tone-mixed,
      .fet-summary-card.tone-mixed { border-color: rgba(251, 191, 36, .30); }
      .fet-quarter-card-head,
      .fet-summary-card > header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 17px 16px 14px;
      }
      .fet-quarter-card-head > div,
      .fet-summary-card > header > div { min-width: 0; }
      .fet-quarter-card-head span,
      .fet-summary-card > header span {
        display: block;
        margin-bottom: 4px;
        color: var(--fet-blue);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .02em;
      }
      .fet-quarter-card-head h3,
      .fet-summary-card > header h3 {
        margin: 0;
        color: #fff;
        font-size: 20px;
        line-height: 1.25;
      }
      .fet-quarter-card-head p {
        margin: 7px 0 0;
        color: var(--fet-muted);
        font-size: 12.5px;
        line-height: 1.65;
      }
      .fet-state-badge,
      .fet-summary-card > header > b {
        flex: 0 0 auto;
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 7px 10px;
        border: 1px solid rgba(96, 165, 250, .30);
        border-radius: 11px;
        background: rgba(37, 99, 235, .12);
        color: var(--fet-blue);
        font-size: 12px;
        font-weight: 800;
      }
      .tone-beat .fet-state-badge,
      .fet-summary-card.tone-beat > header > b { border-color: rgba(52, 211, 153, .28); background: rgba(16, 185, 129, .10); color: var(--fet-green); }
      .tone-miss .fet-state-badge,
      .fet-summary-card.tone-miss > header > b { border-color: rgba(251, 113, 133, .28); background: rgba(244, 63, 94, .10); color: var(--fet-red); }
      .tone-mixed .fet-state-badge,
      .fet-summary-card.tone-mixed > header > b { border-color: rgba(251, 191, 36, .28); background: rgba(245, 158, 11, .10); color: var(--fet-amber); }
      .fet-table-title {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 0 16px 10px;
      }
      .fet-table-title h4 { margin: 0; font-size: 14px; line-height: 1.45; }
      .fet-table-title span { flex: 0 0 auto; color: var(--fet-muted); font-size: 11px; }
      .fet-table-wrap {
        margin: 0 12px 12px;
        overflow: hidden;
        border: 1px solid var(--fet-line-strong);
        border-radius: 15px;
        background: rgba(7, 11, 17, .58);
      }
      .fet-table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
        direction: inherit;
      }
      .fet-table .fet-col-metric { width: 29%; }
      .fet-table th,
      .fet-table td {
        min-width: 0;
        padding: 12px 7px;
        border-bottom: 1px solid var(--fet-line);
        border-inline-start: 1px solid var(--fet-line);
        vertical-align: middle;
        overflow-wrap: anywhere;
      }
      .fet-table tr:last-child > * { border-bottom: 0; }
      .fet-table tr > *:first-child { border-inline-start: 0; }
      .fet-table thead th {
        background: rgba(30, 41, 59, .34);
        color: #9fb0c7;
        font-size: 10.5px;
        line-height: 1.35;
        font-weight: 760;
        text-align: center;
      }
      .fet-table thead th:first-child { text-align: start; }
      .fet-table tbody th { color: #f3f6fb; text-align: start; }
      .fet-table tbody th strong { display: block; font-size: 12.5px; line-height: 1.45; font-weight: 690; }
      .fet-table tbody th small { display: block; margin-top: 3px; color: var(--fet-muted); font-size: 9.5px; line-height: 1.35; }
      .fet-table tbody td { color: #e5eaf1; font-size: 12.5px; text-align: center; font-variant-numeric: tabular-nums; }
      .fet-table .fet-actual.tone-beat { color: var(--fet-green); font-weight: 800; }
      .fet-table .fet-actual.tone-miss { color: var(--fet-red); font-weight: 800; }
      .fet-table .fet-actual.tone-mixed { color: var(--fet-amber); font-weight: 800; }
      .fet-result {
        display: grid;
        justify-items: center;
        gap: 2px;
        line-height: 1.15;
      }
      .fet-result strong { font-size: 11.5px; }
      .fet-result small { font-size: 10.5px; font-weight: 760; white-space: nowrap; }
      .fet-result.tone-beat { color: var(--fet-green); }
      .fet-result.tone-miss { color: var(--fet-red); }
      .fet-result.tone-mixed { color: var(--fet-amber); }
      .fet-result.tone-pending,
      .fet-result.tone-neutral { color: var(--fet-muted); }
      .fet-highlights {
        margin: 0 12px 14px;
        border: 1px solid var(--fet-line);
        border-radius: 14px;
        background: rgba(15, 23, 42, .32);
      }
      .fet-highlights summary {
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 0 13px;
        color: #dce4ef;
        font-size: 13px;
        font-weight: 720;
        cursor: pointer;
        list-style: none;
      }
      .fet-highlights summary::-webkit-details-marker { display: none; }
      .fet-highlights[open] summary b { transform: rotate(180deg); }
      .fet-highlights summary b { color: var(--fet-muted); transition: transform .18s ease; }
      .fet-highlights > div { display: grid; gap: 8px; padding: 0 13px 13px; }
      .fet-highlights p { margin: 0; padding-top: 8px; border-top: 1px solid var(--fet-line); color: #bdc8d7; font-size: 12px; line-height: 1.65; }
      .fet-summary-hero { margin: 0 12px 12px; padding: 15px; border: 1px solid var(--fet-line); border-radius: 15px; background: rgba(7, 11, 17, .50); }
      .fet-summary-hero > span { color: var(--fet-muted); font-size: 11px; }
      .fet-summary-hero > strong { display: block; margin-top: 5px; color: #fff; font-size: 24px; line-height: 1.25; }
      .fet-summary-hero p { margin: 9px 0 0; color: #bdc8d7; font-size: 12.5px; line-height: 1.7; }
      .fet-summary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0 12px 12px; }
      .fet-summary-metric { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 52px; padding: 11px 12px; border: 1px solid var(--fet-line); border-radius: 13px; background: rgba(15, 23, 42, .34); }
      .fet-summary-metric span { color: var(--fet-muted); font-size: 11px; }
      .fet-summary-metric strong { color: #eef3f9; font-size: 17px; }
      .fet-summary-metric.tone-beat strong { color: var(--fet-green); }
      .fet-summary-metric.tone-miss strong { color: var(--fet-red); }
      .fet-summary-metric.tone-pending strong { color: var(--fet-blue); }
      .fet-outlook-block { margin: 0 12px 12px; padding: 13px; border: 1px solid var(--fet-line); border-radius: 14px; background: rgba(15, 23, 42, .30); }
      .fet-outlook-block h4 { margin: 0 0 10px; font-size: 13px; }
      .fet-outlook-block > div { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .fet-outlook-block span { display: grid; gap: 3px; padding: 9px; border-radius: 10px; background: rgba(7, 11, 17, .52); }
      .fet-outlook-block small { color: var(--fet-muted); font-size: 10px; }
      .fet-outlook-block strong { color: #dce5f1; font-size: 11.5px; line-height: 1.4; }
      .fet-empty-quarter,
      .fet-empty-experience { display: grid; gap: 7px; margin: 12px; padding: 18px; border: 1px dashed var(--fet-line-strong); border-radius: 15px; background: rgba(15, 23, 42, .24); text-align: center; }
      .fet-empty-quarter strong,
      .fet-empty-experience strong { font-size: 14px; }
      .fet-empty-quarter span,
      .fet-empty-experience p { margin: 0; color: var(--fet-muted); font-size: 12px; line-height: 1.6; }
      .fet-empty-experience > span { color: var(--fet-blue); font-weight: 800; }
    }
    @media (max-width: 374px) {
      .fet-quarter-pill { min-width: 132px; }
      .fet-table th,
      .fet-table td { padding-inline: 5px; }
      .fet-table thead th { font-size: 10px; }
      .fet-table tbody th strong,
      .fet-table tbody td { font-size: 11.5px; }
      .fet-result strong { font-size: 10.5px; }
      .fet-result small { font-size: 9.5px; }
    }
  `;
  document.head.append(style);
}

const store = currentStore();
store?.subscribe?.(scheduleEnhancement);
const app = document.getElementById("app");
if (app) new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
window.addEventListener("resize", scheduleEnhancement, { passive: true });
window.addEventListener("pageshow", scheduleEnhancement);
scheduleEnhancement();
