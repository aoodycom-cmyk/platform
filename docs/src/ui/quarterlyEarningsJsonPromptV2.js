import "./earningsOnePageFlow.js";
import { buildQuarterlyEarningsLitePrompt } from "../externalAnalysis/quarterlyEarningsLite.js";

const CONTEXT_KEY = "quarterlyEarningsEntryContext";
const BUTTON_ATTR = "data-copy-quarterly-json-prompt";

function selectedQuarterContext() {
  const raw = sessionStorage.getItem(CONTEXT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const quarter = Number(value?.quarter);
    const year = Number(value?.year);
    if (![1, 2, 3, 4].includes(quarter) || !Number.isInteger(year)) return null;
    return { ticker: String(value?.ticker || "").trim(), quarter, year };
  } catch {
    return null;
  }
}

function currentStore() {
  return window.__equityResearchStore || null;
}

function selectedReport(store) {
  const selection = store?.state?.externalReportSelection;
  if (!selection?.ticker) return null;
  const reports = store.state.externalAnalyses?.[selection.ticker] || [];
  return reports.find((item) => item.id === selection.reportId) || reports[0] || null;
}

function ensureLitePromptButton() {
  const context = selectedQuarterContext();
  const store = currentStore();
  const sheet = document.querySelector(".earnings-update-sheet");
  if (!context || !store || !sheet) return;

  const pasteStep = sheet.querySelector("[data-earnings-field='earningsText']")?.closest(".earnings-update-body");
  if (!pasteStep || pasteStep.querySelector(`[${BUTTON_ATTR}]`)) return;

  const actions = pasteStep.querySelector(".earnings-update-actions");
  if (!actions) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn";
  button.setAttribute(BUTTON_ATTR, "");
  button.setAttribute("data-action", "copy-quick-earnings-read-prompt");
  button.innerHTML = `Quick Earnings Read <span dir="ltr">Q${context.quarter} ${context.year}</span>`;
  button.addEventListener("click", () => copyLitePrompt(context, pasteStep));
  actions.append(button);

  const hint = document.createElement("p");
  hint.className = "compact-empty-state quarterly-json-prompt-hint";
  hint.textContent = "اختياري وغير Canonical: قراءة سريعة للربع فقط، بدون تقييم سهم كامل أو Fair Value جديد.";
  actions.insertAdjacentElement("beforebegin", hint);
}

async function copyLitePrompt(context, pasteStep) {
  const store = currentStore();
  const report = selectedReport(store);
  const earningsInput = pasteStep.querySelector("[data-earnings-field='earningsText']");
  if (!store || !report || !earningsInput) return;

  const prompt = buildQuarterlyEarningsLitePrompt(report, {
    quarter: context.quarter,
    year: context.year,
    earningsText: earningsInput.value || ""
  });

  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(prompt);
    store.set({
      earningsUpdate: {
        ...store.state.earningsUpdate,
        generatedPrompt: prompt,
        step: 3
      },
      notice: ""
    });
    showLocalFeedback(`تم نسخ البرومبت المختصر لـ Q${context.quarter} ${context.year} ✓`);
  } catch {
    store.set({
      earningsUpdate: {
        ...store.state.earningsUpdate,
        generatedPrompt: prompt,
        step: 2
      },
      notice: ""
    });
    showLocalFeedback("تعذر النسخ التلقائي. ظهر البرومبت المختصر لنسخه يدويًا.", true);
  }
}

function showLocalFeedback(message, isError = false) {
  let feedback = document.querySelector(".quarterly-json-prompt-feedback");
  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "quarterly-json-prompt-feedback";
    Object.assign(feedback.style, {
      position: "fixed",
      zIndex: "9999",
      insetInline: "16px",
      bottom: "calc(96px + env(safe-area-inset-bottom))",
      maxWidth: "408px",
      marginInline: "auto",
      padding: "12px 14px",
      borderRadius: "12px",
      border: "1px solid rgba(96,165,250,.35)",
      background: "#111827",
      color: "#f8fafc",
      fontSize: "13px",
      lineHeight: "1.5",
      textAlign: "center",
      boxShadow: "0 14px 40px rgba(0,0,0,.38)"
    });
    document.body.appendChild(feedback);
  }
  feedback.style.borderColor = isError ? "rgba(248,113,113,.45)" : "rgba(52,211,153,.40)";
  feedback.textContent = message;
  clearTimeout(showLocalFeedback.timer);
  showLocalFeedback.timer = setTimeout(() => feedback.remove(), 2600);
}

const observer = new MutationObserver(ensureLitePromptButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("pageshow", ensureLitePromptButton);
ensureLitePromptButton();
