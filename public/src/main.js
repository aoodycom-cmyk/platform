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
import { installDecisionReadinessUi } from "./financialSafety/decisionReadinessUi.js";

const root = document.getElementById("app");
const APP_STATE_KEY = "equityResearchV4State";
const BOOT_BACKUP_PREFIX = "franklinBootRecoveryBackup:";
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

const bootRecovery = createRecoveredStore();
if (!bootRecovery.store) {
  renderBootFailure(root, bootRecovery.error, bootRecovery.originalError);
  throw bootRecovery.error;
}
const { store } = bootRecovery;

// Internal UI helpers can reuse the single live store without creating a second app state.
window.__equityResearchStore = store;
installFinancialSafetyLayer(store, root);
installQuarterlySourceSafety(store, root);
installDecisionReadinessUi(store, root);

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
} else if (bootRecovery.recovered) {
  store.set({
    notice: store.state.language === "ar"
      ? "تم فتح Franklin بعد إصلاح بيانات محلية قديمة كانت تمنع التشغيل. احتفظنا بنسخة احتياطية داخل المتصفح."
      : "Franklin opened after recovering old local data that blocked startup. A browser-local backup was kept."
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

function createRecoveredStore() {
  try {
    return { store: createStore(), recovered: false, error: null, originalError: null };
  } catch (error) {
    backupAndClearLocalState(error);
    try {
      return { store: createStore(), recovered: true, error: null, originalError: error };
    } catch (retryError) {
      return { store: null, recovered: false, error: retryError, originalError: error };
    }
  }
}

function backupAndClearLocalState(error) {
  try {
    const previous = localStorage.getItem(APP_STATE_KEY);
    if (previous !== null) {
      const backupKey = `${BOOT_BACKUP_PREFIX}${new Date().toISOString()}`;
      localStorage.setItem(backupKey, JSON.stringify({
        reason: String(error?.message || error || "BOOT_ERROR"),
        savedAt: new Date().toISOString(),
        state: previous
      }));
    }
    localStorage.removeItem(APP_STATE_KEY);
  } catch (_) {}
}

function renderBootFailure(target, error, originalError) {
  if (!target) return;
  const detail = escapeBootText(String(error?.message || originalError?.message || error || "Unknown startup error"));
  target.innerHTML = `
    <main dir="rtl" style="min-height:100svh;display:grid;place-items:center;padding:24px;background:#07080d;color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
      <section style="width:min(100%,520px);border:1px solid rgba(148,163,184,.28);background:#111422;border-radius:18px;padding:22px;box-shadow:0 24px 80px rgba(0,0,0,.35)">
        <p style="margin:0 0 8px;color:#2dd4bf;font-weight:800">Franklin Research</p>
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.35">تعذر فتح التطبيق تلقائيًا</h1>
        <p style="margin:0 0 14px;color:#cbd5e1;line-height:1.8">حذف بيانات Franklin المحلية من إعدادات الموقع ثم تحديث الصفحة يحل هذه الحالة غالبًا.</p>
        <code dir="ltr" style="display:block;white-space:pre-wrap;word-break:break-word;background:#0b0d16;border:1px solid rgba(148,163,184,.22);border-radius:12px;padding:12px;color:#fca5a5">${detail}</code>
      </section>
    </main>
  `;
}

function escapeBootText(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
