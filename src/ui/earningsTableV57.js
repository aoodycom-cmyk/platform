import { buildQuarterlyScorecard } from "../externalAnalysis/quarterlyScorecard.js";

const MAX_MOBILE_WIDTH = 899;
const ROOT_CLASS = "franklin-earnings-view-active";
const HUB_CLASS = "franklin-earnings-hub-v57";
const STYLE_ID = "franklin-earnings-v57-styles";
const VIEW_STATE = new Map();
const BEAT = new Set(["EXCEEDED", "PASSED"]);
const HAS_DOM = typeof window !== "undefined" && typeof document !== "undefined";
let frame = 0;

function isArabic() {
  if (!HAS_DOM) return true;
  return document.documentElement.dir === "rtl"
    || String(document.documentElement.lang || "").toLowerCase().startsWith("ar");
}

function schedule() {
  if (!HAS_DOM) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(enhance);
}

function enhance() {
  const shell = document.querySelector(".quarterly-scorecard-shell");
  if (!shell || window.innerWidth > MAX_MOBILE_WIDTH) {
    deactivate(shell);
    return;
  }

  const store = window.__equityResearchStore;
  const state = store?.state;
  if (!state) return;
  const selection = state.quarterlyScorecard || {};
  const ticker = String(shell.dataset.scorecardTicker || selection.ticker || "").trim().toUpperCase();
  const year = Number(shell.dataset.scorecardYear || selection.year) || null;
  if (!ticker) return;

  const scorecard = buildQuarterlyScorecard({
    historicalRequirementSets: state.historicalRequirementSets,
    externalAnalyses: state.externalAnalyses,
    ticker,
    year
  });
  const model = buildQuarterlyEarningsViewModel(scorecard);
  const key = `${model.ticker}:${model.year || "latest"}`;
  const remembered = VIEW_STATE.get(key) || {};
  const selectedQuarter = model.quarters.some((q) => q.quarter === Number(remembered.quarter))
    ? Number(remembered.quarter)
    : model.defaultQuarter;
  const tab = remembered.tab === "summary" ? "summary" : "earnings";
  VIEW_STATE.set(key, { quarter: selectedQuarter, tab });

  document.documentElement.classList.add(ROOT_CLASS);
  ensureStylesheet();
  shell.dataset.earningsV57 = "true";
  normalizeHeader(shell, model);

  let hub = shell.querySelector(`.${HUB_CLASS}`);
  if (!hub) {
    hub = document.createElement("section");
    hub.className = HUB_CLASS;
    shell.querySelector(":scope > .quarterly-scorecard-header")?.insertAdjacentElement("afterend", hub);
  }
  const signature = JSON.stringify({ language: isArabic() ? "ar" : "en", selectedQuarter, tab, model });
  if (hub.dataset.signature === signature) return;
  hub.dataset.signature = signature;
  hub.innerHTML = render(model, selectedQuarter, tab);
  bind(hub, key);
  centerActiveQuarter(hub);
}

export function buildQuarterlyEarningsViewModel(scorecard = {}) {
  const latestReportedQuarter = numberOrNull(scorecard.latestReportedQuarter);
  const sourceRows = Array.isArray(scorecard.rows) ? scorecard.rows : [];
  const base = (Array.isArray(scorecard.quarters) ? scorecard.quarters : [])
    .map((quarter) => {
      const number = Number(quarter?.quarter);
      const rows = sourceRows.map((row) => ({
        key: row?.key || "",
        label: row?.label || "",
        secondaryLabel: row?.secondaryLabel || "",
        cell: row?.cells?.[number] || null
      })).filter((row) => row.cell);
      const counts = countStatuses(rows);
      const reported = Boolean(quarter?.evaluated || counts.reported);
      return {
        quarter: number,
        label: quarter?.label || `Q${number}`,
        evaluated: Boolean(quarter?.evaluated),
        reported,
        lifecycleStatus: String(quarter?.lifecycleStatus || "").toUpperCase() || null,
        weightedAchievement: numberOrNull(quarter?.weightedAchievement),
        summary: textOrNull(quarter?.summary),
        outlook: quarter?.outlook || null,
        rows,
        counts,
        hasData: Boolean(rows.length || reported || quarter?.lifecycleStatus || quarter?.outlook || Number.isFinite(Number(quarter?.targetValue)))
      };
    })
    .filter((quarter) => Number.isFinite(quarter.quarter) && quarter.hasData)
    .sort((a, b) => b.quarter - a.quarter);

  const upcomingQuarter = findUpcomingQuarter(base, latestReportedQuarter);
  const quarters = base.map((quarter) => {
    const viewState = classifyQuarter(quarter, latestReportedQuarter, upcomingQuarter);
    return { ...quarter, viewState, tone: quarterTone(quarter, viewState) };
  });
  return {
    ticker: scorecard.ticker || "",
    companyName: scorecard.companyName || scorecard.ticker || "Franklin",
    year: numberOrNull(scorecard.year),
    latestReportedQuarter,
    upcomingQuarter,
    quarters,
    defaultQuarter: upcomingQuarter
      ?? quarters.find((q) => q.quarter === latestReportedQuarter)?.quarter
      ?? quarters.find((q) => q.reported)?.quarter
      ?? quarters[0]?.quarter
      ?? null
  };
}

function findUpcomingQuarter(quarters, latestReportedQuarter) {
  const pending = quarters.filter((q) => !q.reported && q.rows.length);
  if (!pending.length) return null;
  const open = pending.filter((q) => q.lifecycleStatus === "OPEN");
  if (Number.isFinite(latestReportedQuarter)) {
    return open.filter((q) => q.quarter > latestReportedQuarter).sort((a, b) => a.quarter - b.quarter)[0]?.quarter
      ?? pending.filter((q) => q.quarter > latestReportedQuarter).sort((a, b) => a.quarter - b.quarter)[0]?.quarter
      ?? null;
  }
  return [...open].sort((a, b) => b.quarter - a.quarter)[0]?.quarter
    ?? [...pending].sort((a, b) => b.quarter - a.quarter)[0]?.quarter
    ?? null;
}

function classifyQuarter(quarter, latestReportedQuarter, upcomingQuarter) {
  if (quarter.reported) return "reported";
  if (quarter.quarter === upcomingQuarter) return "upcoming";
  if (Number.isFinite(latestReportedQuarter) && quarter.quarter <= latestReportedQuarter) return "historical-missing";
  if (Number.isFinite(upcomingQuarter) && quarter.quarter < upcomingQuarter) return "historical-missing";
  if (Number.isFinite(upcomingQuarter) && quarter.quarter > upcomingQuarter) return "future";
  return "historical-missing";
}

function countStatuses(rows) {
  return rows.reduce((result, row) => {
    const status = normalizedStatus(row.cell?.status);
    const reported = Boolean(row.cell?.reported);
    result.total += 1;
    if (BEAT.has(status)) result.beat += 1;
    else if (status === "FAILED") result.miss += 1;
    else if (status === "PARTIALLY_PASSED") result.mixed += 1;
    else if (!reported) result.pending += 1;
    if (reported) result.reported += 1;
    return result;
  }, { total: 0, reported: 0, beat: 0, miss: 0, mixed: 0, pending: 0 });
}

function quarterTone(quarter, viewState) {
  if (viewState !== "reported") return viewState;
  if (quarter.counts.miss && !quarter.counts.beat && !quarter.counts.mixed) return "miss";
  if (quarter.counts.miss || quarter.counts.mixed) return "mixed";
  if (quarter.counts.beat) return "beat";
  return "neutral";
}

function render(model, selectedQuarter, tab) {
  const quarter = model.quarters.find((q) => q.quarter === selectedQuarter) || model.quarters[0];
  if (!quarter) return emptyExperience(model);
  return `
    <div class="fet57-tabs" role="tablist">
      ${tabButton("summary", isArabic() ? "الملخص" : "Summary", tab)}
      ${tabButton("earnings", isArabic() ? "الأرباح" : "Earnings", tab)}
    </div>
    <div class="fet57-quarter-rail" role="list">
      ${model.quarters.map((q) => quarterButton(q, model.year, q.quarter === quarter.quarter)).join("")}
    </div>
    <div class="fet57-panel">${tab === "summary" ? renderSummary(model, quarter) : renderEarnings(model, quarter)}</div>
  `;
}

function tabButton(value, label, active) {
  return `<button type="button" data-fet57-tab="${value}" class="${active === value ? "active" : ""}" aria-selected="${active === value}">${escapeHtml(label)}</button>`;
}

function quarterButton(quarter, year, selected) {
  return `<button type="button" data-fet57-quarter="${quarter.quarter}" class="fet57-quarter tone-${quarter.tone} ${selected ? "active" : ""}" aria-pressed="${selected}"><strong dir="ltr">${escapeHtml(`${quarter.label} ${year || ""}`.trim())}</strong><span>${escapeHtml(quarterMeta(quarter))}</span></button>`;
}

function quarterMeta(quarter) {
  if (quarter.viewState === "upcoming") return isArabic() ? "بانتظار الإعلان" : "Awaiting report";
  if (quarter.viewState === "historical-missing") return isArabic() ? "لا توجد نتيجة" : "No saved result";
  if (quarter.viewState === "future") return isArabic() ? "ربع لاحق" : "Later quarter";
  const achievement = Number.isFinite(quarter.weightedAchievement) ? `${formatNumber(quarter.weightedAchievement, 1)}%` : "";
  if (quarter.tone === "beat") return `Beat${achievement ? ` ${achievement}` : ""}`;
  if (quarter.tone === "miss") return `Miss${achievement ? ` ${achievement}` : ""}`;
  if (quarter.tone === "mixed") return `${isArabic() ? "مختلط" : "Mixed"}${achievement ? ` ${achievement}` : ""}`;
  return achievement || (isArabic() ? "تم الإعلان" : "Reported");
}

function renderEarnings(model, quarter) {
  const copy = quarterCopy(quarter.viewState);
  return `<article class="fet57-card tone-${quarter.tone}">
    <header><div><span>${escapeHtml(copy.eyebrow)}</span><h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3></div><b>${escapeHtml(stateLabel(quarter))}</b></header>
    <p class="fet57-copy">${escapeHtml(copy.description)}</p>
    <div class="fet57-table-title"><h4>${escapeHtml(copy.title)}</h4><span>${escapeHtml(requirementCount(quarter.counts.total))}</span></div>
    ${quarter.rows.length ? (quarter.viewState === "reported" ? reportedTable(quarter) : targetsTable(quarter)) : emptyQuarter(quarter.viewState)}
    ${highlights(quarter)}
  </article>`;
}

function quarterCopy(state) {
  if (!isArabic()) {
    if (state === "reported") return { eyebrow: "Reported quarter", title: "Results versus Bull requirements", description: "Actuals are green for a Beat and red for a Miss." };
    if (state === "upcoming") return { eyebrow: "Upcoming quarter", title: "Requirements to reach the Bull case", description: "Franklin's saved targets — awaiting the earnings report." };
    if (state === "future") return { eyebrow: "Later quarter", title: "Saved Bull requirements", description: "No actual result is saved yet." };
    return { eyebrow: "Historical quarter", title: "Saved requirements", description: "No actual result is saved, so Franklin does not label this quarter as upcoming." };
  }
  if (state === "reported") return { eyebrow: "ربع معلن", title: "النتائج مقابل متطلبات Bull", description: "الفعلي يظهر بالأخضر عند Beat وبالأحمر عند Miss." };
  if (state === "upcoming") return { eyebrow: "الربع القادم", title: "المطلوب للوصول إلى Bull", description: "أهداف Franklin المحفوظة — بانتظار إعلان الأرباح." };
  if (state === "future") return { eyebrow: "ربع لاحق", title: "متطلبات Bull المحفوظة", description: "لا توجد نتيجة فعلية محفوظة بعد." };
  return { eyebrow: "ربع سابق", title: "المتطلبات المحفوظة", description: "لا توجد نتيجة محفوظة؛ لذلك لا يصنّفه Franklin كربع قادم." };
}

function reportedTable(quarter) {
  return `<div class="fet57-table-wrap"><table class="fet57-table fet57-results"><colgroup><col class="metric"><col class="target"><col class="actual"></colgroup><thead><tr><th>${escapeHtml(isArabic() ? "المقياس" : "Metric")}</th><th>Bull</th><th>${escapeHtml(isArabic() ? "الفعلي والنتيجة" : "Actual & result")}</th></tr></thead><tbody>${quarter.rows.map(reportedRow).join("")}</tbody></table></div>`;
}

function reportedRow(row) {
  const cell = row.cell || {};
  const tone = resultTone(cell);
  const actual = cell.reported ? compactValue(cell.actualValue, cell.actualDisplay, cell.unit, cell.actualRaw) : "—";
  return `<tr>${metricCell(row)}<td class="fet57-target"><bdi dir="ltr">${escapeHtml(requiredValue(cell))}</bdi></td><td class="fet57-actual tone-${tone}"><strong dir="ltr">${escapeHtml(actual)}</strong>${resultMarkup(cell)}</td></tr>`;
}

function targetsTable(quarter) {
  return `<div class="fet57-table-wrap"><table class="fet57-table fet57-targets"><colgroup><col class="metric"><col class="target"></colgroup><thead><tr><th>${escapeHtml(isArabic() ? "المقياس" : "Metric")}</th><th>${escapeHtml(isArabic() ? "المطلوب للـ Bull" : "Bull requirement")}</th></tr></thead><tbody>${quarter.rows.map((row) => `<tr>${metricCell(row)}<td class="fet57-target"><bdi dir="ltr">${escapeHtml(requiredValue(row.cell || {}))}</bdi></td></tr>`).join("")}</tbody></table></div>`;
}

function metricCell(row) {
  const secondary = textOrNull(row.secondaryLabel);
  return `<th scope="row"><strong dir="auto">${escapeHtml(row.label || "—")}</strong>${secondary ? `<small title="${escapeHtml(secondary)}">${escapeHtml(secondary)}</small>` : ""}</th>`;
}

function resultMarkup(cell) {
  const variance = favorableVariance(cell);
  const tone = resultTone(cell);
  return `<span class="fet57-result tone-${tone}"><b>${escapeHtml(resultLabel(cell))}</b>${Number.isFinite(variance) ? `<small dir="ltr">${escapeHtml(signedPercent(variance))}</small>` : ""}</span>`;
}

function requiredValue(cell) {
  const value = compactValue(cell.requiredValue, cell.requiredDisplay, cell.unit);
  if (value === "—") return value;
  const type = String(cell.type || "").toLowerCase();
  const display = String(cell.requiredDisplay || "").toLowerCase();
  if (type.includes("minimum") || /أو أكثر|على الأقل|at least|or more/.test(display)) return `≥ ${value}`;
  if (type.includes("maximum") || /أو أقل|لا يتجاوز|بحد أقصى|at most|or less|not exceed/.test(display)) return `≤ ${value}`;
  return value;
}

function compactValue(value, display, unit, raw = null) {
  const number = numberOrNull(value);
  const displayText = textOrNull(display) || (typeof raw === "string" ? textOrNull(raw) : null);
  const source = `${String(unit || "").toLowerCase()} ${displayText || ""}`;
  if (Number.isFinite(number)) {
    if (/%|percent|percentage|٪/.test(source)) return `${formatNumber(number, 2)}%`;
    const currency = /usd|dollar|دولار|\$/.test(source);
    const shares = /shares?|سهم/.test(source);
    if (/billion|bn|مليار|(?:^|[^a-z])b(?:[^a-z]|$)/i.test(source)) return `${currency ? "$" : ""}${formatNumber(number, 2)}B${shares && !currency ? " سهم" : ""}`;
    if (/million|mn|مليون|(?:^|[^a-z])m(?:[^a-z]|$)/i.test(source)) return `${currency ? "$" : ""}${formatNumber(number, 2)}M${shares && !currency ? " سهم" : ""}`;
    if (currency) return compactMagnitude(number, "$");
    if (shares) return `${compactMagnitude(number)} سهم`;
    return `${formatNumber(number, 2)}${unit ? ` ${unit}` : ""}`;
  }
  if (!displayText) return "—";
  const found = displayText.match(/-?\d+(?:[.,]\d+)?/)?.[0]?.replace(",", ".");
  if (found && /%|٪/.test(displayText)) return `${found}%`;
  if (found && /مليار|billion|\bbn\b/i.test(displayText)) return `${/دولار|usd|\$/i.test(displayText) ? "$" : ""}${found}B${/سهم|shares?/i.test(displayText) && !/دولار|usd|\$/i.test(displayText) ? " سهم" : ""}`;
  if (found && /مليون|million|\bmn\b/i.test(displayText)) return `${/دولار|usd|\$/i.test(displayText) ? "$" : ""}${found}M${/سهم|shares?/i.test(displayText) && !/دولار|usd|\$/i.test(displayText) ? " سهم" : ""}`;
  return displayText;
}

function compactMagnitude(value, prefix = "") {
  if (Math.abs(value) >= 1_000_000_000) return `${prefix}${formatNumber(value / 1_000_000_000, 2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${prefix}${formatNumber(value / 1_000_000, 2)}M`;
  return `${prefix}${formatNumber(value, 2)}`;
}

function renderSummary(model, quarter) {
  const headline = quarter.viewState === "reported" && Number.isFinite(quarter.weightedAchievement)
    ? `${formatNumber(quarter.weightedAchievement, 1)}%`
    : stateLabel(quarter);
  const description = quarter.summary || quarter.outlook?.summary || summaryFallback(quarter.viewState);
  return `<article class="fet57-card fet57-summary tone-${quarter.tone}"><header><div><span>${escapeHtml(isArabic() ? "ملخص الربع" : "Quarter summary")}</span><h3 dir="ltr">${escapeHtml(`${quarter.label} ${model.year || ""}`.trim())}</h3></div><b>${escapeHtml(stateLabel(quarter))}</b></header><div class="fet57-summary-hero"><strong>${escapeHtml(headline)}</strong><p>${escapeHtml(description)}</p></div><div class="fet57-summary-strip">${summaryMetric(isArabic() ? "المتطلبات" : "Requirements", quarter.counts.total, "neutral")}${quarter.viewState === "reported" ? summaryMetric("Beat", quarter.counts.beat, "beat") + summaryMetric("Miss", quarter.counts.miss, "miss") : summaryMetric(isArabic() ? "المحفوظ" : "Saved", quarter.rows.length, "upcoming")}</div>${highlights(quarter, true)}</article>`;
}

function summaryFallback(state) {
  if (!isArabic()) return state === "upcoming" ? "Franklin is showing saved Bull requirements while awaiting the report." : state === "historical-missing" ? "No actual result is saved for this historical quarter." : state === "future" ? "This later quarter has saved targets and no actual result yet." : "No additional summary is saved.";
  return state === "upcoming" ? "يعرض Franklin متطلبات Bull المحفوظة بانتظار الإعلان." : state === "historical-missing" ? "لا توجد نتيجة فعلية محفوظة لهذا الربع السابق." : state === "future" ? "هذا ربع لاحق يحتوي أهدافًا محفوظة دون نتيجة فعلية." : "لا يوجد ملخص إضافي محفوظ.";
}

function summaryMetric(label, value, tone) {
  return `<div class="fet57-summary-metric tone-${tone}"><span>${escapeHtml(label)}</span><strong dir="ltr">${escapeHtml(String(value ?? 0))}</strong></div>`;
}

function highlights(quarter, open = false) {
  const notes = [...new Set([quarter.summary, quarter.outlook?.summary, ...quarter.rows.map((row) => row.cell?.evaluationNote)].map(textOrNull).filter(Boolean))];
  if (!notes.length) return "";
  return `<details class="fet57-highlights" ${open ? "open" : ""}><summary><span>${escapeHtml(isArabic() ? "أبرز الملاحظات" : "Highlights")}</span><b>⌄</b></summary><div>${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</div></details>`;
}

function emptyQuarter(state) {
  const text = state === "upcoming" ? (isArabic() ? "لا توجد متطلبات محفوظة للربع القادم." : "No requirements are saved for the upcoming quarter.") : (isArabic() ? "لا توجد متطلبات محفوظة لهذا الربع." : "No requirements are saved for this quarter.");
  return `<div class="fet57-empty"><strong>${escapeHtml(text)}</strong><span>${escapeHtml(isArabic() ? "لن يعرض Franklin أرقامًا غير موجودة." : "Franklin will not display invented figures.")}</span></div>`;
}

function emptyExperience(model) {
  return `<div class="fet57-empty"><strong>${escapeHtml(isArabic() ? "لا توجد أرباع متاحة بعد" : "No quarters are available yet")}</strong><span>${escapeHtml(model.ticker || "")}</span></div>`;
}

function stateLabel(quarter) {
  if (quarter.viewState === "upcoming") return isArabic() ? "قادم" : "Upcoming";
  if (quarter.viewState === "historical-missing") return isArabic() ? "لا توجد نتيجة" : "No result";
  if (quarter.viewState === "future") return isArabic() ? "لاحق" : "Later";
  if (quarter.tone === "beat") return "Beat";
  if (quarter.tone === "miss") return "Miss";
  if (quarter.tone === "mixed") return isArabic() ? "مختلط" : "Mixed";
  return isArabic() ? "تم الإعلان" : "Reported";
}

function resultLabel(cell) {
  const status = normalizedStatus(cell.status);
  if (BEAT.has(status)) return "Beat";
  if (status === "FAILED") return "Miss";
  if (status === "PARTIALLY_PASSED") return isArabic() ? "قريب" : "Mixed";
  if (cell.reported && cell.observation) return isArabic() ? "ملاحظة" : "Observed";
  return cell.reported ? (isArabic() ? "معلن" : "Reported") : (isArabic() ? "غير معلن" : "Not reported");
}

function resultTone(cell) {
  const status = normalizedStatus(cell.status);
  if (BEAT.has(status)) return "beat";
  if (status === "FAILED") return "miss";
  if (status === "PARTIALLY_PASSED") return "mixed";
  return cell.reported ? "neutral" : "pending";
}

function favorableVariance(cell) {
  const required = numberOrNull(cell.requiredValue);
  const actual = numberOrNull(cell.actualValue);
  const type = String(cell.type || "").toLowerCase();
  if (!Number.isFinite(required) || !Number.isFinite(actual) || required === 0 || (!type.includes("minimum") && !type.includes("maximum"))) return null;
  const variance = ((actual - required) / Math.abs(required)) * 100;
  return type.includes("maximum") ? -variance : variance;
}

function bind(hub, key) {
  hub.querySelectorAll("[data-fet57-tab]").forEach((button) => button.addEventListener("click", () => {
    const current = VIEW_STATE.get(key) || {};
    VIEW_STATE.set(key, { ...current, tab: button.dataset.fet57Tab === "summary" ? "summary" : "earnings" });
    hub.dataset.signature = "";
    schedule();
  }));
  hub.querySelectorAll("[data-fet57-quarter]").forEach((button) => button.addEventListener("click", () => {
    const quarter = Number(button.dataset.fet57Quarter);
    if (!Number.isFinite(quarter)) return;
    const current = VIEW_STATE.get(key) || {};
    VIEW_STATE.set(key, { ...current, quarter });
    hub.dataset.signature = "";
    schedule();
  }));
}

function centerActiveQuarter(hub) {
  const active = hub.querySelector(".fet57-quarter.active");
  const rail = active?.closest(".fet57-quarter-rail");
  if (!active || !rail) return;
  requestAnimationFrame(() => {
    const left = active.offsetLeft - Math.max(0, (rail.clientWidth - active.clientWidth) / 2);
    try { rail.scrollTo({ left, behavior: "smooth" }); } catch { rail.scrollLeft = left; }
  });
}

function normalizeHeader(shell, model) {
  const header = shell.querySelector(":scope > .quarterly-scorecard-header");
  const block = header?.querySelector(".quarterly-scorecard-titlebar > div");
  if (!header || !block) return;
  block.querySelector("h2").textContent = isArabic() ? "متابعة الأرباح" : "Earnings";
  const company = block.querySelector(":scope > span");
  const ticker = block.querySelector(":scope > strong");
  if (company) company.textContent = model.companyName;
  if (ticker) ticker.textContent = model.ticker;
}

function ensureStylesheet() {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = new URL("../../styles-earnings-v57.css?v=v57-earnings-single-source", import.meta.url).href;
  document.head.append(link);
}

function deactivate(shell) {
  document.documentElement.classList.remove(ROOT_CLASS);
  if (!shell) return;
  shell.removeAttribute("data-earnings-v57");
  shell.querySelector(`.${HUB_CLASS}`)?.remove();
}

function requirementCount(count) {
  if (!isArabic()) return `${count} ${count === 1 ? "requirement" : "requirements"}`;
  if (count === 1) return "متطلب واحد";
  if (count === 2) return "متطلبان";
  if (count >= 3 && count <= 10) return `${count} متطلبات`;
  return `${count} متطلبًا`;
}

function normalizedStatus(value) { return String(value || "NOT_REPORTED").trim().toUpperCase(); }
function numberOrNull(value) { if (value === null || value === undefined || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function textOrNull(value) { const text = String(value ?? "").trim(); return text || null; }
function formatNumber(value, digits = 2) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(Number(value)); }
function signedPercent(value) { const sign = value > 0 ? "+" : value < 0 ? "−" : ""; return `${sign}${formatNumber(Math.abs(value), 2)}%`; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }

if (HAS_DOM) {
  window.__FRANKLIN_EARNINGS_TABLE_EXPERIENCE = "v57";
  window.__equityResearchStore?.subscribe?.(schedule);
  const app = document.getElementById("app");
  if (app) new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("pageshow", schedule);
  schedule();
}
