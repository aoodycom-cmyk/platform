import { buildQuarterlyScorecard } from "../externalAnalysis/quarterlyScorecard.js";

const MOBILE_MAX_WIDTH = 899;

const STATUS_CLASSES = ["exceeded", "passed", "partially-passed", "failed", "not-reported"];

function isArabicUi() {
  return document.documentElement.dir === "rtl" || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function statusFromButton(button) {
  if (!button) return "not-reported";
  return STATUS_CLASSES.find((status) => button.classList.contains(status)) || "not-reported";
}

function statusIcon(status) {
  if (status === "exceeded" || status === "passed") return "✓";
  if (status === "partially-passed") return "▲";
  if (status === "failed") return "×";
  return "";
}

function executionLabel(status) {
  if (!isArabicUi()) {
    if (status === "exceeded") return "Above requirement";
    if (status === "passed") return "Requirement met";
    if (status === "partially-passed") return "Improving";
    if (status === "failed") return "Below requirement";
    return "Awaiting report";
  }
  if (status === "exceeded") return "متفوق على المطلوب";
  if (status === "passed") return "حقق المطلوب";
  if (status === "partially-passed") return "قيد التحسن";
  if (status === "failed") return "دون المطلوب";
  return "بانتظار الإعلان";
}

function enhanceTitle(shell) {
  const titlebar = shell.querySelector(".quarterly-scorecard-titlebar");
  if (!titlebar) return;

  const back = titlebar.querySelector(".scorecard-back");
  if (back && isArabicUi()) back.textContent = "›";

  const titleBlock = titlebar.querySelector(":scope > div");
  if (!titleBlock) return;

  const title = titleBlock.querySelector("h2");
  const period = titleBlock.querySelector(":scope > span");
  const ticker = titleBlock.querySelector(":scope > strong");
  if (title) title.textContent = isArabicUi() ? "متابعة الأرباع" : "Quarterly Scorecard";

  const latestQuarter = shell.querySelector(".quarterly-progress-grid article.latest span")?.textContent?.trim() || "";
  const year = shell.dataset.scorecardYear || "";
  if (period) period.textContent = `${latestQuarter} ${year}`.trim();

  if (!titleBlock.querySelector(".figma-scorecard-meta") && (period || ticker)) {
    const meta = document.createElement("div");
    meta.className = "figma-scorecard-meta";
    if (ticker) meta.append(ticker);
    const dot = document.createElement("i");
    dot.textContent = "•";
    dot.setAttribute("aria-hidden", "true");
    meta.append(dot);
    if (period) meta.append(period);
    titleBlock.append(meta);
  }
}

function enhanceAnnualSummary(shell) {
  const annual = shell.querySelector(".quarterly-annual-summary");
  if (!annual) return;

  const latest = annual.querySelector(".quarterly-progress-grid article.latest");
  const latestValue = latest?.querySelector("strong")?.textContent?.trim() || "—";
  const summaryBlock = annual.querySelector(":scope > header > div");
  const trajectory = summaryBlock?.querySelector("strong");

  if (summaryBlock && !summaryBlock.querySelector(".figma-scorecard-annual-score")) {
    const score = document.createElement("b");
    score.className = "figma-scorecard-annual-score";
    score.textContent = latestValue;
    summaryBlock.insertBefore(score, trajectory || null);
  }

  if (!annual.querySelector(".figma-scorecard-target-pill")) {
    const targetValue = shell.querySelector(".quarterly-scorecard-targets .target strong")?.textContent?.trim();
    if (targetValue) {
      const target = document.createElement("div");
      target.className = "figma-scorecard-target-pill";
      target.innerHTML = `<span>${isArabicUi() ? "الهدف" : "Target"}</span><strong dir="ltr">${targetValue}</strong>`;
      annual.append(target);
    }
  }
}

function enhanceMetricCards(shell) {
  shell.querySelectorAll(".quarterly-metric-card").forEach((card) => {
    const header = card.querySelector(":scope > header");
    const metricLabel = header?.querySelector(".scorecard-metric-label");
    const required = header?.querySelector(":scope > div:last-child");

    if (metricLabel && required && required !== metricLabel && !required.classList.contains("figma-required-line")) {
      required.classList.add("figma-required-line");
      const label = required.querySelector("span");
      if (label) label.textContent = isArabicUi() ? "المطلوب:" : "Required:";
      metricLabel.append(required);
    }

    const buttons = [...card.querySelectorAll(".quarterly-mobile-quarter-grid button")];
    const latest = card.querySelector(".quarterly-mobile-quarter-grid button.latest:not(:disabled)")
      || [...buttons].reverse().find((button) => !button.disabled);
    const status = statusFromButton(latest);

    STATUS_CLASSES.forEach((item) => card.classList.remove(`figma-tone-${item}`));
    card.classList.add(`figma-tone-${status}`);

    buttons.forEach((button) => {
      const buttonStatus = statusFromButton(button);
      const icon = button.querySelector("small");
      if (icon) {
        icon.textContent = statusIcon(buttonStatus);
        icon.setAttribute("aria-hidden", "true");
      }
    });

    const trend = card.querySelector("footer .scorecard-trend");
    if (trend) {
      trend.textContent = executionLabel(status);
      STATUS_CLASSES.forEach((item) => trend.classList.remove(`figma-status-${item}`));
      trend.classList.add(`figma-status-${status}`);
    }

    const trendLabel = card.querySelector("footer > span:first-child");
    if (trendLabel) trendLabel.textContent = isArabicUi() ? "اتجاه التنفيذ" : "Execution trend";
  });
}

function enhanceForwardOutlook(shell) {
  if (shell.querySelector(".quarterly-forward-outlook")) return;
  const store = window.__equityResearchStore;
  const state = store?.state;
  if (!state) return;
  const selection = state.quarterlyScorecard || {};
  const scorecard = buildQuarterlyScorecard({
    historicalRequirementSets: state.historicalRequirementSets,
    externalAnalyses: state.externalAnalyses,
    ticker: shell.dataset.scorecardTicker || selection.ticker,
    year: Number(shell.dataset.scorecardYear || selection.year)
  });
  const quarters = (scorecard.quarters || []).filter((quarter) => quarter.outlook);
  if (!quarters.length) return;

  ensureForwardOutlookStyles();
  const section = document.createElement("section");
  section.className = "panel quarterly-forward-outlook";
  section.innerHTML = `
    <header class="quarterly-forward-outlook-head">
      <div>
        <span>${isArabicUi() ? "Forward Outlook" : "Forward Outlook"}</span>
        <h3>${isArabicUi() ? "النظرة المستقبلية عبر الأرباع" : "Quarter-by-quarter outlook"}</h3>
        <p>${isArabicUi() ? "قراءة اتجاه الشركة بعد كل إعلان دون تغيير القيمة العادلة أو التوصية الأساسية." : "Tracks direction after each earnings report without changing fair value or the core recommendation."}</p>
      </div>
    </header>
    <div class="quarterly-forward-outlook-grid">
      ${quarters.map((quarter) => forwardOutlookCard(quarter)).join("")}
    </div>
  `;
  const annual = shell.querySelector(".quarterly-annual-summary");
  if (annual) annual.insertAdjacentElement("afterend", section);
  else shell.prepend(section);
}

function forwardOutlookCard(quarter = {}) {
  const outlook = quarter.outlook || {};
  const tone = outlookTone(outlook);
  const metrics = [
    [isArabicUi() ? "النمو" : "Growth", outlookLabel("growth", outlook.growthOutlook)],
    [isArabicUi() ? "الهوامش" : "Margins", outlookLabel("margin", outlook.marginOutlook)],
    [isArabicUi() ? "التوجيه" : "Guidance", outlookLabel("guidance", outlook.guidanceTrend)],
    [isArabicUi() ? "نبرة الإدارة" : "Management", outlookLabel("tone", outlook.managementTone)],
    [isArabicUi() ? "أثره على الفرضية" : "Thesis impact", outlookLabel("thesis", outlook.thesisImpact)]
  ].filter(([, value]) => value);
  return `
    <article class="quarterly-outlook-card tone-${tone}">
      <header>
        <strong dir="ltr">${escapeHtml(quarter.label || `Q${quarter.quarter || ""}`)}</strong>
        <span>${escapeHtml(outlookLabel("thesis", outlook.thesisImpact) || (isArabicUi() ? "قراءة مستقبلية" : "Forward view"))}</span>
      </header>
      ${outlook.summary ? `<p>${escapeHtml(outlook.summary)}</p>` : ""}
      <div class="quarterly-outlook-metrics">
        ${metrics.map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}
      </div>
    </article>
  `;
}

function outlookLabel(type, value) {
  const key = String(value || "").trim().toLowerCase();
  const ar = {
    growth: { accelerating: "يتسارع", stable: "مستقر", slowing: "يتباطأ", unclear: "غير واضح" },
    margin: { improving: "تتحسن", stable: "مستقرة", pressured: "تحت ضغط", unclear: "غير واضح" },
    guidance: { raised: "مرفوع", maintained: "مثبّت", lowered: "مخفض", mixed: "مختلط", new: "جديد", not_reported: "غير معلن" },
    tone: { positive: "إيجابية", neutral: "محايدة", cautious: "حذرة", mixed: "مختلطة", unclear: "غير واضحة" },
    thesis: { supports: "يدعم الفرضية", neutral: "لا يغير الفرضية", weakens: "يضعف الفرضية", unclear: "غير واضح" }
  };
  const en = {
    growth: { accelerating: "Accelerating", stable: "Stable", slowing: "Slowing", unclear: "Unclear" },
    margin: { improving: "Improving", stable: "Stable", pressured: "Under pressure", unclear: "Unclear" },
    guidance: { raised: "Raised", maintained: "Maintained", lowered: "Lowered", mixed: "Mixed", new: "New", not_reported: "Not reported" },
    tone: { positive: "Positive", neutral: "Neutral", cautious: "Cautious", mixed: "Mixed", unclear: "Unclear" },
    thesis: { supports: "Supports thesis", neutral: "No thesis change", weakens: "Weakens thesis", unclear: "Unclear" }
  };
  return (isArabicUi() ? ar : en)[type]?.[key] || "";
}

function outlookTone(outlook = {}) {
  if (outlook.thesisImpact === "supports") return "positive";
  if (outlook.thesisImpact === "weakens") return "negative";
  if (outlook.guidanceTrend === "lowered" || outlook.growthOutlook === "slowing" || outlook.marginOutlook === "pressured") return "warning";
  return "neutral";
}

function ensureForwardOutlookStyles() {
  if (document.getElementById("quarterly-forward-outlook-styles")) return;
  const style = document.createElement("style");
  style.id = "quarterly-forward-outlook-styles";
  style.textContent = `
    .quarterly-forward-outlook { margin-block: 14px; overflow: hidden; }
    .quarterly-forward-outlook-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .quarterly-forward-outlook-head span { font-size: 12px; opacity: .65; letter-spacing: .04em; }
    .quarterly-forward-outlook-head h3 { margin: 3px 0 5px; font-size: 18px; }
    .quarterly-forward-outlook-head p { margin: 0; max-width: 760px; opacity: .72; font-size: 13px; line-height: 1.65; }
    .quarterly-forward-outlook-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; direction: ltr; }
    .quarterly-outlook-card { direction: rtl; border: 1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.34); border-radius: 16px; padding: 14px; min-width: 0; }
    html[dir="ltr"] .quarterly-outlook-card { direction: ltr; }
    .quarterly-outlook-card.tone-positive { border-color: rgba(34,197,94,.36); background: rgba(34,197,94,.06); }
    .quarterly-outlook-card.tone-warning { border-color: rgba(245,158,11,.36); background: rgba(245,158,11,.06); }
    .quarterly-outlook-card.tone-negative { border-color: rgba(239,68,68,.36); background: rgba(239,68,68,.06); }
    .quarterly-outlook-card > header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .quarterly-outlook-card > header strong { font-size: 15px; }
    .quarterly-outlook-card > header span { font-size: 11px; opacity: .78; }
    .quarterly-outlook-card > p { margin: 0 0 12px; font-size: 12px; line-height: 1.65; opacity: .86; }
    .quarterly-outlook-metrics { display: grid; gap: 7px; }
    .quarterly-outlook-metrics > div { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-top: 7px; border-top: 1px solid rgba(148,163,184,.12); }
    .quarterly-outlook-metrics span { font-size: 11px; opacity: .62; }
    .quarterly-outlook-metrics strong { font-size: 11px; font-weight: 700; text-align: end; }
    @media (max-width: 899px) {
      .quarterly-forward-outlook { margin-inline: 0; }
      .quarterly-forward-outlook-grid { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(250px, 84vw); grid-template-columns: none; overflow-x: auto; overscroll-behavior-inline: contain; scroll-snap-type: x proximity; padding-bottom: 4px; }
      .quarterly-outlook-card { scroll-snap-align: start; }
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

function enhanceQuarterlyScorecard() {
  const shell = document.querySelector(".quarterly-scorecard-shell");
  if (!shell) return;
  enhanceForwardOutlook(shell);
  if (window.innerWidth > MOBILE_MAX_WIDTH || shell.dataset.figmaMobileEnhanced === "true") return;

  shell.dataset.figmaMobileEnhanced = "true";
  enhanceTitle(shell);
  enhanceAnnualSummary(shell);
  enhanceMetricCards(shell);
}

let frame = 0;
function scheduleEnhancement() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhanceQuarterlyScorecard);
}

const app = document.getElementById("app");
if (app) {
  new MutationObserver(scheduleEnhancement).observe(app, { childList: true, subtree: true });
}
window.addEventListener("resize", scheduleEnhancement, { passive: true });
scheduleEnhancement();
