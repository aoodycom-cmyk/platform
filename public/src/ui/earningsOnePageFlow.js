const SHEET_SELECTOR = ".earnings-update-sheet";
const STYLE_ID = "earnings-one-page-flow-styles";

let frame = 0;

function currentStore() {
  return window.__equityResearchStore || null;
}

function isArabicUi() {
  return document.documentElement.dir === "rtl" || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function scheduleEnhancement() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhanceOnePageFlow);
}

function enhanceOnePageFlow() {
  const store = currentStore();
  const workflow = store?.state?.earningsUpdate;
  const sheet = document.querySelector(SHEET_SELECTOR);
  if (!store || !workflow?.open || !sheet) return;

  if (workflow.step === "success") {
    store.closeEarningsUpdate?.();
    return;
  }

  ensureStyles();
  const errors = Array.isArray(workflow.validation?.errors) ? workflow.validation.errors : [];
  const signature = JSON.stringify({
    ticker: workflow.ticker || "",
    period: workflow.selectedPeriod || "",
    loading: Boolean(store.state.loading),
    responseText: workflow.responseText || "",
    errors: errors.map((item) => `${item?.field || ""}:${item?.message || ""}`)
  });
  if (sheet.dataset.onePageSignature === signature) return;
  sheet.dataset.onePageSignature = signature;

  const ticker = workflow.ticker || "-";
  const selectedPeriod = workflow.selectedPeriod || "-";
  const loading = Boolean(store.state.loading);
  sheet.innerHTML = `
    <header class="earnings-one-page-head">
      <div>
        <p class="eyebrow" dir="ltr">${escapeHtml(ticker)}</p>
        <h3>${isArabicUi() ? "تحليل إعلان الأرباح" : "Analyze Earnings"}</h3>
        <span>${isArabicUi() ? "انسخ البرومبت إلى ChatGPT، ثم ألصق JSON الناتج وحدّث التحليل مباشرة." : "Copy the prompt to ChatGPT, then paste the returned JSON and update the analysis."}</span>
      </div>
      <button type="button" class="icon-btn earnings-one-page-cancel" data-one-page-cancel>${isArabicUi() ? "إلغاء" : "Cancel"}</button>
    </header>

    <div class="earnings-period-lock">
      <span>${isArabicUi() ? "الربع المحدد للتحليل" : "Locked earnings period"}</span>
      <strong dir="ltr">${escapeHtml(selectedPeriod)}</strong>
      <small>${isArabicUi() ? "سيقبل Franklin نتيجة JSON المطابقة لهذا الربع فقط." : "Franklin will accept JSON matching this period only."}</small>
    </div>

    <div class="earnings-one-page-body">
      <button type="button" class="primary-btn earnings-copy-prompt" data-one-page-copy>
        ${isArabicUi() ? "نسخ برومبت تحليل الأرباح" : "Copy earnings analysis prompt"}
      </button>
      <p class="earnings-one-page-note">${isArabicUi() ? "يمكن لـ ChatGPT البحث في المصادر الرسمية إذا لم تلصق مواد الأرباح داخل Franklin." : "ChatGPT can use official sources if you did not paste earnings materials into Franklin."}</p>

      <label class="earnings-json-label" for="earnings-one-page-json">${isArabicUi() ? "نتيجة ChatGPT" : "ChatGPT result"}</label>
      <textarea id="earnings-one-page-json" class="paste-box earnings-json-box earnings-one-page-json" data-one-page-json placeholder="${isArabicUi() ? "الصق JSON الناتج من ChatGPT هنا" : "Paste the JSON returned by ChatGPT here"}">${escapeHtml(workflow.responseText || "")}</textarea>

      ${errors.length ? `<div class="earnings-one-page-errors" role="alert">${errors.map((item) => `<p><strong>${escapeHtml(item?.field || "JSON")}</strong><span>${escapeHtml(item?.message || "")}</span></p>`).join("")}</div>` : ""}
      <div class="earnings-one-page-feedback" data-one-page-feedback aria-live="polite"></div>

      <button type="button" class="primary-btn earnings-update-now" data-one-page-update ${loading ? "disabled" : ""}>
        ${loading ? (isArabicUi() ? "جاري فحص JSON..." : "Validating JSON...") : (isArabicUi() ? "تحديث التحليل" : "Update analysis")}
      </button>
    </div>
  `;

  sheet.querySelector("[data-one-page-cancel]")?.addEventListener("click", () => store.closeEarningsUpdate?.());
  sheet.querySelector("[data-one-page-copy]")?.addEventListener("click", () => copyCanonicalPrompt(store, sheet));
  sheet.querySelector("[data-one-page-update]")?.addEventListener("click", () => commitJson(store, sheet));
}

async function copyCanonicalPrompt(store, sheet) {
  const text = store.currentEarningsUpdatePrompt?.() || "";
  if (!text) {
    setFeedback(sheet, isArabicUi() ? "تعذر تجهيز البرومبت." : "Could not prepare the prompt.", true);
    return;
  }
  try {
    await copyText(text);
    setFeedback(sheet, isArabicUi() ? "تم نسخ برومبت تحليل الأرباح ✓" : "Earnings analysis prompt copied ✓");
  } catch {
    setFeedback(sheet, isArabicUi() ? "تعذر النسخ تلقائيًا. أعد المحاولة من المتصفح." : "Automatic copy failed. Please try again.", true);
  }
}

async function commitJson(store, sheet) {
  const textarea = sheet.querySelector("[data-one-page-json]");
  const rawText = String(textarea?.value || "").trim();
  if (!rawText) {
    setFeedback(sheet, isArabicUi() ? "الصق JSON الناتج من ChatGPT أولًا." : "Paste the ChatGPT JSON first.", true);
    return;
  }

  const button = sheet.querySelector("[data-one-page-update]");
  if (button) button.disabled = true;
  await store.parseEarningsUpdateJson?.(rawText);

  const latest = store.state.earningsUpdate || {};
  if (!latest.validation?.valid || !latest.parsedReport) {
    scheduleEnhancement();
    return;
  }

  store.saveEarningsUpdate?.();
  if (store.state.earningsUpdate?.step === "success") {
    store.closeEarningsUpdate?.();
  } else {
    scheduleEnhancement();
  }
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "");
  Object.assign(fallback.style, { position: "fixed", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(fallback);
  fallback.select();
  const copied = document.execCommand?.("copy");
  fallback.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

function setFeedback(sheet, message, isError = false) {
  const feedback = sheet.querySelector("[data-one-page-feedback]");
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle("error", isError);
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .earnings-one-page-head { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-bottom:18px; }
    .earnings-one-page-head h3 { margin:4px 0 8px; }
    .earnings-one-page-head > div > span { display:block; color:var(--muted, #94a3b8); line-height:1.65; }
    .earnings-one-page-cancel { flex:0 0 auto; }
    .earnings-one-page-body { display:grid; gap:12px; }
    .earnings-one-page-note { margin:0 0 4px; color:var(--muted, #94a3b8); font-size:12px; line-height:1.65; }
    .earnings-json-label { font-size:13px; font-weight:700; }
    .earnings-one-page-json { min-height:250px; }
    .earnings-one-page-errors { display:grid; gap:8px; padding:12px; border:1px solid rgba(248,113,113,.34); border-radius:14px; background:rgba(127,29,29,.10); }
    .earnings-one-page-errors p { display:grid; gap:2px; margin:0; font-size:12px; line-height:1.55; }
    .earnings-one-page-errors strong { color:#fca5a5; }
    .earnings-one-page-errors span { color:var(--muted, #cbd5e1); }
    .earnings-one-page-feedback { min-height:20px; font-size:12px; color:#5eead4; }
    .earnings-one-page-feedback.error { color:#fca5a5; }
    .earnings-copy-prompt, .earnings-update-now { width:100%; min-height:52px; }
    @media (max-width: 899px) {
      .earnings-one-page-head { align-items:flex-start; }
      .earnings-one-page-json { min-height:310px; }
    }
  `;
  document.head.append(style);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const store = currentStore();
store?.subscribe?.(scheduleEnhancement);
new MutationObserver(scheduleEnhancement).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("pageshow", scheduleEnhancement);
window.addEventListener("resize", scheduleEnhancement, { passive: true });
scheduleEnhancement();
