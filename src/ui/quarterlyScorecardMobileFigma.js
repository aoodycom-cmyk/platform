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

function enhanceQuarterlyScorecard() {
  if (window.innerWidth > MOBILE_MAX_WIDTH) return;
  const shell = document.querySelector(".quarterly-scorecard-shell");
  if (!shell || shell.dataset.figmaMobileEnhanced === "true") return;

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
