export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      document.dispatchEvent(new CustomEvent("franklin:pwa-error"));
    });
  });
}

export function watchOfflineState(callback) {
  const emit = () => callback(!navigator.onLine);
  window.addEventListener("online", emit);
  window.addEventListener("offline", emit);
  emit();
}
