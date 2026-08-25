import { createStore } from "./state/store.js";
import { mountApp } from "./ui/components.js";
import { migrateFranklinState, summarizeFranklinState } from "./state/migration.js";

const root = document.getElementById("app");
const APP_STATE_KEY = "equityResearchV4State";
const AUDIT_PREVIOUS_STATE_KEY = "franklinAuditPreviousLocalStateV1";

bootFranklin();

async function bootFranklin() {
  const cloud = await loadOptional("./cloud/franklinCloud.js", "Franklin Cloud");
  let auditBootstrapError = null;

  restorePreviousAuditState();
  try {
    await cloud.bootstrapAuditSnapshot?.();
    if (window.__FRANKLIN_AUDIT_MODE?.readOnly && window.__FRANKLIN_BOOTSTRAP_STATE) {
      if (sessionStorage.getItem(AUDIT_PREVIOUS_STATE_KEY) === null) {
        const previous = localStorage.getItem(APP_STATE_KEY);
        sessionStorage.setItem(AUDIT_PREVIOUS_STATE_KEY, previous === null ? "__FRANKLIN_NONE__" : previous);
      }
      localStorage.setItem(APP_STATE_KEY, JSON.stringify(window.__FRANKLIN_BOOTSTRAP_STATE));
    }
  } catch (error) {
    auditBootstrapError = error;
    recordBootIssue("audit-bootstrap", error);
  }

  try {
    const store = createStore();
    window.__equityResearchStore = store;
    mountApp(root, store);
    signalBootReady(root);
    await installOptionalRuntime(store, cloud, auditBootstrapError);
  } catch (error) {
    recordBootIssue("core-boot", error);
    showBootFailure(error);
  }
}

function restorePreviousAuditState() {
  const hasAuditToken = /(?:^#|&)audit=/.test(String(window.location.hash || ""));
  try {
    if (!hasAuditToken && sessionStorage.getItem(AUDIT_PREVIOUS_STATE_KEY) !== null) {
      const previous = sessionStorage.getItem(AUDIT_PREVIOUS_STATE_KEY);
      if (previous === "__FRANKLIN_NONE__") localStorage.removeItem(APP_STATE_KEY);
      else localStorage.setItem(APP_STATE_KEY, previous);
      sessionStorage.removeItem(AUDIT_PREVIOUS_STATE_KEY);
    }
  } catch (error) {
    recordBootIssue("audit-restore", error);
  }
}

async function installOptionalRuntime(store, cloud, auditBootstrapError) {
  await Promise.all([
    loadOptional("./ui/mobile2Enhancer.js", "Mobile enhancer"),
    loadOptional("./ui/quarterlyResultsEnhancer.js", "Quarterly results enhancer"),
    loadOptional("./ui/quarterlyScorecardMobileFigma.js", "Quarterly scorecard mobile UI"),
    loadOptional("./ui/quarterlyEarningsEntry.js", "Quarterly earnings entry"),
    loadOptional("./ui/quarterlyEarningsJsonPromptV2.js", "Quarterly JSON prompt"),
    loadOptional("./ui/socialImageExport.js", "Social image export"),
    loadOptional("./ui/socialImageExportQualityPatch.js", "Social image export HD quality")
  ]);

  await installFinancialGuards(store);
  await installQuarterlyResolver(store);
  try {
    cloud.mountCloudControls?.(store);
  } catch (error) {
    recordBootIssue("cloud-controls", error);
  }

  if (auditBootstrapError) {
    store.set({
      notice: store.state.language === "ar"
        ? `تعذر فتح جلسة الفحص: ${String(auditBootstrapError?.message || auditBootstrapError)}`
        : `Could not open audit session: ${String(auditBootstrapError?.message || auditBootstrapError)}`
    });
  }

  await installPwaRuntime(store);
}

async function installFinancialGuards(store) {
  const [financialSafety, quarterlySourceSafety, decisionReadiness] = await Promise.all([
    loadOptional("./financialSafety/financialSafety.js", "Financial safety"),
    loadOptional("./financialSafety/quarterlySourceSafety.js", "Quarterly source safety"),
    loadOptional("./financialSafety/decisionReadinessUi.js", "Decision readiness")
  ]);
  try {
    financialSafety.installFinancialSafetyLayer?.(store, root);
    quarterlySourceSafety.installQuarterlySourceSafety?.(store, root);
    decisionReadiness.installDecisionReadinessUi?.(store, root);
  } catch (error) {
    recordBootIssue("financial-guards", error);
  }
}

async function installQuarterlyResolver(store) {
  const [storage, parser] = await Promise.all([
    loadOptional("./externalAnalysis/storage.js", "External analysis storage"),
    loadOptional("./externalAnalysis/parser.js", "External analysis parser")
  ]);
  if (!storage.getExternalAnalysis || !parser.setQuarterlyEarningsLiteReportResolver) return;
  parser.setQuarterlyEarningsLiteReportResolver((payload) => {
    const state = store.state;
    if (!state.earningsUpdate?.open) return null;
    const selection = state.externalReportSelection || {};
    const selectedTicker = String(selection.ticker || state.earningsUpdate?.ticker || "").trim().toUpperCase();
    const incomingTicker = String(payload?.ticker || "").trim().toUpperCase();
    if (!selectedTicker || (incomingTicker && incomingTicker !== selectedTicker)) return null;
    return storage.getExternalAnalysis(state.externalAnalyses, selectedTicker, selection.reportId || state.earningsUpdate?.reportId || "latest");
  });
}

async function installPwaRuntime(store) {
  const pwa = await loadOptional("./pwa.js", "PWA runtime");
  try {
    pwa.registerServiceWorker?.();
    pwa.watchOfflineState?.((offline) => {
      if (offline) {
        store.set({ notice: store.state.language === "ar"
          ? "أنت غير متصل. الأسعار المعروضة في التقارير هي أسعار وقت التحليل وليست أسعارًا حية."
          : "You are offline. Prices shown in saved reports are prices at analysis, not live quotes." });
      }
    });
  } catch (error) {
    recordBootIssue("pwa-runtime", error);
  }
}

async function loadOptional(path, label) {
  try { return await import(path); }
  catch (error) { recordBootIssue(label, error); return {}; }
}

function signalBootReady(rootElement) {
  window.__FRANKLIN_APP_READY = true;
  if (rootElement) {
    rootElement.dataset.franklinMounted = "true";
    delete rootElement.dataset.franklinBootPlaceholder;
  }
  window.dispatchEvent(new Event("franklin:boot-ready"));
}

function recordBootIssue(type, error) {
  if (!Array.isArray(window.__FRANKLIN_BOOT_EVENTS)) window.__FRANKLIN_BOOT_EVENTS = [];
  window.__FRANKLIN_BOOT_EVENTS.push({ type, detail: String(error?.message || error || "Unknown boot issue").slice(0, 260), at: new Date().toISOString() });
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
    </main>`;
  root.querySelector("[data-action='retry-safe-boot']")?.addEventListener("click", () => window.location.reload());
  root.querySelector("[data-action='export-raw-state']")?.addEventListener("click", () => exportRawState(raw, diagnosticId));
}

function safeRawState() { try { return localStorage.getItem(APP_STATE_KEY) || ""; } catch { return ""; } }
function safeSummary(raw) { try { return summarizeFranklinState(migrateFranklinState(JSON.parse(raw || "{}")).state); } catch { return { tickerCount: 0, reportCount: 0, historicalRequirementSetCount: 0 }; } }
function metric(label, value) { return `<div class="settings-status"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`; }
function exportRawState(raw, diagnosticId) { const blob = new Blob([raw || "{}"], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${diagnosticId}-raw-state.json`; link.click(); URL.revokeObjectURL(url); }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
