import { starterUniverse } from "../data/sampleData.js";

// Company names are navigation metadata only. No prices or financials are seeded.
const DIRECTORY = [
  ["TSLA", "Tesla", "تسلا"], ["TXN", "Texas Instruments", "تكساس إنسترومنتس"],
  ["BE", "Bloom Energy", "بلوم إنرجي"], ["GOOGL", "Alphabet", ["جوجل", "Google"]],
  ["META", "Meta Platforms", "ميتا"], ["AMD", "Advanced Micro Devices", "اي ام دي"],
  ["AVGO", "Broadcom", "برودكوم"], ["PLTR", "Palantir", "بالانتير"],
  ["ORCL", "Oracle", "أوراكل"], ["CRWV", "CoreWeave", "كورويف"],
  ["NBIS", "Nebius", "نيبيوس"], ["RKLB", "Rocket Lab", "روكيت لاب"],
  ["ASTS", "AST SpaceMobile", "اي اس تي"], ["OUST", "Ouster", "أوستر"],
  ["ADBE", "Adobe", "أدوبي"], ["NFLX", "Netflix", "نتفليكس"]
];
const ALIASES = { NVDA: ["NVIDIA", "انفيديا", "إنفيديا"], MSFT: ["Microsoft", "مايكروسوفت"], AAPL: ["Apple", "أبل", "ابل"], AMZN: ["Amazon", "أمازون"] };

export function analysisCompanyOptions(collection = {}) {
  const companies = new Map(starterUniverse.map((company) => [company.ticker, { ...company, aliases: ALIASES[company.ticker] || [] }]));
  for (const [ticker, name, aliases] of DIRECTORY) companies.set(ticker, { ticker, name, aliases: Array.isArray(aliases) ? aliases : [aliases] });
  for (const reports of Object.values(collection)) {
    for (const report of Array.isArray(reports) ? reports : []) {
      const ticker = String(report?.company?.ticker || "").toUpperCase();
      if (!ticker || ["DEMO", "FQC"].includes(ticker)) continue;
      const prior = companies.get(ticker);
      companies.set(ticker, { ticker, name: report.company.name || prior?.name || ticker, aliases: prior?.aliases || [] });
    }
  }
  return [...companies.values()];
}

export function resolveAnalysisCompany(value, collection = {}) {
  const query = String(value || "").trim();
  if (!query) return null;
  const normalized = normalizeName(query);
  const company = analysisCompanyOptions(collection).find((item) => [item.ticker, item.name, ...(item.aliases || [])].some((name) => normalizeName(name) === normalized));
  if (company) return company;
  // Unknown symbols remain explicit user input; never guess a ticker from a name.
  const ticker = query.toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,11}$/.test(ticker) ? { ticker, name: null, aliases: [] } : null;
}

export function analysisJourneyStep(importState = {}) {
  if (importState.draftReport || importState.editing || importState.supplement?.open) return 3;
  if ([1, 2, 3].includes(importState.journeyStep)) return importState.journeyStep;
  return importState.file ? 3 : 1;
}

export function isAnalysisRequest(text) {
  const value = String(text || "").trim();
  if (/^Fair value\s*\/\s*ChatGPT/.test(value)) return true;
  try {
    const parsed = JSON.parse(value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    return Boolean(parsed?.requestType === "FRANKLIN_INITIAL_ANALYSIS" || parsed?.promptVersion && parsed?.jsonTemplate);
  } catch { return false; }
}

export function journeyProgressMarkup(step, language = "ar", reviewing = false) {
  const labels = language === "ar" ? ["الشركة", "طلب التحليل", "النتيجة"] : ["Company", "Analysis request", "Result"];
  return `<nav class="analysis-progress" aria-label="${language === "ar" ? "خطوات إضافة التحليل" : "Analysis steps"}"><ol>${labels.map((label, index) => `<li class="${step === index + 1 ? "current" : step > index + 1 ? "done" : ""}"><button type="button" data-analysis-step="${index + 1}" ${reviewing && index < 2 ? "disabled" : ""} ${step === index + 1 ? 'aria-current="step"' : ""}><b aria-hidden="true">${step > index + 1 ? "✓" : index + 1}</b><span>${label}</span></button></li>`).join("")}</ol></nav>`;
}

export function emptyResearchLibraryMarkup(language = "ar", className = "") {
  const ar = language === "ar";
  return `<div class="empty-home-state library-empty-state research-welcome ${className}">
    <span class="welcome-symbol" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M7 23V9h18v14M4 26h24M11 18l4-4 4 2 4-6"/></svg></span>
    <p class="eyebrow">${ar ? "مساحتك للبحث والاستثمار" : "YOUR INVESTMENT RESEARCH SPACE"}</p>
    <h2>${ar ? "بحث واضح. قرار تتابعه." : "Clear research. A decision to track."}</h2>
    <p>${ar ? "احتفظ بتحليلات الشركات، وافهم قيمتها العادلة، وتابع ما تغيّر بعد كل إعلان أرباح." : "Keep your company research, understand fair value, and track what changes after each earnings release."}</p>
    <button class="primary-btn" data-action="open-external-import">${ar ? "أضف أول شركة" : "Add your first company"}<span aria-hidden="true">+</span></button>
    <div class="welcome-features"><span>${ar ? "قيمة عادلة وسيناريوهات" : "Fair value & scenarios"}</span><span>${ar ? "فرضية ومخاطر واضحة" : "Thesis & risks"}</span><span>${ar ? "متابعة نتائج الأرباع" : "Quarterly tracking"}</span></div>
    <button class="text-btn" data-action="load-external-demo">${ar ? "استعرض تقريرًا توضيحيًا" : "Explore an illustrative report"}</button>
    <small>${ar ? "التقرير التوضيحي يحتوي على بيانات افتراضية للتعريف بالتجربة." : "The illustrative report uses fictional data to demonstrate the experience."}</small>
  </div>`;
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[إأآ]/g, "ا").replace(/[\u064B-\u065F]/g, "").replace(/\s+/g, " ").trim();
}
