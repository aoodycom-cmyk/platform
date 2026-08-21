import { bindCompanyLogoFallbacks, companyLogoMarkup } from "./foundation.js";

const STORAGE_KEY = "equityResearchV4State";

function safeState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function localized(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(localized).filter(Boolean).join(" / ");
  return String(value.ar || value.arabic || value.text || value.en || value.english || value.label || value.name || "");
}

function numeric(value) {
  const number = Number(String(value ?? "").replace(/[^0-9.+-]/g, ""));
  return Number.isFinite(number) ? number : null;
}

function money(value, digits = 0) {
  const number = numeric(value);
  if (!Number.isFinite(number)) return "—";
  return `$${number.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function signedPercent(value) {
  const number = numeric(value);
  if (!Number.isFinite(number)) return "—";
  return `${number > 0 ? "+" : ""}${number.toFixed(1)}%`;
}

function normalizeAction(value) {
  const raw = localized(value).trim();
  const upper = raw.toUpperCase();
  if (/شراء/.test(raw) || upper.includes("BUY")) return { key: "buy", label: "شراء" };
  if (/زيادة|إضافة/.test(raw) || upper.includes("ADD") || upper.includes("ACCUMULATE")) return { key: "add", label: "زيادة" };
  if (/احتفاظ/.test(raw) || upper.includes("HOLD")) return { key: "hold", label: "احتفاظ" };
  if (/مراقبة/.test(raw) || upper.includes("WATCH")) return { key: "watch", label: "مراقبة" };
  if (/تقليل|تخفيف/.test(raw) || upper.includes("REDUCE") || upper.includes("TRIM")) return { key: "reduce", label: "تقليل" };
  if (/بيع/.test(raw) || upper.includes("SELL")) return { key: "sell", label: "بيع" };
  return { key: "neutral", label: raw || "—" };
}

function latestReports(state) {
  return Object.values(state.externalAnalyses || {})
    .map((items) => Array.isArray(items) ? items[0] : null)
    .filter(Boolean);
}

function findReport(state, ticker, reportId) {
  const list = state.externalAnalyses?.[String(ticker || "").toUpperCase()] || [];
  if (!Array.isArray(list) || !list.length) return null;
  if (!reportId || reportId === "latest") return list[0];
  return list.find((item) => item?.id === reportId) || list[0];
}

function confidenceLabel(report) {
  const value = numeric(report?.decision?.confidence);
  if (!Number.isFinite(value)) return "—";
  const pct = value <= 1 ? value * 100 : value;
  if (pct >= 75) return "مرتفعة";
  if (pct >= 50) return "متوسطة";
  return "منخفضة";
}

function scenarioCell(label, value, tone) {
  return `<div class="m2-mini-scenario ${tone}"><span>${escapeHtml(label)}</span><strong dir="ltr">${escapeHtml(money(value, 0))}</strong></div>`;
}

function enhanceLibraryCards(state) {
  document.querySelectorAll(".library-company-card[data-external-ticker]").forEach((card) => {
    if (card.dataset.mobile2Enhanced === "true") return;
    const ticker = card.dataset.externalTicker || "";
    const reportId = card.dataset.externalReportId || "latest";
    const report = findReport(state, ticker, reportId);
    if (!report) return;

    const action = normalizeAction(report.decision?.action);
    const current = report.fairValueSummary?.currentPrice;
    const base = report.fairValueSummary?.fairValueBase;
    const upside = numeric(report.fairValueSummary?.upsideDownsidePercent);
    const computedUpside = Number.isFinite(upside)
      ? upside
      : (Number.isFinite(numeric(current)) && Number.isFinite(numeric(base)) && numeric(current) !== 0
        ? ((numeric(base) - numeric(current)) / numeric(current)) * 100
        : null);
    const companyName = report.company?.name || ticker;
    const logoUrl = report.company?.logoUrl || report.companyProfile?.logoUrl || report.companyProfile?.logo || "";
    const lastUpdate = report.reportPeriod || report.analysisDate || "—";
    const completion = report.completionStatus?.status || "complete";
    const profileButton = report.companyProfile
      ? `<button class="m2-profile-link" data-profile-ticker="${escapeHtml(ticker)}" data-profile-report-id="${escapeHtml(report.id || reportId)}">ملف الشركة</button>`
      : "";

    card.classList.add("m2-library-card", `m2-action-${action.key}`);
    card.dataset.mobile2Enhanced = "true";
    card.innerHTML = `
      <div class="m2-stock-card-head">
        ${companyLogoMarkup({ ticker, name: companyName, logoUrl, className: "m2-company-logo" })}
        <div class="m2-stock-identity">
          <div class="m2-stock-title-line"><strong dir="auto">${escapeHtml(companyName)}</strong><span class="m2-action-pill ${action.key}">${escapeHtml(action.label)}</span></div>
          <bdi class="m2-ticker">${escapeHtml(ticker)}</bdi>
          <small>آخر تحديث ${escapeHtml(lastUpdate)} · ثقة ${escapeHtml(confidenceLabel(report))}</small>
        </div>
      </div>
      <div class="m2-stock-price-row">
        <div class="m2-upside ${Number.isFinite(computedUpside) && computedUpside < 0 ? "negative" : "positive"}">
          <strong dir="ltr">${escapeHtml(signedPercent(computedUpside))}</strong>
          <span>إلى Base</span>
        </div>
        <div class="m2-current-price"><strong dir="ltr">${escapeHtml(money(current, 2))}</strong><span>السعر الحالي</span></div>
      </div>
      <div class="m2-scenario-strip">
        ${scenarioCell("Bear", report.fairValueSummary?.fairValueLow, "bear")}
        ${scenarioCell("Base", report.fairValueSummary?.fairValueBase, "base")}
        ${scenarioCell("Bull", report.fairValueSummary?.fairValueHigh, "bull")}
      </div>
      <div class="m2-stock-card-foot">
        <span class="m2-data-state ${escapeHtml(completion)}">${completion === "complete" ? "البيانات مكتملة" : "يحتاج استكمال"}</span>
        <div>${profileButton}<span>فتح التقرير ←</span></div>
      </div>
    `;
    bindCompanyLogoFallbacks(card);
  });
}

function ensureFilterOptions(select) {
  if (!select) return;
  const options = [
    ["add", "زيادة"],
    ["watch", "مراقبة"],
    ["reduce", "تقليل"]
  ];
  for (const [value, label] of options) {
    if ([...select.options].some((option) => option.value === value)) continue;
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function enhanceLibraryControls(state) {
  const panel = document.querySelector(".external-home-panel.library-panel");
  const toolbar = panel?.querySelector(".watchlist-toolbar");
  const filterSelect = toolbar?.querySelector("[data-library-filter]");
  if (!panel || !toolbar || !filterSelect) return;
  ensureFilterOptions(filterSelect);

  if (!panel.querySelector(".m2-filter-chips")) {
    const chips = document.createElement("div");
    chips.className = "m2-filter-chips";
    chips.innerHTML = [
      ["all", "الكل"], ["buy", "شراء"], ["add", "زيادة"], ["hold", "احتفاظ"],
      ["watch", "مراقبة"], ["reduce", "تقليل"], ["sell", "بيع"]
    ].map(([value, label]) => `<button type="button" data-m2-filter="${value}">${label}</button>`).join("");
    toolbar.insertAdjacentElement("afterend", chips);
    chips.addEventListener("click", (event) => {
      const button = event.target.closest("[data-m2-filter]");
      if (!button) return;
      filterSelect.value = button.dataset.m2Filter;
      filterSelect.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  panel.querySelectorAll("[data-m2-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.m2Filter === (filterSelect.value || "all"));
  });

  let summary = panel.querySelector(".m2-library-summary");
  if (!summary) {
    summary = document.createElement("div");
    summary.className = "m2-library-summary";
    const chips = panel.querySelector(".m2-filter-chips");
    chips?.insertAdjacentElement("afterend", summary);
  }
  const reports = latestReports(state);
  const upsides = reports.map((report) => numeric(report.fairValueSummary?.upsideDownsidePercent)).filter(Number.isFinite);
  const avg = upsides.length ? upsides.reduce((sum, value) => sum + value, 0) / upsides.length : null;
  const belowBase = upsides.filter((value) => value < 0).length;
  const incomplete = reports.filter((report) => report.completionStatus?.status && report.completionStatus.status !== "complete").length;
  summary.innerHTML = `
    <span>تحت Base <b>${belowBase}</b> · غير مكتمل <b>${incomplete}</b></span>
    <strong class="${Number.isFinite(avg) && avg < 0 ? "negative" : "positive"}">متوسط العائد إلى Base ${escapeHtml(signedPercent(avg))}</strong>
  `;
}

function statusCounts(requirements) {
  const counts = { passed: 0, partial: 0, failed: 0, pending: 0 };
  for (const item of requirements || []) {
    const status = String(item?.status || "NOT_REPORTED").toUpperCase();
    if (status === "PASSED" || status === "EXCEEDED") counts.passed += 1;
    else if (status === "PARTIALLY_PASSED") counts.partial += 1;
    else if (status === "FAILED") counts.failed += 1;
    else counts.pending += 1;
  }
  return counts;
}

function enhanceRequirements(state) {
  const block = document.querySelector(".price-requirements-block");
  if (!block || block.dataset.mobile2Enhanced === "true") return;
  const selection = state.externalReportSelection || {};
  const report = findReport(state, selection.ticker, selection.reportId);
  if (!report?.priceTargetRequirements) return;

  const data = report.priceTargetRequirements;
  const requirements = Array.isArray(data.requirements) ? data.requirements : [];
  const counts = statusCounts(requirements);
  const targetScenario = String(data.targetScenario || "Base").toLowerCase();
  const targetValue = data.targetValue ?? data.nextTargetValue;
  const overview = document.createElement("section");
  overview.className = "m2-requirements-overview";
  overview.innerHTML = `
    <div class="m2-target-card">
      <div><span class="m2-target-scenario">${escapeHtml(localized(data.targetScenario || "Base"))}</span><strong dir="ltr">${escapeHtml(money(targetValue, 0))}</strong><small>السعر المستهدف</small></div>
      <div><strong>${counts.passed} من ${requirements.length} متطلبات محققة</strong><span>تقييم المتطلبات الحالية</span></div>
    </div>
    <div class="m2-target-scenarios">
      <span class="${targetScenario.includes("bear") ? "active bear" : "bear"}">Bear · ${escapeHtml(money(report.fairValueSummary?.fairValueLow, 0))}</span>
      <span class="${targetScenario.includes("base") ? "active base" : "base"}">Base · ${escapeHtml(money(report.fairValueSummary?.fairValueBase, 0))}</span>
      <span class="${targetScenario.includes("bull") || targetScenario.includes("optim") ? "active bull" : "bull"}">Bull · ${escapeHtml(money(report.fairValueSummary?.fairValueHigh, 0))}</span>
    </div>
    <div class="m2-requirement-status-grid">
      <div class="passed"><strong>${counts.passed}</strong><span>تحقق</span></div>
      <div class="partial"><strong>${counts.partial}</strong><span>جزئي</span></div>
      <div class="failed"><strong>${counts.failed}</strong><span>لم يتحقق</span></div>
      <div class="pending"><strong>${counts.pending}</strong><span>لم يصدر</span></div>
    </div>
  `;
  block.prepend(overview);
  block.dataset.mobile2Enhanced = "true";
}

function enhanceReportShell() {
  const shell = document.querySelector(".external-report-v2.stock-decision-workspace");
  if (!shell) return;
  shell.classList.add("m2-report-shell");
  shell.querySelectorAll(".stock-report-section").forEach((section) => section.classList.add("m2-report-section"));
}

function runEnhancer() {
  if (!window.matchMedia("(max-width: 640px)").matches) return;
  // Canonical renderers now own the Figma-aligned library and requirements UI.
  // Keep the legacy helpers in this module for backward-compatible markup only.
  enhanceReportShell();
}

let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    runEnhancer();
  });
}

const app = document.getElementById("app");
if (app) {
  new MutationObserver(schedule).observe(app, { childList: true, subtree: true });
  app.addEventListener("change", schedule);
}
window.addEventListener("storage", schedule);
window.addEventListener("DOMContentLoaded", schedule);
window.matchMedia("(max-width: 640px)").addEventListener("change", schedule);
schedule();
