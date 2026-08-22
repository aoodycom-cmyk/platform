import { createStore } from "./state/store.js";
import { mountApp } from "./ui/components.js";
import "./ui/mobile2Enhancer.js";
import "./ui/quarterlyResultsEnhancer.js";
import { getExternalAnalysis } from "./externalAnalysis/storage.js";
import { setQuarterlyEarningsLiteReportResolver } from "./externalAnalysis/parser.js";
import { registerServiceWorker, watchOfflineState } from "./pwa.js";
import { bootstrapAuditSnapshot, mountCloudControls } from "./cloud/franklinCloud.js";
import { installFinancialSafetyLayer } from "./financialSafety/financialSafety.js";
import { installQuarterlySourceSafety } from "./financialSafety/quarterlySourceSafety.js";

const root = document.getElementById("app");
const APP_STATE_KEY = "equityResearchV4State";
const AUDIT_PREVIOUS_STATE_KEY = "franklinAuditPreviousLocalStateV1";
const hasAuditToken = /(?:^#|&)audit=/.test(String(window.location.hash || ""));

// Audit snapshots temporarily seed only the viewer's browser state. The original
// state is restored automatically after the audit fragment is removed.
if (!hasAuditToken && sessionStorage.getItem(AUDIT_PREVIOUS_STATE_KEY) !== null) {
  const previous = sessionStorage.getItem(AUDIT_PREVIOUS_STATE_KEY);
  if (previous === "__FRANKLIN_NONE__") localStorage.removeItem(APP_STATE_KEY);
  else localStorage.setItem(APP_STATE_KEY, previous);
  sessionStorage.removeItem(AUDIT_PREVIOUS_STATE_KEY);
}

let auditBootstrapError = null;
try {
  await bootstrapAuditSnapshot();
  if (window.__FRANKLIN_AUDIT_MODE?.readOnly && window.__FRANKLIN_BOOTSTRAP_STATE) {
    if (sessionStorage.getItem(AUDIT_PREVIOUS_STATE_KEY) === null) {
      const previous = localStorage.getItem(APP_STATE_KEY);
      sessionStorage.setItem(AUDIT_PREVIOUS_STATE_KEY, previous === null ? "__FRANKLIN_NONE__" : previous);
    }
    localStorage.setItem(APP_STATE_KEY, JSON.stringify(window.__FRANKLIN_BOOTSTRAP_STATE));
  }
} catch (error) {
  auditBootstrapError = error;
}

const store = createStore();

// Internal UI helpers can reuse the single live store without creating a second app state.
window.__equityResearchStore = store;
installFinancialSafetyLayer(store, root);
installQuarterlySourceSafety(store, root);

setQuarterlyEarningsLiteReportResolver((payload) => {
  const state = store.state;
  if (!state.earningsUpdate?.open) return null;
  const selection = state.externalReportSelection || {};
  const selectedTicker = String(selection.ticker || state.earningsUpdate?.ticker || "").trim().toUpperCase();
  const incomingTicker = String(payload?.ticker || "").trim().toUpperCase();
  if (!selectedTicker || (incomingTicker && incomingTicker !== selectedTicker)) return null;
  return getExternalAnalysis(
    state.externalAnalyses,
    selectedTicker,
    selection.reportId || state.earningsUpdate?.reportId || "latest"
  );
});

mountApp(root, store);
mountCloudControls(store);

if (auditBootstrapError) {
  store.set({
    notice: store.state.language === "ar"
      ? `تعذر فتح جلسة الفحص: ${String(auditBootstrapError?.message || auditBootstrapError)}`
      : `Could not open audit session: ${String(auditBootstrapError?.message || auditBootstrapError)}`
  });
}

registerServiceWorker();
watchOfflineState((offline) => {
  if (offline) {
    store.set({ notice: store.state.language === "ar"
      ? "أنت غير متصل. الأسعار المعروضة في التقارير هي أسعار وقت التحليل وليست أسعارًا حية."
      : "You are offline. Prices shown in saved reports are prices at analysis, not live quotes." });
  }
});
