import { createStore } from "./state/store.js";
import { mountApp } from "./ui/components.js";
import "./ui/mobile2Enhancer.js";
import { registerServiceWorker, watchOfflineState } from "./pwa.js";

const root = document.getElementById("app");
const store = createStore();

// Internal UI helpers can reuse the single live store without creating a second app state.
window.__equityResearchStore = store;

mountApp(root, store);
registerServiceWorker();
watchOfflineState((offline) => {
  if (offline) {
    store.set({ notice: store.state.language === "ar"
      ? "أنت غير متصل. لن يتم عرض أسعار قديمة كأنها حالية."
      : "You are offline. Stale market prices will not be shown as current." });
  }
});
