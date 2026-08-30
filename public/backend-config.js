window.FRANKLIN_BACKEND_URL = "";
window.FRANKLIN_SUPABASE_URL = "https://djptdxocpslfowshbtir.supabase.co";
window.FRANKLIN_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5BLb5fpkzf4_7qgPb5smLw_XWMVSuPE";

// Keep normal boot visually silent. The existing Safari recovery guard remains available
// and is revealed only when a genuine boot failure replaces the initial placeholder.
(function installSilentBootPresentation() {
  var style = document.createElement("style");
  style.id = "franklin-silent-boot-style";
  style.textContent = '#app[data-franklin-boot-placeholder="true"]>main{visibility:hidden!important}';
  document.head.appendChild(style);

  function revealRecoveryIfNeeded() {
    var root = document.getElementById("app");
    if (!root || !style.isConnected) return;
    var text = String(root.textContent || "");
    if (text.indexOf("تعذر فتح فرانكلين") !== -1 || text.indexOf("تعذر تحميل Franklin بأمان") !== -1) {
      style.remove();
      observer.disconnect();
    }
  }

  var observer = new MutationObserver(revealRecoveryIfNeeded);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("franklin:boot-ready", function () {
    style.remove();
    observer.disconnect();
  }, { once: true });
}());

// Social image export is also bootstrapped from this generated file so the static
// GitHub Pages /docs deployment receives the feature immediately after a merge.
(function installSocialImageExportBootstrap() {
  function load() {
    import("./src/ui/socialImageExport.js?v=franklin-social-export-v1").catch(function (error) {
      if (!Array.isArray(window.__FRANKLIN_BOOT_EVENTS)) window.__FRANKLIN_BOOT_EVENTS = [];
      window.__FRANKLIN_BOOT_EVENTS.push({
        type: "Social image export",
        detail: String(error && (error.message || error) || "Could not load social image export").slice(0, 260),
        at: new Date().toISOString()
      });
    });
  }
  if (window.__FRANKLIN_APP_READY) load();
  else window.addEventListener("franklin:boot-ready", load, { once: true });
}());
