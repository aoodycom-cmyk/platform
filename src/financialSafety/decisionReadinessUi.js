import { auditFinancialReport } from "./financialSafety.js";
import { installCommercialUx } from "./commercialUx.js";

const QUARTERLY_IMPORT_METHOD = "quarterly_earnings_lite";

export function installDecisionReadinessUi(store, root = document.getElementById("app")) {
  if (!store || store.__decisionReadinessUiInstalled) return;
  store.__decisionReadinessUiInstalled = true;
  if (root?.querySelector) installCommercialUx(store, root);

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => renderDecisionReadiness(store, root));
  };

  store.subscribe(schedule);
  if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  setTimeout(schedule, 0);
}

export function classifyDecisionReadiness(report = {}) {
  const audit = auditFinancialReport(report);
  const isQuarterly = report.metadata?.importMethod === QUARTERLY_IMPORT_METHOD;
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
    const label = readinessLabel(readiness, ar);
    if (badge.dataset.status !== readiness.status) badge.dataset.status = readiness.status;
    if (badge.textContent !== label) badge.textContent = label;
    const blocked = readiness.status === "blocked";
    if (card.classList.contains("franklin-decision-blocked") !== blocked) {
      card.classList.toggle("franklin-decision-blocked", blocked);
    }
  });
}

function readinessLabel(readiness, ar) {
  const date = readiness.asOfDate || "—";
  if (readiness.status === "blocked") {
    return ar ? "يحتاج مراجعة" : "Review needed";
  }
  if (readiness.status === "quarterly_inherited") {
    return ar ? `تحديث ربع سنوي · ${date}` : `Quarterly update · ${date}`;
  }
  return ar ? `تحليل كامل · ${date}` : `Full analysis · ${date}`;
}

function inheritedDecisionDate(report = {}) {
  return report.metadata?.decisionAsOfDate
    || report.metadata?.baseAnalysisDate
    || report.metadata?.valuationAsOfDate
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
    .franklin-card-readiness{grid-column:1/-1;margin-top:7px;width:max-content;max-width:100%;padding:5px 9px;border:0;border-radius:999px;background:rgba(59,130,246,.08);font-size:9px;line-height:1.35;font-weight:650;color:var(--muted,#94a3b8)}
    .franklin-card-readiness[data-status="quarterly_inherited"]{background:rgba(245,158,11,.07);color:#d6a74c}
    .franklin-card-readiness[data-status="blocked"]{background:rgba(244,63,94,.07);color:#e89aa8}
    .v31-library-stock-row.franklin-decision-blocked{box-shadow:none}
  `;
  document.head.append(style);
}
