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
    if (text.indexOf("Safari لم يكمل فتح Franklin") !== -1 || text.indexOf("تعذر تحميل Franklin بأمان") !== -1) {
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
