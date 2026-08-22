import { auditFinancialReport } from "./financialSafety.js";

const QUARTERLY_IMPORT_METHOD = "quarterly_earnings_lite";
const REVALUATION_IMPORT_METHOD = "earnings_revaluation";

export function installDecisionReadinessUi(store, root = document.getElementById("app")) {
  if (!store || store.__decisionReadinessUiInstalled) return;
  store.__decisionReadinessUiInstalled = true;
  const render = () => renderDecisionReadiness(store, root);
  store.subscribe(render);
  if (root) new MutationObserver(render).observe(root, { childList: true, subtree: true });
  setTimeout(render, 0);
}

export function classifyDecisionReadiness(report = {}) {
  const audit = auditFinancialReport(report);
  const importMethod = report.metadata?.importMethod;
  const isQuarterly = importMethod === QUARTERLY_IMPORT_METHOD;
  const isRevaluation = importMethod === REVALUATION_IMPORT_METHOD;
  const missingQuarterSources = isQuarterly && report.metadata?.quarterlySourcesProvided !== true;
  if (!audit.valid || missingQuarterSources) {
    return {
      status: "blocked",
      asOfDate: inheritedDecisionDate(report),
      reasons: [
        ...audit.errors.map((item) => item.code),
        ...(missingQuarterSources ? ["QUARTERLY_SOURCE_PROVENANCE_MISSING"] : [])
      ]
    };
  }
  if (isQuarterly) {
    return {
      status: "quarterly_inherited",
      asOfDate: inheritedDecisionDate(report),
      reasons: ["FAIR_VALUE_AND_DECISION_INHERITED"]
    };
  }
  if (isRevaluation) {
    return {
      status: "earnings_revalued",
      asOfDate: report.metadata?.decisionAsOfDate || report.analysisDate || null,
      reasons: ["POST_EARNINGS_REVALUATION"]
    };
  }
  return {
    status: "full_analysis_as_of",
    asOfDate: report.metadata?.decisionAsOfDate || report.analysisDate || null,
    reasons: []
  };
}

function renderDecisionReadiness(store, root) {
  if (!root) return;
  ensureStyles();
  const ar = document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";
  root.querySelectorAll(".v31-library-stock-row[data-external-report-id]").forEach((card) => {
    const report = findReportById(store.state.externalAnalyses, card.dataset.externalReportId);
    if (!report) return;
    const readiness = classifyDecisionReadiness(report);
    let badge = card.querySelector(".franklin-card-readiness");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "franklin-card-readiness";
      card.append(badge);
    }
    badge.dataset.status = readiness.status;
    badge.textContent = readinessLabel(readiness, ar);
    card.classList.toggle("franklin-decision-blocked", readiness.status === "blocked");
  });
}

function readinessLabel(readiness, ar) {
  const date = readiness.asOfDate || "—";
  if (readiness.status === "blocked") {
    return ar ? "غير جاهز للقرار — راجع تنبيهات التقرير" : "Not decision-ready — review report warnings";
  }
  if (readiness.status === "quarterly_inherited") {
    return ar
      ? `تحديث أرباح — القرار وFair Value موروثان كما في ${date}`
      : `Earnings update — decision and fair value inherited as of ${date}`;
  }
  if (readiness.status === "earnings_revalued") {
    return ar
      ? `إعادة تقييم بعد الأرباح كما في ${date}`
      : `Post-earnings revaluation as of ${date}`;
  }
  return ar ? `تحليل كامل كما في ${date}` : `Full analysis as of ${date}`;
}

function inheritedDecisionDate(report = {}) {
  return report.metadata?.decisionAsOfDate
    || report.metadata?.baseAnalysisDate
    || report.metadata?.valuationAsOfDate
    || report.analysisDate
    || null;
}

function findReportById(collection = {}, id = "") {
  for (const reports of Object.values(collection || {})) {
    const report = (Array.isArray(reports) ? reports : []).find((item) => item.id === id);
    if (report) return report;
  }
  return null;
}

function ensureStyles() {
  if (document.getElementById("franklin-decision-readiness-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-decision-readiness-styles";
  style.textContent = `
    .franklin-card-readiness{grid-column:1/-1;margin-top:8px;padding:7px 9px;border-radius:10px;border:1px solid rgba(96,165,250,.28);background:rgba(96,165,250,.07);font-size:10px;line-height:1.45;color:var(--muted,#9aa1b6)}
    .franklin-card-readiness[data-status="quarterly_inherited"]{border-color:rgba(245,158,11,.4);background:rgba(245,158,11,.08);color:#fcd34d}
    .franklin-card-readiness[data-status="earnings_revalued"]{border-color:rgba(52,211,153,.4);background:rgba(52,211,153,.08);color:#6ee7b7}
    .franklin-card-readiness[data-status="blocked"]{border-color:rgba(244,63,94,.52);background:rgba(244,63,94,.09);color:#fda4af;font-weight:750}
    .v31-library-stock-row.franklin-decision-blocked{box-shadow:inset 0 0 0 1px rgba(244,63,94,.2)}
  `;
  document.head.append(style);
}
