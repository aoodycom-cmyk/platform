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

function workflowQuarterContext(store) {
  const workflow = store?.state?.earningsUpdate || {};
  const quarter = Number(workflow.selectedQuarter);
  const year = Number(workflow.selectedYear);
  if ([1, 2, 3, 4].includes(quarter) && Number.isInteger(year)) {
    return {
      ticker: String(workflow.ticker || store?.state?.externalReportSelection?.ticker || "").trim(),
      quarter,
      year
    };
  }
  return selectedQuarterContext();
}

function selectedReport(store) {
  const selection = store?.state?.externalReportSelection;
  if (!selection?.ticker) return null;
  const reports = store.state.externalAnalyses?.[selection.ticker] || [];
  return reports.find((item) => item.id === selection.reportId) || reports[0] || null;
}

function periodKey(value) {
  const match = String(value || "").trim().toUpperCase().match(/Q\s*([1-4]).*?(20\d{2})/);
  if (!match) return null;
  return Number(match[2]) * 4 + Number(match[1]);
}

function selectedPeriod(context) {
  return context ? `Q${context.quarter} ${context.year}` : "";
}

function shouldUseQuarterObservation(report, context) {
  if (!report || !context) return false;
  const selected = periodKey(selectedPeriod(context));
  if (!selected) return false;

  const requirements = report.priceTargetRequirements || {};
  const target = periodKey(requirements.targetQuarter || requirements.earningsPeriod);
  const current = periodKey(report.reportPeriod);

  // Full canonical revaluation is only safe for the open requirement-set quarter.
  // Any other explicitly selected quarter becomes an observation/backfill so newer
  // investment state is not rewritten from an out-of-sequence quarter.
  if (target && selected !== target) return true;
  if (!target && current && selected <= current) return true;
  return false;
}

function buildQuarterObservationPrompt(report, context) {
  const period = selectedPeriod(context);
  return [
    `هذه عملية تعبئة ربع تاريخي/خارج دورة إعادة التقييم الحالية للربع ${period}.`,
    `حلل ${period} فقط حتى لو كانت نتائج Q2 أو Q3 أو Q4 أو أي نتائج أحدث متاحة اليوم.`,
    "هذه القراءة لا تغيّر Fair Value ولا القرار ولا تعيد بناء nextRequirements الحالية؛ هدفها تسجيل ما حدث فعليًا في الربع المحدد ومقارنته بالمتطلبات فقط عندما يكون ذلك صالحًا.",
    "ضع reportDate كتاريخ إعلان أرباح هذا الربع الفعلي، وليس تاريخ اليوم، حتى يبقى التسلسل التاريخي صحيحًا داخل Franklin.",
    "",
    buildQuarterlyEarningsLitePrompt(report, {
      quarter: context.quarter,
      year: context.year,
      earningsText: ""
    })
  ].join("\n");
}

function ensureQuarterObservationPrompt() {
  const store = currentStore();
  const workflow = store?.state?.earningsUpdate;
  if (!store || !workflow?.open || workflow.quarterlyObservationOnly) return;

  const context = workflowQuarterContext(store);
  const report = selectedReport(store);
  if (!context || !report || !shouldUseQuarterObservation(report, context)) return;

  const prompt = buildQuarterObservationPrompt(report, context);
  store.set({
    earningsUpdate: {
      ...workflow,
      generatedPrompt: prompt,
      quarterlyObservationOnly: true,
      historicalBackfill: periodKey(selectedPeriod(context)) <= (periodKey(report.reportPeriod) || Number.POSITIVE_INFINITY)
    },
    notice: ""
  });
}

function decorateOnePageMode() {
  const store = currentStore();
  const workflow = store?.state?.earningsUpdate;
  const sheet = document.querySelector(".earnings-update-sheet");
  if (!workflow?.open || !workflow.quarterlyObservationOnly || !sheet) return;

  const title = sheet.querySelector(".earnings-one-page-head h3");
  if (title) title.textContent = "تحليل ربع تاريخي";
  const note = sheet.querySelector(".earnings-one-page-note");
  if (note) note.textContent = "سيقرأ ChatGPT الربع المحدد فقط. هذه العملية تسجل نتائج الربع ولا تغيّر Fair Value أو القرار الحالي.";
  const periodLock = sheet.querySelector(".earnings-period-lock small");
  if (periodLock) periodLock.textContent = "الربع مقفول تاريخيًا؛ لن يستبدله Franklin بربع أحدث.";
}

function syncCloudTriggerVisibility() {
  const trigger = document.querySelector(".franklin-cloud-trigger");
  if (!trigger) return;
  const settingsVisible = Boolean(document.querySelector(".panel-settings"));
  trigger.hidden = !settingsVisible;
  trigger.tabIndex = settingsVisible ? 0 : -1;
  trigger.setAttribute("aria-hidden", settingsVisible ? "false" : "true");
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

function syncEnhancements() {
  ensureQuarterObservationPrompt();
  ensureLitePromptButton();
  decorateOnePageMode();
  syncCloudTriggerVisibility();
}

const observer = new MutationObserver(syncEnhancements);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("pageshow", syncEnhancements);
syncEnhancements();
