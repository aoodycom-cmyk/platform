export function installDecisionHeroUx(store, root = document.getElementById("app")) {
  if (!store || !root || store.__decisionHeroUxInstalled) return;
  store.__decisionHeroUxInstalled = true;
  ensureStyles();

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => renderDecisionHero(store, root));
  };

  store.subscribe(schedule);
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  schedule();
}

export function decisionHeroModel(report = {}) {
  const canonical = report.metadata?.franklinV3Report || {};
  const current = canonical.valuation?.current || {};
  const summary = report.fairValueSummary || {};
  const scenarios = report.scenarios || canonical.valuation?.scenarios || {};
  const currency = report.market?.currency || report.company?.currency || current.currency || "USD";
  const thesis = firstText(
    report.thesis?.shortSummary,
    report.thesis?.fullSummary,
    canonical.thesis?.updatedSummary
  );

  return {
    probabilityWeighted: finiteOrNull(summary.probabilityWeightedFairValue ?? current.probabilityWeighted),
    confidence: finiteOrNull(report.decision?.confidence ?? current.confidence),
    thesis: thesis || null,
    currency,
    scenarios: [
      scenarioModel("Bear", scenarios.Bear, summary.fairValueLow ?? current.bear),
      scenarioModel("Base", scenarios.Base, summary.fairValueBase ?? current.base),
      scenarioModel("Bull", scenarios.Bull, summary.fairValueHigh ?? current.bull)
    ]
  };
}

function renderDecisionHero(store, root) {
  const host = root.querySelector?.(".v31-stock-decision");
  if (!host) return;
  const report = selectedReport(store.state);
  if (!report) return;

  const model = decisionHeroModel(report);
  const ar = document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";
  let extension = host.querySelector(".franklin-decision-hero-extension");
  if (!extension) {
    extension = document.createElement("section");
    extension.className = "franklin-decision-hero-extension";
    host.append(extension);
  }

  const signature = JSON.stringify(model);
  if (extension.dataset.signature === signature && extension.dataset.language === (ar ? "ar" : "en")) return;
  extension.dataset.signature = signature;
  extension.dataset.language = ar ? "ar" : "en";
  extension.innerHTML = `
    <div class="franklin-decision-hero-kpis">
      <article>
        <span>${ar ? "القيمة الاحتمالية" : "Probability-weighted value"}</span>
        <small dir="ltr">Probability-Weighted Fair Value</small>
        <strong dir="ltr">${formatMoney(model.probabilityWeighted, model.currency)}</strong>
      </article>
      <article>
        <span>${ar ? "الثقة" : "Confidence"}</span>
        <small dir="ltr">Confidence</small>
        <strong dir="ltr">${formatConfidence(model.confidence)}</strong>
      </article>
    </div>
    ${model.thesis ? `
      <div class="franklin-decision-hero-thesis">
        <span>${ar ? "الفرضية الاستثمارية" : "Investment thesis"}</span>
        <p dir="auto">${escapeHtml(model.thesis)}</p>
      </div>
    ` : ""}
    <div class="franklin-decision-hero-scenarios" aria-label="Bear Base Bull scenarios">
      ${model.scenarios.map((scenario) => `
        <article data-scenario="${scenario.name.toLowerCase()}">
          <span dir="ltr">${scenario.name}</span>
          <strong dir="ltr">${formatMoney(scenario.fairValue, model.currency)}</strong>
          <small dir="ltr">${formatProbability(scenario.probability)}</small>
        </article>
      `).join("")}
    </div>
  `;
}

function scenarioModel(name, scenario = {}, fallbackFairValue = null) {
  return {
    name,
    fairValue: finiteOrNull(scenario?.fairValue ?? scenario?.value ?? fallbackFairValue),
    probability: finiteOrNull(scenario?.probability)
  };
}

function selectedReport(state = {}) {
  const selection = state.externalReportSelection || {};
  const ticker = String(selection.ticker || "").trim().toUpperCase();
  if (!ticker) return null;
  const reports = state.externalAnalyses?.[ticker] || [];
  return reports.find((item) => item.id === selection.reportId) || reports[0] || null;
}

function formatMoney(value, currency) {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD").toUpperCase(),
      maximumFractionDigits: value >= 100 ? 0 : 2
    }).format(value);
  } catch {
    return `${Number(value).toFixed(value >= 100 ? 0 : 2)} ${String(currency || "USD").toUpperCase()}`;
  }
}

function formatConfidence(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function formatProbability(value) {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function finiteOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstText(...values) {
  for (const value of values) {
    if (Array.isArray(value)) {
      const text = value.map((item) => typeof item === "string" ? item : item?.text || item?.title || "").filter(Boolean).join(" ").trim();
      if (text) return text;
      continue;
    }
    const text = typeof value === "string" ? value.trim() : "";
    if (text) return text;
  }
  return "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function ensureStyles() {
  if (document.getElementById("franklin-decision-hero-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-decision-hero-styles";
  style.textContent = `
    .franklin-decision-hero-extension{display:grid;gap:14px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(148,163,184,.14)}
    .franklin-decision-hero-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .franklin-decision-hero-kpis article{min-width:0;display:grid;gap:3px;padding:11px 12px;border-radius:12px;background:rgba(148,163,184,.055)}
    .franklin-decision-hero-kpis span,.franklin-decision-hero-thesis>span{font-size:10px;font-weight:750;color:var(--ink-soft,#cbd5e1)}
    .franklin-decision-hero-kpis small{font-size:8px;color:var(--muted,#7f8aa3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .franklin-decision-hero-kpis strong{font-size:19px;letter-spacing:-.02em;color:var(--ink,#f8fafc)}
    .franklin-decision-hero-thesis{display:grid;gap:5px}
    .franklin-decision-hero-thesis p{margin:0;color:var(--ink-soft,#cbd5e1);font-size:12px;line-height:1.7}
    .franklin-decision-hero-scenarios{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
    .franklin-decision-hero-scenarios article{display:grid;gap:3px;min-width:0;padding:9px 8px;border-radius:10px;background:rgba(148,163,184,.045);text-align:center}
    .franklin-decision-hero-scenarios span{font-size:9px;font-weight:800;color:var(--muted,#94a3b8)}
    .franklin-decision-hero-scenarios strong{font-size:14px;color:var(--ink,#f8fafc);white-space:nowrap}
    .franklin-decision-hero-scenarios small{font-size:9px;color:var(--muted,#94a3b8)}
    .franklin-decision-hero-scenarios article[data-scenario="base"]{background:rgba(45,212,191,.075);box-shadow:inset 0 0 0 1px rgba(45,212,191,.16)}
    @media (min-width:760px){.franklin-decision-hero-extension{grid-template-columns:minmax(280px,.9fr) 1.2fr}.franklin-decision-hero-kpis{align-self:start}.franklin-decision-hero-thesis{grid-column:2}.franklin-decision-hero-scenarios{grid-column:1/-1}}
  `;
  document.head.append(style);
}
