import { auditFinancialReport } from "./financialSafety.js";

const QUARTERLY_IMPORT_METHOD = "quarterly_earnings_lite";
const SOFT_ASSESSMENT_CODES = new Set(["TARGET_ASSESSMENT_MISSING", "TARGET_ASSESSMENT_INCONSISTENT"]);

export function installCommercialUx(store, root = document.getElementById("app")) {
  if (!store || !root || store.__commercialUxInstalled) return;
  store.__commercialUxInstalled = true;
  ensureStyles();

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => renderCommercialStatus(store, root));
  };

  store.subscribe(schedule);
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  schedule();
}

function renderCommercialStatus(store, root) {
  const oldFinancial = root.querySelector(".franklin-financial-safety-banner");
  const oldSources = root.querySelector(".franklin-quarterly-source-warning");
  if (oldFinancial) oldFinancial.hidden = true;
  if (oldSources) oldSources.hidden = true;

  const appBar = root.querySelector(".report-app-bar");
  const current = root.querySelector(".franklin-analysis-status");
  if (!appBar) {
    current?.remove();
    return;
  }

  const report = selectedReport(store.state);
  if (!report || report.metadata?.importMethod !== QUARTERLY_IMPORT_METHOD) {
    current?.remove();
    return;
  }

  const ar = document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";
  const audit = auditFinancialReport(report);
  const hardErrors = audit.errors.filter((item) => !SOFT_ASSESSMENT_CODES.has(item.code));
  const assessmentErrors = audit.errors.filter((item) => SOFT_ASSESSMENT_CODES.has(item.code));
  const sourceMissing = report.metadata?.quarterlySourcesProvided !== true;
  const items = [];

  items.push({
    severity: "info",
    title: ar ? "التقييم الحالي من آخر تحليل كامل" : "Valuation from the latest full analysis",
    summary: ar
      ? "نتائج هذا الربع معروضة للمراجعة، بينما القيمة العادلة والقرار يبقيان كما كانا حتى إعادة التقييم."
      : "This quarter is shown for review while fair value and the decision remain unchanged until revaluation.",
    detail: ar
      ? `الفترة: ${report.reportPeriod || "—"}. تاريخ قرار التقييم: ${inheritedDecisionDate(report) || "غير محدد"}.`
      : `Period: ${report.reportPeriod || "—"}. Valuation decision date: ${inheritedDecisionDate(report) || "not specified"}.`
  });

  if (assessmentErrors.length) {
    items.push({
      severity: "warning",
      title: ar ? "تقييم الربع غير مكتمل" : "Quarter assessment is incomplete",
      summary: ar ? "بعض نتائج المتطلبات لا تزال تحتاج اكتمال التقييم قبل الاعتماد على ملخص الربع." : "Some requirement results still need assessment before the quarter summary is relied on.",
      detail: assessmentErrors.map((item) => item.message).join(" • ")
    });
  }

  if (sourceMissing) {
    items.push({
      severity: "warning",
      title: ar ? "مصدر نتائج الربع يحتاج توثيق" : "Quarter source needs verification",
      summary: ar ? "أضف مصدرًا خاصًا بنتائج هذا الربع قبل اعتماد التحديث." : "Add a quarter-specific source before relying on this update.",
      detail: ar ? "يقبل Franklin مصدر الشركة الرسمي أو SEC أو مواد الأرباح المرفقة الموثقة." : "Franklin accepts company IR, SEC, or traceable user-provided earnings materials."
    });
  }

  if (hardErrors.length) {
    items.unshift({
      severity: "critical",
      title: ar ? "التحليل يحتاج تصحيحًا قبل الاعتماد" : "Analysis requires correction before use",
      summary: ar ? "اكتشف Franklin تعارضًا يؤثر في سلامة التقرير." : "Franklin found an integrity conflict that affects this report.",
      detail: hardErrors.map((item) => item.message).join(" • ")
    });
  }

  const severity = items.some((item) => item.severity === "critical")
    ? "critical"
    : items.some((item) => item.severity === "warning") ? "warning" : "info";
  const primary = items.find((item) => item.severity === severity) || items[0];
  const status = current || document.createElement("section");
  status.className = "franklin-analysis-status";
  status.dataset.severity = severity;
  status.setAttribute("aria-label", ar ? "حالة التحليل" : "Analysis status");
  status.innerHTML = `
    <div class="franklin-analysis-status__main">
      <span class="franklin-analysis-status__dot" aria-hidden="true"></span>
      <div>
        <small>${ar ? "حالة التحليل" : "Analysis status"}</small>
        <strong>${escapeHtml(primary.title)}</strong>
        <p>${escapeHtml(primary.summary)}</p>
      </div>
    </div>
    <details class="franklin-analysis-status__details">
      <summary>${ar ? "التفاصيل" : "Details"}</summary>
      ${items.map((item) => `<div class="franklin-analysis-status__item" data-severity="${item.severity}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.detail)}</span></div>`).join("")}
    </details>
  `;

  if (!current) appBar.insertAdjacentElement("afterend", status);
}

function selectedReport(state = {}) {
  const selection = state.externalReportSelection || {};
  const ticker = String(selection.ticker || "").trim().toUpperCase();
  if (!ticker) return null;
  const reports = state.externalAnalyses?.[ticker] || [];
  return reports.find((item) => item.id === selection.reportId) || reports[0] || null;
}

function inheritedDecisionDate(report = {}) {
  return report.metadata?.decisionAsOfDate
    || report.metadata?.baseAnalysisDate
    || report.metadata?.valuationAsOfDate
    || report.analysisDate
    || null;
}

function ensureStyles() {
  if (document.getElementById("franklin-commercial-status-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-commercial-status-styles";
  style.textContent = `
    .franklin-financial-safety-banner[hidden],.franklin-quarterly-source-warning[hidden]{display:none!important}
    .franklin-analysis-status{margin:8px 14px 14px;padding:12px 14px;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:rgba(17,24,39,.54);box-shadow:none;color:var(--ink,#f8fafc)}
    .franklin-analysis-status__main{display:flex;gap:10px;align-items:flex-start}
    .franklin-analysis-status__dot{width:8px;height:8px;border-radius:50%;margin-top:8px;flex:0 0 auto;background:#60a5fa}
    .franklin-analysis-status[data-severity="warning"] .franklin-analysis-status__dot{background:#f59e0b}
    .franklin-analysis-status[data-severity="critical"]{border-color:rgba(244,63,94,.28);background:rgba(127,29,29,.10)}
    .franklin-analysis-status[data-severity="critical"] .franklin-analysis-status__dot{background:#fb7185}
    .franklin-analysis-status__main small{display:block;margin-bottom:2px;color:var(--muted,#94a3b8);font-size:10px;font-weight:700;letter-spacing:.02em}
    .franklin-analysis-status__main strong{display:block;font-size:13px;line-height:1.45}
    .franklin-analysis-status__main p{margin:3px 0 0;color:var(--ink-soft,#cbd5e1);font-size:11px;line-height:1.55}
    .franklin-analysis-status__details{margin-top:8px;padding-top:8px;border-top:1px solid rgba(148,163,184,.10)}
    .franklin-analysis-status__details summary{cursor:pointer;color:var(--muted,#94a3b8);font-size:10px;font-weight:700;list-style:none}
    .franklin-analysis-status__details summary::-webkit-details-marker{display:none}
    .franklin-analysis-status__item{display:grid;gap:3px;margin-top:8px;padding:8px 0;border-top:1px solid rgba(148,163,184,.08)}
    .franklin-analysis-status__item:first-of-type{border-top:0}
    .franklin-analysis-status__item b{font-size:11px;font-weight:750}
    .franklin-analysis-status__item span{color:var(--muted,#94a3b8);font-size:10px;line-height:1.55}
    .franklin-analysis-status__item[data-severity="warning"] b{color:#fbbf24}
    .franklin-analysis-status__item[data-severity="critical"] b{color:#fda4af}
    .franklin-card-readiness{width:max-content;max-width:100%;border:0!important;border-radius:999px!important;background:rgba(59,130,246,.08)!important;padding:5px 9px!important;font-size:9px!important;font-weight:650!important;color:var(--muted,#94a3b8)!important}
    .franklin-card-readiness[data-status="quarterly_inherited"]{background:rgba(245,158,11,.08)!important;color:#d6a74c!important}
    .franklin-card-readiness[data-status="blocked"]{background:rgba(244,63,94,.08)!important;color:#e89aa8!important}
    .v31-library-stock-row.franklin-decision-blocked{box-shadow:none!important}
  `;
  document.head.append(style);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
