import { createStore } from "./state/store.js";
import { mountApp } from "./ui/components.js";
import "./ui/mobile2Enhancer.js";
import "./ui/quarterlyResultsEnhancer.js";
import { getExternalAnalysis } from "./externalAnalysis/storage.js";
import { setQuarterlyEarningsLiteReportResolver } from "./externalAnalysis/parser.js";
import { registerServiceWorker, watchOfflineState } from "./pwa.js";

const root = document.getElementById("app");
const store = createStore();

// Internal UI helpers can reuse the single live store without creating a second app state.
window.__equityResearchStore = store;

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
registerServiceWorker();
watchOfflineState((offline) => {
  if (offline) {
    store.set({ notice: store.state.language === "ar"
      ? "أنت غير متصل. لن يتم عرض أسعار قديمة كأنها حالية."
      : "You are offline. Stale market prices will not be shown as current." });
  }
});
