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
import { migrateFranklinState, summarizeFranklinState } from "./state/migration.js";

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

try {
  const store = createStore();

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
  }

  registerServiceWorker();
  watchOfflineState((offline) => {
    if (offline) {
      store.set({ notice: store.state.language === "ar"
        ? "أنت غير متصل. الأسعار المعروضة في التقارير هي أسعار وقت التحليل وليست أسعارًا حية."
        : "You are offline. Prices shown in saved reports are prices at analysis, not live quotes." });
    }
  });
} catch (error) {
  showBootFailure(error);
}

function showBootFailure(error) {
  const raw = safeRawState();
  const summary = safeSummary(raw);
  const diagnosticId = `franklin-${Date.now().toString(36)}`;
  const message = String(error?.message || error || "Unknown boot error");
  if (!root) return;
  root.innerHTML = `
    <main class="mobile-app-shell">
      <section class="mobile-app-frame">
        <div class="mobile-page-content">
          <section class="panel boot-failure-panel">
            <p class="eyebrow">Franklin Recovery</p>
            <h2>تعذر تحميل Franklin بأمان</h2>
            <p>لم يتم حذف بياناتك. احتفظ Franklin بالحالة الخام ويمكنك تصديرها أو المحاولة مرة أخرى بعد الاستعادة الآمنة.</p>
            <div class="settings-grid">
              ${metric("Diagnostic ID", diagnosticId)}
              ${metric("Detected reports", summary.reportCount)}
              ${metric("Companies", summary.tickerCount)}
              ${metric("Requirement sets", summary.historicalRequirementSetCount)}
            </div>
            <code class="boot-error-message">${escapeHtml(message)}</code>
            <div class="restore-actions">
              <button class="primary-btn" data-action="retry-safe-boot">Retry Safe Boot</button>
              <button class="icon-btn" data-action="export-raw-state">Export Raw State</button>
            </div>
          </section>
        </div>
      </section>
    </main>
  `;
  root.querySelector("[data-action='retry-safe-boot']")?.addEventListener("click", () => window.location.reload());
  root.querySelector("[data-action='export-raw-state']")?.addEventListener("click", () => exportRawState(raw, diagnosticId));
}

function safeRawState() {
  try {
    return localStorage.getItem(APP_STATE_KEY) || "";
  } catch {
    return "";
  }
}

function safeSummary(raw) {
  try {
    return summarizeFranklinState(migrateFranklinState(JSON.parse(raw || "{}")).state);
  } catch {
    return { tickerCount: 0, reportCount: 0, historicalRequirementSetCount: 0 };
  }
}

function metric(label, value) {
  return `<div class="settings-status"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`;
}

function exportRawState(raw, diagnosticId) {
  const blob = new Blob([raw || "{}"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${diagnosticId}-raw-state.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
