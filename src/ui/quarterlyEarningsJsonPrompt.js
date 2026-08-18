const CONTEXT_KEY = "quarterlyEarningsEntryContext";
const BUTTON_ATTR = "data-copy-quarterly-json-prompt";

function selectedQuarterContext() {
  const raw = sessionStorage.getItem(CONTEXT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const quarter = Number(value?.quarter);
    const year = String(value?.year || "").trim();
    if (![1, 2, 3, 4].includes(quarter) || !/^\d{4}$/.test(year)) return null;
    return { ticker: String(value?.ticker || "").trim(), quarter, year };
  } catch {
    return null;
  }
}

function ensureJsonPromptButton() {
  const context = selectedQuarterContext();
  const sheet = document.querySelector(".earnings-update-sheet");
  if (!context || !sheet) return;

  const pasteStep = sheet.querySelector("[data-earnings-field='earningsText']")?.closest(".earnings-update-body");
  if (!pasteStep || pasteStep.querySelector(`[${BUTTON_ATTR}]`)) return;

  const actions = pasteStep.querySelector(".earnings-update-actions");
  if (!actions) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary-btn";
  button.setAttribute(BUTTON_ATTR, "");
  button.innerHTML = `نسخ برومبت JSON لـ ChatGPT <span dir="ltr">Q${context.quarter} ${escapeMarkup(context.year)}</span>`;
  button.addEventListener("click", () => copyGeneratedJsonPrompt(context, sheet));
  actions.prepend(button);

  const hint = document.createElement("p");
  hint.className = "compact-empty-state quarterly-json-prompt-hint";
  hint.textContent = "ينسخ برومبت جاهز يطلب من ChatGPT البحث عن نتائج الربع من المصادر الرسمية، مقارنة النتائج بالمتطلبات السابقة، ثم إرجاع JSON صالح للاستيراد فقط.";
  actions.insertAdjacentElement("beforebegin", hint);
}

async function copyGeneratedJsonPrompt(context, sheet) {
  const earningsInput = sheet.querySelector("[data-earnings-field='earningsText']");
  if (!earningsInput) return;

  const researchInstruction = [
    `[Selected quarter: Q${context.quarter} ${context.year}]`,
    `This task is specifically for Q${context.quarter} ${context.year}.`,
    "If earnings materials are not pasted below, independently research the official company Investor Relations earnings release, SEC filing, earnings presentation, and management guidance for this exact quarter.",
    "Use official company/SEC sources first. Do not invent missing numbers.",
    "Evaluate the previously stored price-target requirements against this quarter's actual results.",
    "Preserve the selected quarter and year in the resulting report period / earnings period fields.",
    "",
    "Optional pasted earnings materials:",
    ""
  ].join("\n");

  if (!String(earningsInput.value || "").includes(`This task is specifically for Q${context.quarter} ${context.year}.`)) {
    const existing = String(earningsInput.value || "")
      .replace(/^\[Selected quarter:[^\]]+\][\s\S]*?Paste the earnings release \/ 10-Q excerpts \/ management commentary below:\s*/i, "")
      .trim();
    earningsInput.value = `${researchInstruction}${existing}`;
    earningsInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  const nextButton = sheet.querySelector("[data-action='prepare-earnings-prompt']");
  nextButton?.click();

  const generated = await waitForElement("[data-earnings-generated-prompt]", 1800);
  if (!generated) {
    showLocalFeedback("تعذر تجهيز البرومبت. اضغط «التالي» ثم حاول النسخ من خطوة البرومبت.", true);
    return;
  }

  const strictOutput = [
    "",
    "=== QUARTERLY JSON OUTPUT MODE ===",
    `Selected reporting period: Q${context.quarter} ${context.year}.`,
    "Research the exact selected quarter if source materials were not supplied.",
    "Return ONLY one valid JSON object compatible with the application's ExternalAnalysisReport import schema.",
    "Do not include Markdown fences, commentary, an Arabic summary, citations outside JSON, or any text before/after the JSON.",
    "Keep unavailable values null rather than guessing.",
    "For each previously stored priceTargetRequirement, preserve its identity and fill actualValue/status/evaluationNote only when supported by the selected quarter's evidence.",
    "Allowed requirement status values: EXCEEDED, PASSED, PARTIALLY_PASSED, FAILED, NOT_REPORTED.",
    "Do not mark unreported or unavailable metrics as FAILED.",
    `Ensure the JSON clearly represents Q${context.quarter} ${context.year}.`
  ].join("\n");

  const prompt = `${generated.value || generated.textContent || ""}\n${strictOutput}`.trim();
  if (!prompt) return;

  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(prompt);
    showLocalFeedback(`تم نسخ برومبت JSON لـ Q${context.quarter} ${context.year} ✓`);
  } catch {
    generated.value = prompt;
    generated.focus();
    generated.select?.();
    showLocalFeedback("تعذر النسخ التلقائي. تم تحديد البرومبت لنسخه يدويًا.", true);
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

function waitForElement(selector, timeout = 1500) {
  return new Promise((resolve) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);
    const started = Date.now();
    const timer = window.setInterval(() => {
      const element = document.querySelector(selector);
      if (element || Date.now() - started > timeout) {
        window.clearInterval(timer);
        resolve(element || null);
      }
    }, 40);
  });
}

function escapeMarkup(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const observer = new MutationObserver(ensureJsonPromptButton);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("pageshow", ensureJsonPromptButton);
ensureJsonPromptButton();
