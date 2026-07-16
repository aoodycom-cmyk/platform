import { scoreEvaluatedCompany } from "../engines/rankingEngine.js";
import { calculateRangeFairValue, calculateUpside, highestValue } from "../domain/evaluatedCompanies.js";
import { clamp, safeDiv, toNumber, weightedAverage } from "../domain/financialMetrics.js";

export const VALUATION_WORKFLOW_VERSION = "7.0.0";
export const VALUATION_METHODOLOGY_VERSION = "fixed-methodology-2026.07";

export const WORKFLOW_STATUS = {
  DRAFT: "Draft",
  COLLECTING: "Collecting Data",
  READY: "Ready for Analysis",
  GENERATED: "Valuation Generated",
  AWAITING_APPROVAL: "Awaiting Approval",
  APPROVED: "Approved",
  NEEDS_UPDATE: "Needs Update"
};

export const WORKFLOW_STATUS_AR = {
  [WORKFLOW_STATUS.DRAFT]: "مسودة",
  [WORKFLOW_STATUS.COLLECTING]: "قيد إدخال البيانات",
  [WORKFLOW_STATUS.READY]: "جاهز للتحليل",
  [WORKFLOW_STATUS.GENERATED]: "تم إنشاء التقييم",
  [WORKFLOW_STATUS.AWAITING_APPROVAL]: "بانتظار الاعتماد",
  [WORKFLOW_STATUS.APPROVED]: "معتمد",
  [WORKFLOW_STATUS.NEEDS_UPDATE]: "يحتاج تحديث"
};

export const VALUATION_POLICY = {
  version: VALUATION_METHODOLOGY_VERSION,
  minimumCompleteness: 68,
  criticalFields: ["ticker", "companyName", "currentPrice", "revenue", "operatingIncome", "freeCashFlow", "dilutedShares"],
  wacc: {
    riskFreeRate: 0.045,
    equityRiskPremium: 0.055,
    defaultBeta: 1.05,
    defaultPreTaxCostOfDebt: 0.055,
    defaultTaxRate: 0.21,
    defaultDebtWeight: 0.08,
    defaultEquityWeight: 0.92
  },
  defaultForecasts: {
    "Mature Cash Generator": { revenueGrowth: 0.04, operatingMargin: 0.18, capexToRevenue: 0.045, terminalGrowth: 0.025, exitEbitda: 11 },
    "High-Growth Profitable Company": { revenueGrowth: 0.12, operatingMargin: 0.24, capexToRevenue: 0.055, terminalGrowth: 0.03, exitEbitda: 18 },
    "Cyclical Company": { revenueGrowth: 0.035, operatingMargin: 0.12, capexToRevenue: 0.065, terminalGrowth: 0.02, exitEbitda: 8 },
    "Capital-Intensive Company": { revenueGrowth: 0.045, operatingMargin: 0.13, capexToRevenue: 0.12, terminalGrowth: 0.02, exitEbitda: 8 },
    "Financial Institution": { revenueGrowth: 0.035, operatingMargin: 0.18, capexToRevenue: 0.02, terminalGrowth: 0.02, exitEbitda: 0 },
    "Early-Stage Growth Company": { revenueGrowth: 0.16, operatingMargin: 0.08, capexToRevenue: 0.06, terminalGrowth: 0.025, exitEbitda: 0 },
    "Commodity Company": { revenueGrowth: 0.025, operatingMargin: 0.11, capexToRevenue: 0.09, terminalGrowth: 0.015, exitEbitda: 6 },
    "Holding Company / Conglomerate": { revenueGrowth: 0.035, operatingMargin: 0.12, capexToRevenue: 0.055, terminalGrowth: 0.02, exitEbitda: 8 },
    REIT: { revenueGrowth: 0.03, operatingMargin: 0.2, capexToRevenue: 0.08, terminalGrowth: 0.02, exitEbitda: 0 },
    "Unprofitable Growth Company": { revenueGrowth: 0.14, operatingMargin: 0.04, capexToRevenue: 0.05, terminalGrowth: 0.02, exitEbitda: 0 }
  },
  scenarioProbabilities: { Bear: 0.25, Base: 0.5, Bull: 0.25 },
  scenarioAdjustments: {
    Bear: { growth: -0.04, margin: -0.035, wacc: 0.0125, terminalGrowth: -0.0075, capex: 0.015 },
    Base: { growth: 0, margin: 0, wacc: 0, terminalGrowth: 0, capex: 0 },
    Bull: { growth: 0.035, margin: 0.025, wacc: -0.0075, terminalGrowth: 0.005, capex: -0.0075 }
  },
  modelWeights: {
    DCF: 0.34,
    "Reverse DCF": 0,
    "P/E": 0.12,
    PEG: 0.08,
    "EV/EBITDA": 0.14,
    "EV/Sales": 0.08,
    "Price/FCF": 0.1,
    "Morningstar Fair Value": 0.08,
    "Analyst Consensus": 0.06
  }
};

export const VALUATION_SECTIONS = [
  ["basics", "Company Basics"],
  ["incomeStatement", "Income Statement"],
  ["balanceSheet", "Balance Sheet"],
  ["cashFlow", "Cash Flow Statement"],
  ["guidance", "Company Guidance"],
  ["analystEstimates", "Analyst Estimates"],
  ["morningstar", "Morningstar Research"],
  ["qualitative", "Qualitative Research"]
];

export const FIELD_DEFINITIONS = [
  field("ticker", "basics", "Ticker", "text", true, ["symbol", "ticker"]),
  field("companyName", "basics", "Company Name", "text", true, ["company", "name", "issuer"]),
  field("currentPrice", "basics", "Current Price", "number", true, ["price", "last price", "current price", "share price"], { perShare: true }),
  field("marketCap", "basics", "Market Capitalization", "number", false, ["market cap", "market capitalization"]),
  field("enterpriseValue", "basics", "Enterprise Value", "number", false, ["enterprise value", "ev"]),
  field("currency", "basics", "Currency", "text", false, ["currency"]),
  field("sector", "basics", "Sector", "text", false, ["sector"]),
  field("industry", "basics", "Industry", "text", false, ["industry"]),
  field("currentDate", "basics", "Current Date", "date", false, ["date", "valuation date", "current date"]),

  field("revenue", "incomeStatement", "Revenue", "number", true, ["revenue", "sales", "total revenue"]),
  field("grossProfit", "incomeStatement", "Gross Profit", "number", false, ["gross profit"]),
  field("operatingIncome", "incomeStatement", "Operating Income", "number", true, ["operating income", "ebit"]),
  field("ebitda", "incomeStatement", "EBITDA", "number", false, ["ebitda"]),
  field("netIncome", "incomeStatement", "Net Income", "number", false, ["net income", "net earnings"]),
  field("eps", "incomeStatement", "EPS", "number", false, ["eps", "diluted eps", "earnings per share"], { perShare: true }),
  field("annualPeriods", "incomeStatement", "Historical annual periods", "text", false, ["annual periods", "fiscal years"]),
  field("quarterlyPeriods", "incomeStatement", "Historical quarterly periods", "text", false, ["quarterly periods", "quarters"]),

  field("cash", "balanceSheet", "Cash", "number", false, ["cash", "cash and equivalents"]),
  field("totalDebt", "balanceSheet", "Total Debt", "number", false, ["total debt", "debt"]),
  field("equity", "balanceSheet", "Equity", "number", false, ["equity", "shareholders equity", "total equity"]),
  field("workingCapital", "balanceSheet", "Working Capital", "number", false, ["working capital"]),
  field("dilutedShares", "balanceSheet", "Diluted Shares Outstanding", "number", true, ["diluted shares", "shares outstanding", "diluted shares outstanding", "shares"]),

  field("operatingCashFlow", "cashFlow", "Operating Cash Flow", "number", false, ["operating cash flow", "cash from operations", "cfo"]),
  field("capex", "cashFlow", "Capital Expenditure", "number", false, ["capital expenditure", "capex", "capital expenditures"]),
  field("freeCashFlow", "cashFlow", "Free Cash Flow", "number", true, ["free cash flow", "fcf"]),
  field("stockBasedCompensation", "cashFlow", "Stock-Based Compensation", "number", false, ["stock based compensation", "sbc"]),
  field("shareBuybacks", "cashFlow", "Share Buybacks", "number", false, ["buybacks", "share repurchases", "repurchases"]),
  field("dividends", "cashFlow", "Dividends", "number", false, ["dividends"]),

  field("revenueGuidance", "guidance", "Revenue Guidance", "text", false, ["revenue guidance", "sales guidance"]),
  field("epsGuidance", "guidance", "EPS Guidance", "text", false, ["eps guidance"]),
  field("marginGuidance", "guidance", "Margin Guidance", "text", false, ["margin guidance"]),
  field("capexGuidance", "guidance", "CapEx Guidance", "text", false, ["capex guidance", "capital expenditure guidance"]),
  field("managementGrowthGuidance", "guidance", "Management Growth Guidance", "text", false, ["growth guidance", "management growth guidance"]),
  field("otherGuidance", "guidance", "Other guidance", "text", false, ["other guidance"]),

  field("revenueEstimates", "analystEstimates", "Revenue Estimates", "number", false, ["revenue estimates", "revenue estimate", "sales estimates"]),
  field("epsEstimates", "analystEstimates", "EPS Estimates", "number", false, ["eps estimates", "eps estimate"]),
  field("ebitdaEstimates", "analystEstimates", "EBITDA Estimates", "number", false, ["ebitda estimates", "ebitda estimate"]),
  field("fcfEstimates", "analystEstimates", "FCF Estimates", "number", false, ["fcf estimates", "free cash flow estimates"]),
  field("estimateRange", "analystEstimates", "Low / Average / High Estimates", "text", false, ["low average high", "estimate range"]),
  field("numberOfAnalysts", "analystEstimates", "Number of Analysts", "number", false, ["number of analysts", "analysts"], { perShare: true }),
  field("analystTargetLow", "analystEstimates", "Analyst Target Low", "number", false, ["target low", "analyst target low"], { perShare: true }),
  field("analystTargetAverage", "analystEstimates", "Analyst Target Average", "number", false, ["target average", "analyst target average", "average target"], { perShare: true }),
  field("analystTargetHigh", "analystEstimates", "Analyst Target High", "number", false, ["target high", "analyst target high"], { perShare: true }),

  field("morningstarFairValue", "morningstar", "Fair Value", "number", false, ["morningstar fair value", "fair value"], { perShare: true }),
  field("morningstarMoat", "morningstar", "Economic Moat", "text", false, ["economic moat", "moat"]),
  field("capitalAllocation", "morningstar", "Capital Allocation", "text", false, ["capital allocation"]),
  field("uncertaintyRating", "morningstar", "Uncertainty Rating", "text", false, ["uncertainty rating", "uncertainty"]),
  field("starRating", "morningstar", "Star Rating", "text", false, ["star rating", "stars"]),
  field("morningstarBullCase", "morningstar", "Bull Case", "text", false, ["bull case"]),
  field("morningstarBaseCase", "morningstar", "Base Case", "text", false, ["base case"]),
  field("morningstarBearCase", "morningstar", "Bear Case", "text", false, ["bear case"]),
  field("morningstarKeyRisks", "morningstar", "Key Risks", "text", false, ["key risks", "risks"]),
  field("analystResearchSummary", "morningstar", "Analyst Research Summary", "text", false, ["analyst research summary", "research summary"]),
  field("researchDate", "morningstar", "Research Date", "date", false, ["research date"]),

  field("businessModel", "qualitative", "Business Model", "text", false, ["business model"]),
  field("competitiveAdvantages", "qualitative", "Competitive Advantages", "text", false, ["competitive advantages", "advantages"]),
  field("mainCompetitors", "qualitative", "Main Competitors", "text", false, ["main competitors", "competitors"]),
  field("customerConcentration", "qualitative", "Customer Concentration", "text", false, ["customer concentration"]),
  field("geographicExposure", "qualitative", "Geographic Exposure", "text", false, ["geographic exposure"]),
  field("regulatoryRisks", "qualitative", "Regulatory Risks", "text", false, ["regulatory risks", "regulation"]),
  field("managementNotes", "qualitative", "Management Notes", "text", false, ["management notes", "management"]),
  field("userNotes", "qualitative", "User Notes", "text", false, ["user notes", "notes"])
];

const FIELD_BY_ID = Object.fromEntries(FIELD_DEFINITIONS.map((item) => [item.id, item]));
const MODEL_UNIVERSE = ["DCF", "Reverse DCF", "P/E", "PEG", "EV/EBITDA", "EV/Sales", "Price/FCF", "Dividend Discount Model", "Residual Income", "Sum of the Parts", "Historical Multiples", "Peer Multiples", "Morningstar Fair Value", "Analyst Consensus"];

export function statusLabel(status, language = "en") {
  return language === "ar" ? WORKFLOW_STATUS_AR[status] || status : status;
}

export function createValuationWorkspace(company = {}, previous = null) {
  const now = new Date().toISOString();
  const inputs = {
    ...(previous?.inputs || {}),
    ...companySeedFields(company, now)
  };
  const workspace = {
    id: previous?.id || workspaceId(company.ticker || inputs.ticker?.value),
    ticker: String(company.ticker || inputs.ticker?.value || "").toUpperCase(),
    companyName: company.name || inputs.companyName?.value || "",
    status: previous?.status || WORKFLOW_STATUS.DRAFT,
    researchStatus: previous?.researchStatus || WORKFLOW_STATUS.DRAFT,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    lastSavedAt: now,
    methodologyVersion: VALUATION_METHODOLOGY_VERSION,
    inputs,
    sectionSources: previous?.sectionSources || defaultSectionSources(now),
    pasteDrafts: previous?.pasteDrafts || {},
    pastePreview: null,
    dataReview: null,
    report: previous?.report || null,
    renderedReport: previous?.renderedReport || "",
    investorNotes: previous?.investorNotes || "",
    overrides: previous?.overrides || {},
    versions: previous?.versions || []
  };
  return updateWorkspaceReview(workspace);
}

export function updateWorkspaceField(workspace, fieldId, value, options = {}) {
  const definition = FIELD_BY_ID[fieldId];
  if (!definition) return workspace;
  const now = new Date().toISOString();
  const next = clone(workspace);
  next.inputs[fieldId] = normalizeFieldValue({
    fieldId,
    value,
    source: options.source || "Manual Input",
    sourceDate: options.sourceDate || today(),
    mode: options.mode || "Manual",
    confidence: options.confidence ?? 1,
    userConfirmed: options.userConfirmed ?? true,
    originalTextReference: options.originalTextReference || String(value ?? "")
  });
  next.status = WORKFLOW_STATUS.COLLECTING;
  next.researchStatus = next.status;
  next.updatedAt = now;
  next.lastSavedAt = now;
  return updateWorkspaceReview(next);
}

export function updateSectionSource(workspace, sectionId, patch = {}) {
  const next = clone(workspace);
  next.sectionSources[sectionId] = {
    ...(next.sectionSources[sectionId] || {}),
    ...patch
  };
  next.updatedAt = new Date().toISOString();
  return next;
}

export function updatePasteDraft(workspace, sectionId, text) {
  const next = clone(workspace);
  next.pasteDrafts[sectionId] = text;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function parseWorkspacePaste(workspace, sectionId) {
  const text = workspace.pasteDrafts?.[sectionId] || "";
  const source = workspace.sectionSources?.[sectionId]?.source || "Manual Paste";
  const sourceDate = workspace.sectionSources?.[sectionId]?.sourceDate || today();
  const rows = parseRows(text);
  const candidates = [];
  const usedFields = new Set();
  for (const row of rows) {
    const match = matchField(row.label, sectionId, usedFields);
    if (!match) continue;
    usedFields.add(match.field.id);
    const parsed = parseValue(row.value, match.field, row.raw || text);
    candidates.push({
      fieldId: match.field.id,
      label: match.field.label,
      sectionId,
      value: parsed.value,
      rawValue: row.value,
      source,
      sourceDate,
      mode: "Automatic",
      confidence: Math.min(match.confidence, parsed.confidence),
      userConfirmed: match.confidence >= 0.78 && parsed.confidence >= 0.75,
      ambiguous: match.confidence < 0.78 || parsed.confidence < 0.75,
      originalTextReference: row.raw || text.slice(0, 240),
      reason: match.reason
    });
  }
  const preview = {
    id: `preview-${Date.now()}`,
    sectionId,
    source,
    sourceDate,
    originalText: text,
    candidates,
    unmappedRows: rows.filter((row) => !candidates.some((item) => item.originalTextReference === row.raw)).map((row) => row.raw).slice(0, 20),
    createdAt: new Date().toISOString()
  };
  return { ...workspace, pastePreview: preview, status: WORKFLOW_STATUS.COLLECTING, researchStatus: WORKFLOW_STATUS.COLLECTING };
}

export function applyParsedPreview(workspace) {
  if (!workspace.pastePreview) return workspace;
  const next = clone(workspace);
  for (const candidate of workspace.pastePreview.candidates) {
    next.inputs[candidate.fieldId] = normalizeFieldValue(candidate);
  }
  next.pastePreview = null;
  next.updatedAt = new Date().toISOString();
  next.lastSavedAt = next.updatedAt;
  next.status = WORKFLOW_STATUS.COLLECTING;
  next.researchStatus = next.status;
  return updateWorkspaceReview(next);
}

export function confirmWorkspaceField(workspace, fieldId) {
  const next = clone(workspace);
  if (next.inputs[fieldId]) {
    next.inputs[fieldId].userConfirmed = true;
    next.inputs[fieldId].rejected = false;
    next.inputs[fieldId].notAvailable = false;
    next.inputs[fieldId].confidence = Math.max(toNumber(next.inputs[fieldId].confidence) || 0, 0.85);
  }
  next.updatedAt = new Date().toISOString();
  return updateWorkspaceReview(next);
}

export function rejectWorkspaceField(workspace, fieldId) {
  const next = clone(workspace);
  if (next.inputs[fieldId]) {
    next.inputs[fieldId].rejected = true;
    next.inputs[fieldId].userConfirmed = false;
  }
  next.updatedAt = new Date().toISOString();
  return updateWorkspaceReview(next);
}

export function markWorkspaceFieldNotAvailable(workspace, fieldId) {
  const definition = FIELD_BY_ID[fieldId];
  if (!definition) return workspace;
  const next = clone(workspace);
  next.inputs[fieldId] = {
    fieldId,
    label: definition.label,
    value: null,
    source: "Investor marked Not Available",
    sourceDate: today(),
    mode: "Manual",
    confidence: 1,
    userConfirmed: true,
    notAvailable: true,
    originalTextReference: "Marked not available by investor"
  };
  next.updatedAt = new Date().toISOString();
  return updateWorkspaceReview(next);
}

export function setMethodologyOverride(workspace, key, patch = {}) {
  const next = clone(workspace);
  next.overrides[key] = {
    ...(next.overrides[key] || {}),
    ...patch,
    timestamp: new Date().toISOString()
  };
  next.status = WORKFLOW_STATUS.NEEDS_UPDATE;
  next.researchStatus = next.status;
  next.updatedAt = new Date().toISOString();
  return next;
}

export function buildDataReview(workspace) {
  const confirmed = [];
  const missing = [];
  const unconfirmedParsed = [];
  const automatic = [];
  const manual = [];
  const outdated = [];
  const conflicting = [];
  const nowMs = Date.now();

  for (const definition of FIELD_DEFINITIONS) {
    const item = workspace.inputs?.[definition.id];
    if (!item || item.rejected || item.notAvailable || item.value === "" || item.value === null || item.value === undefined) {
      if (definition.required && !item?.notAvailable) missing.push(reviewItem(definition, item));
      continue;
    }
    const entry = reviewItem(definition, item);
    if (item.userConfirmed) confirmed.push(entry);
    if (!item.userConfirmed && item.mode === "Automatic") unconfirmedParsed.push(entry);
    if (item.mode === "Automatic") automatic.push(entry);
    if (item.mode === "Manual") manual.push(entry);
    if (isOutdated(item.sourceDate, nowMs)) outdated.push(entry);
    if (item.conflict) conflicting.push(entry);
  }

  const requiredCount = FIELD_DEFINITIONS.filter((item) => item.required).length;
  const confirmedRequired = FIELD_DEFINITIONS.filter((definition) => definition.required && usableConfirmed(workspace.inputs?.[definition.id])).length;
  const usefulCount = FIELD_DEFINITIONS.filter((definition) => usableConfirmed(workspace.inputs?.[definition.id])).length;
  const completeness = Math.round((confirmedRequired / requiredCount) * 72 + Math.min(28, usefulCount * 1.3));
  const criticalConflicts = conflicting.filter((item) => VALUATION_POLICY.criticalFields.includes(item.fieldId));
  const canRun = completeness >= VALUATION_POLICY.minimumCompleteness && !criticalConflicts.length && !unconfirmedParsed.some((item) => VALUATION_POLICY.criticalFields.includes(item.fieldId));

  return {
    completeness: clamp(completeness, 0, 100),
    canRun,
    minimumCompleteness: VALUATION_POLICY.minimumCompleteness,
    confirmed,
    missing,
    conflicting,
    outdated,
    unconfirmedParsed,
    automatic,
    manual,
    criticalConflicts,
    requiredConfirmed: confirmedRequired,
    requiredTotal: requiredCount
  };
}

export function canRunValuation(workspace) {
  return buildDataReview(workspace).canRun;
}

export function runFixedMethodologyValuation(workspace, language = "en") {
  const reviewed = updateWorkspaceReview(workspace);
  if (!reviewed.dataReview.canRun) {
    return {
      workspace: reviewed,
      error: language === "ar"
        ? "لا يمكن تشغيل محلل التقييم قبل اكتمال البيانات المطلوبة وتأكيد الحقول الحرجة."
        : "The valuation analyst cannot run until required data is complete and critical fields are confirmed."
    };
  }

  const now = new Date().toISOString();
  const inputs = normalizeInputs(reviewed);
  const classification = classifyCompany(inputs, language);
  const wacc = buildWacc(inputs, classification, reviewed.overrides, language);
  const assumptions = buildAssumptions(inputs, classification, wacc, reviewed.overrides, language);
  const scenarios = ["Bear", "Base", "Bull"].map((name) => buildScenario(name, inputs, assumptions, classification, language));
  const modelSelection = selectValuationModels(inputs, classification, assumptions, scenarios, language);
  const report = buildReport({
    workspace: reviewed,
    inputs,
    classification,
    wacc,
    assumptions,
    scenarios,
    modelSelection,
    language,
    date: now
  });
  const validation = validateValuationReport(report);
  if (!validation.valid) {
    return {
      workspace: reviewed,
      error: validation.errors.join(" / ")
    };
  }

  const version = createVersion({
    status: WORKFLOW_STATUS.GENERATED,
    workspace: reviewed,
    report,
    assumptions,
    approvalStatus: "Generated",
    timestamp: now
  });
  const next = {
    ...reviewed,
    status: WORKFLOW_STATUS.AWAITING_APPROVAL,
    researchStatus: WORKFLOW_STATUS.AWAITING_APPROVAL,
    report,
    renderedReport: renderReportText(report),
    versions: [version, ...(reviewed.versions || [])],
    updatedAt: now,
    lastSavedAt: now
  };
  return { workspace: next, report };
}

export function approveWorkspaceValuation(workspace, investorNotes = "") {
  if (!workspace.report) {
    return { workspace, error: "No generated valuation report is available for approval." };
  }
  const validation = validateValuationReport(workspace.report);
  if (!validation.valid) {
    return { workspace, error: validation.errors.join(" / ") };
  }
  const now = new Date().toISOString();
  const versionId = approvedVersionId(workspace.ticker, now);
  const approvedVersion = createVersion({
    status: WORKFLOW_STATUS.APPROVED,
    workspace,
    report: workspace.report,
    assumptions: workspace.report.assumptionRationale,
    approvalStatus: "Approved",
    approvalTimestamp: now,
    investorNotes,
    versionId,
    timestamp: now
  });
  const next = {
    ...workspace,
    status: WORKFLOW_STATUS.APPROVED,
    researchStatus: WORKFLOW_STATUS.APPROVED,
    investorNotes,
    approvedVersionId: versionId,
    approvedAt: now,
    versions: [approvedVersion, ...(workspace.versions || [])],
    updatedAt: now,
    lastSavedAt: now
  };
  const evaluatedCompany = exportApprovedValuation(next, approvedVersion);
  return { workspace: next, evaluatedCompany };
}

export function compareValuationVersions(currentVersion, previousVersion) {
  if (!currentVersion || !previousVersion) return [];
  const current = currentVersion.report?.executiveConclusion || {};
  const previous = previousVersion.report?.executiveConclusion || {};
  const rows = [
    ["WACC", currentVersion.report?.assumptionRationale?.wacc?.value, previousVersion.report?.assumptionRationale?.wacc?.value, "percent"],
    ["Base FCF growth", scenarioMetric(currentVersion.report, "Base", "fcfGrowth"), scenarioMetric(previousVersion.report, "Base", "fcfGrowth"), "percent"],
    ["Base Fair Value", current.baseFairValue, previous.baseFairValue, "money"],
    ["Recommendation", current.recommendation, previous.recommendation, "text"]
  ];
  return rows
    .filter(([, next, prior]) => next !== undefined && prior !== undefined && next !== prior)
    .map(([label, next, prior, kind]) => ({ label, from: prior, to: next, kind }));
}

export function validateValuationReport(report) {
  const errors = [];
  if (!report || typeof report !== "object") errors.push("Report must be an object.");
  const required = ["companyAndValuationDate", "executiveConclusion", "dataQuality", "companyClassification", "financialPerformanceReview", "assumptionRationale", "valuationModels", "bearScenario", "baseScenario", "bullScenario", "risks", "catalysts", "whatWouldChangeTheValuation", "finalInvestmentDecision"];
  for (const key of required) {
    if (!report?.[key]) errors.push(`Missing report section: ${key}.`);
  }
  const probabilities = [report?.bearScenario?.probability, report?.baseScenario?.probability, report?.bullScenario?.probability].map(toNumber);
  if (probabilities.every(Number.isFinite)) {
    const total = probabilities.reduce((sum, value) => sum + value, 0);
    if (Math.abs(total - 1) > 0.0001) errors.push("Scenario probabilities must total 100%.");
  } else {
    errors.push("Scenario probabilities are required.");
  }
  for (const key of ["wacc", "revenueGrowth", "fcfGrowth", "marginForecast", "capex", "terminalGrowth"]) {
    const item = report?.assumptionRationale?.[key];
    if (!item?.why) errors.push(`Missing rationale for ${key}.`);
  }
  for (const scenarioKey of ["bearScenario", "baseScenario", "bullScenario"]) {
    const scenario = report?.[scenarioKey];
    if (!Number.isFinite(toNumber(scenario?.fairValue))) errors.push(`${scenarioKey} fair value is required.`);
  }
  return { valid: errors.length === 0, errors };
}

function field(id, sectionId, label, type, required, aliases = [], options = {}) {
  return { id, sectionId, label, type, required, aliases: [label, ...aliases].map(normalizeKey), ...options };
}

function companySeedFields(company, timestamp) {
  const financials = [...(company.financials || [])].sort((a, b) => toNumber(b.year) - toNumber(a.year));
  const latest = financials[0] || {};
  const seeds = {
    ticker: company.ticker,
    companyName: company.name,
    currentPrice: company.quote?.price,
    marketCap: company.quote?.marketCap,
    enterpriseValue: company.quote?.enterpriseValue,
    currency: company.currency,
    sector: company.sector,
    industry: company.industry,
    currentDate: today(),
    revenue: latest.revenue,
    grossProfit: latest.grossProfit,
    operatingIncome: latest.operatingIncome,
    ebitda: latest.ebitda,
    netIncome: latest.netIncome,
    eps: latest.eps,
    cash: latest.cash,
    totalDebt: latest.debt,
    equity: latest.equity,
    dilutedShares: latest.shares,
    operatingCashFlow: latest.operatingCashFlow,
    capex: latest.capex,
    freeCashFlow: latest.freeCashFlow,
    shareBuybacks: latest.buybacks,
    dividends: latest.dividends,
    analystTargetAverage: company.consensus?.target,
    analystTargetLow: company.consensus?.low,
    analystTargetHigh: company.consensus?.high
  };
  return Object.fromEntries(Object.entries(seeds)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([fieldId, value]) => [fieldId, normalizeFieldValue({
      fieldId,
      value,
      source: company.dataPlatform?.activeSource || "Automatically Fetched Data",
      sourceDate: company.dataPlatform?.updatedAt?.slice(0, 10) || timestamp.slice(0, 10),
      mode: "Automatic",
      confidence: company.dataPlatform?.health?.overallScore ? company.dataPlatform.health.overallScore / 100 : 0.72,
      userConfirmed: false,
      originalTextReference: "Fetched company snapshot"
    })]));
}

function normalizeFieldValue(input) {
  const definition = FIELD_BY_ID[input.fieldId] || {};
  return {
    fieldId: input.fieldId,
    label: input.label || definition.label || input.fieldId,
    value: input.value,
    source: input.source || "Manual Input",
    sourceDate: input.sourceDate || today(),
    mode: input.mode || "Manual",
    confidence: clamp(toNumber(input.confidence) ?? 0.5, 0, 1),
    userConfirmed: Boolean(input.userConfirmed),
    originalTextReference: input.originalTextReference || "",
    rejected: Boolean(input.rejected),
    notAvailable: Boolean(input.notAvailable)
  };
}

function defaultSectionSources(now) {
  return Object.fromEntries(VALUATION_SECTIONS.map(([id]) => [id, { source: "Manual Paste", sourceDate: now.slice(0, 10) }]));
}

function updateWorkspaceReview(workspace) {
  const review = buildDataReview(workspace);
  const readyStatus = review.canRun ? WORKFLOW_STATUS.READY : workspace.status;
  return {
    ...workspace,
    status: workspace.status === WORKFLOW_STATUS.APPROVED || workspace.status === WORKFLOW_STATUS.AWAITING_APPROVAL ? workspace.status : readyStatus,
    researchStatus: workspace.status === WORKFLOW_STATUS.APPROVED || workspace.status === WORKFLOW_STATUS.AWAITING_APPROVAL ? workspace.status : readyStatus,
    dataReview: review
  };
}

function parseRows(text) {
  return String(text || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cleaned = line.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const parts = splitRow(cleaned);
      return { label: parts[0] || "", value: parts.slice(1).join(" ").trim(), raw: line };
    })
    .filter((row) => row.label && row.value);
}

function splitRow(line) {
  if (line.includes("\t")) return line.split("\t").map((item) => item.trim()).filter(Boolean);
  if (line.includes(":")) return line.split(":").map((item) => item.trim()).filter(Boolean);
  if (line.includes(",")) return line.split(",").map((item) => item.trim()).filter(Boolean);
  const match = line.match(/^(.+?)\s+(-?\(?\$?\d[\d,.\s%)]*(?:\s?(?:million|billion|m|bn|mm|b))?)$/i);
  return match ? [match[1], match[2]] : [line];
}

function matchField(label, sectionId, usedFields) {
  const normalized = normalizeKey(label);
  const candidates = FIELD_DEFINITIONS.filter((item) => item.sectionId === sectionId && !usedFields.has(item.id));
  let best = null;
  for (const fieldDef of candidates) {
    for (const alias of fieldDef.aliases) {
      if (normalized === alias) {
        best = { field: fieldDef, confidence: 0.95, reason: "Exact label match" };
        break;
      }
      if (normalized.includes(alias) || alias.includes(normalized)) {
        const confidence = Math.min(0.86, Math.max(0.62, alias.length / Math.max(normalized.length, 1)));
        if (!best || confidence > best.confidence) best = { field: fieldDef, confidence, reason: "Partial label match" };
      }
    }
  }
  return best;
}

function parseValue(raw, definition, fullText) {
  if (definition.type === "text" || definition.type === "date") {
    return { value: String(raw || "").trim(), confidence: raw ? 0.9 : 0.2 };
  }
  const parsed = parseNumberWithUnits(raw, definition, fullText);
  return {
    value: parsed.value,
    confidence: Number.isFinite(parsed.value) ? parsed.confidence : 0.25
  };
}

function parseNumberWithUnits(raw, definition, fullText) {
  let value = String(raw || "").trim();
  const percentValue = value.includes("%");
  const negative = /^\(.*\)$/.test(value) || /^-/.test(value);
  value = value.replace(/[()$,%]/g, "").replace(/\s+/g, " ").trim();
  const number = Number((value.match(/-?\d+(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/) || [])[0]?.replace(/,/g, ""));
  if (!Number.isFinite(number)) return { value: null, confidence: 0.2 };
  let result = negative ? -Math.abs(number) : number;
  const unitText = `${raw} ${fullText}`.toLowerCase();
  if (!definition.perShare && !percentValue) {
    if (/\b(billion|bn|b)\b/.test(unitText)) result *= 1_000_000_000;
    else if (/\b(million|mm|m)\b/.test(unitText)) result *= 1_000_000;
    else if (/\b(thousand|k)\b/.test(unitText)) result *= 1_000;
  }
  if (percentValue) result /= 100;
  return { value: result, confidence: 0.82 };
}

function normalizeInputs(workspace) {
  return Object.fromEntries(FIELD_DEFINITIONS.map((definition) => {
    const item = workspace.inputs?.[definition.id];
    const value = usableConfirmed(item) ? item.value : null;
    return [definition.id, definition.type === "number" ? toNumber(value) : value];
  }));
}

function classifyCompany(inputs, language) {
  const revenue = inputs.revenue;
  const operatingMargin = safeDiv(inputs.operatingIncome, revenue);
  const fcfMargin = safeDiv(inputs.freeCashFlow, revenue);
  const capexRatio = safeDiv(Math.abs(inputs.capex || 0), revenue);
  const profitable = toNumber(inputs.netIncome) > 0 || toNumber(inputs.operatingIncome) > 0;
  const sector = String(inputs.sector || "").toLowerCase();
  const industry = String(inputs.industry || "").toLowerCase();
  let classification = "Mature Cash Generator";
  const reasons = [];

  if (/bank|insurance|financial/.test(sector) || /bank|insurance/.test(industry)) {
    classification = "Financial Institution";
    reasons.push(text(language, "القطاع المالي يجعل نماذج EV وDCF التقليدية أقل ملاءمة.", "The financial sector makes traditional EV and DCF models less suitable."));
  } else if (/reit/.test(industry)) {
    classification = "REIT";
    reasons.push(text(language, "طبيعة REIT تتطلب تركيزًا على التوزيعات والقيمة العقارية.", "REIT economics require emphasis on distributions and asset value."));
  } else if (!profitable && revenue > 0) {
    classification = "Unprofitable Growth Company";
    reasons.push(text(language, "الشركة لم تثبت ربحية مستدامة بعد.", "The company has not yet demonstrated sustainable profitability."));
  } else if (capexRatio > 0.12) {
    classification = "Capital-Intensive Company";
    reasons.push(text(language, "CapEx مرتفع كنسبة من Revenue، لذلك يجب اختباره منفصلًا.", "CapEx is high as a percentage of Revenue, so it must be tested separately."));
  } else if (fcfMargin > 0.12 && operatingMargin > 0.18) {
    classification = "High-Growth Profitable Company";
    reasons.push(text(language, "الهوامش وFCF يدعمان تصنيف شركة رابحة عالية الجودة.", "Margins and FCF support a profitable high-quality growth profile."));
  } else {
    reasons.push(text(language, "البيانات المتاحة تشير إلى شركة ناضجة أكثر من شركة دورية أو غير رابحة.", "Available data points to a mature company rather than a cyclical or unprofitable profile."));
  }

  const suitable = suitableModelsFor(classification, inputs);
  const excluded = MODEL_UNIVERSE.filter((model) => !suitable.includes(model)).map((model) => ({
    method: model,
    why: excludedReason(model, classification, inputs, language)
  }));

  return {
    classification,
    reason: reasons.join(" "),
    suitableModels: suitable,
    excludedModels: excluded,
    missingInputs: VALUATION_POLICY.criticalFields.filter((id) => inputs[id] === null || inputs[id] === undefined || inputs[id] === "")
  };
}

function suitableModelsFor(classification, inputs) {
  const models = [];
  if (!["Financial Institution", "REIT", "Holding Company / Conglomerate"].includes(classification) && positive(inputs.freeCashFlow) && positive(inputs.dilutedShares)) models.push("DCF", "Reverse DCF", "Price/FCF");
  if (positive(inputs.eps)) models.push("P/E");
  if (positive(inputs.eps) && classification.includes("Growth")) models.push("PEG");
  if (positive(inputs.ebitda) && !["Financial Institution", "REIT"].includes(classification)) models.push("EV/EBITDA");
  if (positive(inputs.revenue)) models.push("EV/Sales");
  if (positive(inputs.morningstarFairValue)) models.push("Morningstar Fair Value");
  if (positive(inputs.analystTargetAverage)) models.push("Analyst Consensus");
  return [...new Set(models)];
}

function buildWacc(inputs, classification, overrides, language) {
  const policy = VALUATION_POLICY.wacc;
  const defaultForecast = VALUATION_POLICY.defaultForecasts[classification.classification] || VALUATION_POLICY.defaultForecasts["Mature Cash Generator"];
  const beta = betaFor(classification.classification);
  const taxRate = overrideValue(overrides, "taxRate") ?? policy.defaultTaxRate;
  const marketCap = positive(inputs.marketCap) ? inputs.marketCap : null;
  const debt = positive(inputs.totalDebt) ? inputs.totalDebt : null;
  const capital = marketCap && debt ? marketCap + debt : null;
  const debtWeight = capital ? debt / capital : policy.defaultDebtWeight;
  const equityWeight = capital ? marketCap / capital : policy.defaultEquityWeight;
  const costOfEquity = policy.riskFreeRate + beta * policy.equityRiskPremium;
  const preTaxCostOfDebt = policy.defaultPreTaxCostOfDebt + (classification.classification === "Unprofitable Growth Company" ? 0.02 : 0);
  const baseWacc = equityWeight * costOfEquity + debtWeight * preTaxCostOfDebt * (1 - taxRate);
  const finalWacc = overrideValue(overrides, "wacc") ?? baseWacc;
  const confidence = clamp(82 - (!marketCap ? 10 : 0) - (!debt ? 6 : 0) - (overrideValue(overrides, "wacc") ? 8 : 0), 35, 92);
  return {
    riskFreeRate: policy.riskFreeRate,
    equityRiskPremium: policy.equityRiskPremium,
    beta,
    costOfEquity,
    preTaxCostOfDebt,
    taxRate,
    debtWeight,
    equityWeight,
    finalWacc,
    waccRange: [Math.max(0.04, finalWacc - 0.0125), finalWacc + 0.0125],
    confidence,
    sourceMap: {
      riskFreeRate: "Methodology default",
      equityRiskPremium: "Methodology default",
      beta: `Classification policy: ${classification.classification}`,
      debtWeight: capital ? "Supplied market capitalization and debt" : "Methodology default",
      equityWeight: capital ? "Supplied market capitalization and debt" : "Methodology default",
      taxRate: overrideValue(overrides, "taxRate") ? "Investor override" : "Methodology default"
    },
    why: text(language,
      `تم اختيار WACC بناءً على تصنيف ${classification.classification}، مع Beta منهجي وأوزان رأس مال من البيانات المتاحة أو الافتراض المعتمد عند نقصها.`,
      `WACC was selected from the ${classification.classification} classification, using policy beta and capital weights from supplied data where available.`),
    defaultForecast
  };
}

function buildAssumptions(inputs, classification, wacc, overrides, language) {
  const defaults = VALUATION_POLICY.defaultForecasts[classification.classification] || VALUATION_POLICY.defaultForecasts["Mature Cash Generator"];
  const revenueGrowth = overrideValue(overrides, "revenueGrowth") ?? derivedGrowth(inputs, defaults.revenueGrowth);
  const operatingMargin = overrideValue(overrides, "operatingMargin") ?? derivedMargin(inputs, defaults.operatingMargin);
  const capex = capexAssumption(inputs, defaults, overrides, language);
  const taxRate = overrideValue(overrides, "taxRate") ?? wacc.taxRate;
  const terminalGrowth = overrideValue(overrides, "terminalGrowth") ?? defaults.terminalGrowth;
  const exitMultiple = overrideValue(overrides, "exitMultiple") ?? defaults.exitEbitda;
  const daToRevenue = positive(inputs.ebitda) && Number.isFinite(inputs.operatingIncome)
    ? Math.max(0, safeDiv(inputs.ebitda - inputs.operatingIncome, inputs.revenue) || 0)
    : 0.035;
  const workingCapitalToRevenueGrowth = 0.01;
  return {
    revenueGrowth,
    operatingMargin,
    fcfGrowth: revenueGrowth,
    capexToRevenue: capex.value,
    capexSource: capex.source,
    taxRate,
    terminalGrowth,
    exitMultiple,
    daToRevenue,
    workingCapitalToRevenueGrowth,
    wacc: wacc.finalWacc,
    rationales: {
      revenueGrowth: rationale(language, revenueGrowth, "Revenue Growth", "guidance, analyst estimates, history, or policy default", overrides.revenueGrowth),
      operatingMargin: rationale(language, operatingMargin, "Operating Margin", "current margin or classification policy", overrides.operatingMargin),
      fcfGrowth: rationale(language, revenueGrowth, "FCF Growth", "Revenue Growth with cash-conversion bridge", null),
      capex: capex.why,
      taxRate: rationale(language, taxRate, "Tax Rate", "methodology default unless overridden", overrides.taxRate),
      terminalGrowth: rationale(language, terminalGrowth, "Terminal Growth", "classification policy", overrides.terminalGrowth),
      exitMultiple: rationale(language, exitMultiple, "Exit Multiple", "classification policy", overrides.exitMultiple),
      workingCapital: text(language, "يتم احتساب Working Capital كتغير محدود من نمو Revenue لتجنب تضخيم FCF.", "Working Capital is modeled as a modest drag on Revenue growth to avoid overstating FCF.")
    }
  };
}

function buildScenario(name, inputs, assumptions, classification, language) {
  const adjustment = VALUATION_POLICY.scenarioAdjustments[name];
  const revenueGrowth = clamp(assumptions.revenueGrowth + adjustment.growth, -0.08, 0.28);
  const operatingMargin = clamp(assumptions.operatingMargin + adjustment.margin, -0.05, 0.42);
  const capexToRevenue = clamp(assumptions.capexToRevenue + adjustment.capex, 0.005, 0.22);
  const wacc = clamp(assumptions.wacc + adjustment.wacc, 0.045, 0.18);
  const terminalGrowth = clamp(assumptions.terminalGrowth + adjustment.terminalGrowth, 0.005, Math.min(0.04, wacc - 0.015));
  const forecast = forecastFcfBridge(inputs, { ...assumptions, revenueGrowth, operatingMargin, capexToRevenue }, wacc);
  const fairValue = dcfFairValuePerShare({ forecast, terminalGrowth, wacc, cash: inputs.cash, debt: inputs.totalDebt, shares: inputs.dilutedShares });
  const probability = overrideScenarioProbability(assumptions, name) ?? VALUATION_POLICY.scenarioProbabilities[name];
  return {
    name,
    probability,
    fairValue,
    revenueAssumption: revenueGrowth,
    marginAssumption: operatingMargin,
    fcfAssumption: forecast.length ? forecast[forecast.length - 1].fcfGrowth : null,
    capexAssumption: capexToRevenue,
    wacc,
    terminalGrowth,
    exitMultiple: assumptions.exitMultiple,
    forecast,
    keyRisks: scenarioRisks(name, classification, language),
    keyCatalysts: scenarioCatalysts(name, language)
  };
}

function selectValuationModels(inputs, classification, assumptions, scenarios, language) {
  const selected = [];
  const suitable = new Set(classification.suitableModels);
  const baseValue = scenarios.find((item) => item.name === "Base")?.fairValue;
  if (suitable.has("DCF") && positive(baseValue)) {
    selected.push(model("DCF", baseValue, "Projects FCF with explicit WACC and terminal value.", assumptions, language));
  }
  if (suitable.has("Reverse DCF") && positive(inputs.currentPrice)) {
    selected.push({
      method: "Reverse DCF",
      assumptions: { currentPrice: inputs.currentPrice, baseFairValue: baseValue },
      weight: 0,
      confidence: 0.55,
      fairValue: null,
      explanation: text(language, "Reverse DCF يستخدم لاختبار ما يتطلبه السعر الحالي، ولا يدخل مباشرة في Composite FV.", "Reverse DCF tests what the current price implies and is not directly weighted into Composite FV.")
    });
  }
  if (suitable.has("P/E")) selected.push(model("P/E", inputs.eps * clamp(18 + assumptions.revenueGrowth * 80, 10, 38), "Uses normalized EPS and growth-adjusted P/E.", assumptions, language));
  if (suitable.has("PEG")) selected.push(model("PEG", inputs.eps * clamp(Math.max(assumptions.revenueGrowth, 0.04) * 115, 14, 36), "Uses EPS against growth durability.", assumptions, language));
  if (suitable.has("EV/EBITDA")) selected.push(model("EV/EBITDA", equityValueFromEv(inputs.ebitda * clamp(9 + assumptions.revenueGrowth * 55, 7, 24), inputs), "Uses EBITDA and an enterprise-value multiple.", assumptions, language));
  if (suitable.has("EV/Sales")) selected.push(model("EV/Sales", equityValueFromEv(inputs.revenue * clamp(2 + assumptions.operatingMargin * 10 + assumptions.revenueGrowth * 18, 1, 14), inputs), "Uses Revenue multiple when earnings or FCF are less complete.", assumptions, language));
  if (suitable.has("Price/FCF")) selected.push(model("Price/FCF", inputs.freeCashFlow * clamp(18 + assumptions.revenueGrowth * 70, 10, 35) / inputs.dilutedShares, "Uses current FCF yield normalized for growth.", assumptions, language));
  if (suitable.has("Morningstar Fair Value")) selected.push(model("Morningstar Fair Value", inputs.morningstarFairValue, "External fair value entered by investor.", assumptions, language));
  if (suitable.has("Analyst Consensus")) selected.push(model("Analyst Consensus", inputs.analystTargetAverage, "External analyst target consensus.", assumptions, language));

  const weightedInputs = selected
    .filter((item) => positive(item.fairValue) && item.weight > 0)
    .map((item) => ({ value: item.fairValue, weight: item.weight * item.confidence }));
  const compositeFairValue = weightedAverage(weightedInputs);
  const excluded = classification.excludedModels;
  return {
    selected: normalizeModelWeights(selected),
    excluded,
    compositeFairValue
  };
}

function buildReport({ workspace, inputs, classification, wacc, assumptions, scenarios, modelSelection, language, date }) {
  const bear = scenarios.find((item) => item.name === "Bear");
  const base = scenarios.find((item) => item.name === "Base");
  const bull = scenarios.find((item) => item.name === "Bull");
  const rangeFairValue = calculateRangeFairValue({
    bearFairValue: bear.fairValue,
    bearProbability: bear.probability,
    baseFairValue: base.fairValue,
    baseProbability: base.probability,
    bullFairValue: bull.fairValue,
    bullProbability: bull.probability
  });
  const expectedUpside = calculateUpside(rangeFairValue, inputs.currentPrice);
  const maximumUpside = calculateUpside(highestValue([bear.fairValue, base.fairValue, bull.fairValue, inputs.morningstarFairValue]), inputs.currentPrice);
  const recommendation = recommendationFromUpside(expectedUpside, workspace.dataReview.completeness);
  const confidence = confidenceScore(workspace, modelSelection, wacc, expectedUpside);
  const investmentScore = investmentScoreFrom(expectedUpside, workspace.dataReview.completeness, confidence);

  return {
    schemaVersion: "valuation-output-schema-1.0.0",
    methodologyVersion: VALUATION_METHODOLOGY_VERSION,
    language,
    companyAndValuationDate: {
      ticker: inputs.ticker || workspace.ticker,
      companyName: inputs.companyName || workspace.companyName,
      valuationDate: date.slice(0, 10),
      currentPrice: inputs.currentPrice,
      currency: inputs.currency || "USD"
    },
    executiveConclusion: {
      recommendation,
      confidence,
      currentPrice: inputs.currentPrice,
      bearFairValue: bear.fairValue,
      baseFairValue: base.fairValue,
      bullFairValue: bull.fairValue,
      morningstarFairValue: inputs.morningstarFairValue,
      rangeFairValue,
      expectedUpside,
      maximumUpside,
      investmentScore,
      why: decisionWhy(recommendation, expectedUpside, language)
    },
    dataQuality: {
      completeness: workspace.dataReview.completeness,
      confirmedSources: workspace.dataReview.confirmed.map((item) => `${item.label}: ${item.source}`).slice(0, 12),
      missingData: workspace.dataReview.missing.map((item) => item.label),
      conflictingData: workspace.dataReview.conflicting.map((item) => item.label),
      importantLimitations: limitations(workspace, modelSelection, language)
    },
    companyClassification: {
      classification: classification.classification,
      reason: classification.reason,
      suitableValuationModels: classification.suitableModels,
      excludedModels: classification.excludedModels
    },
    financialPerformanceReview: {
      revenue: performanceLine(inputs.revenue, "Revenue", language),
      eps: performanceLine(inputs.eps, "EPS", language),
      fcf: performanceLine(inputs.freeCashFlow, "FCF", language),
      margins: performanceLine(safeDiv(inputs.operatingIncome, inputs.revenue), "Operating Margin", language),
      roic: performanceLine(null, "ROIC", language),
      balanceSheet: performanceLine((inputs.cash || 0) - (inputs.totalDebt || 0), "Net cash / debt", language),
      dilution: performanceLine(inputs.dilutedShares, "Diluted shares", language),
      capex: performanceLine(inputs.capex, "CapEx", language)
    },
    assumptionRationale: {
      wacc: { value: wacc.finalWacc, why: wacc.why, source: wacc.sourceMap },
      revenueGrowth: { value: assumptions.revenueGrowth, why: assumptions.rationales.revenueGrowth },
      fcfGrowth: { value: assumptions.fcfGrowth, why: assumptions.rationales.fcfGrowth },
      marginForecast: { value: assumptions.operatingMargin, why: assumptions.rationales.operatingMargin },
      capex: { value: assumptions.capexToRevenue, why: assumptions.rationales.capex, source: assumptions.capexSource },
      workingCapital: { value: assumptions.workingCapitalToRevenueGrowth, why: assumptions.rationales.workingCapital },
      taxRate: { value: assumptions.taxRate, why: assumptions.rationales.taxRate },
      terminalGrowth: { value: assumptions.terminalGrowth, why: assumptions.rationales.terminalGrowth },
      exitMultiple: { value: assumptions.exitMultiple, why: assumptions.rationales.exitMultiple },
      dilution: { value: inputs.dilutedShares, why: text(language, "يستخدم عدد الأسهم المخففة المؤكد لحساب القيمة لكل سهم.", "Diluted shares are used for per-share valuation.") }
    },
    valuationModels: modelSelection.selected,
    bearScenario: scenarioReport(bear),
    baseScenario: scenarioReport(base),
    bullScenario: scenarioReport(bull),
    risks: risksFromInputs(inputs, bear, language),
    catalysts: catalystsFromInputs(inputs, bull, language),
    whatWouldChangeTheValuation: whatWouldChange(language),
    finalInvestmentDecision: {
      decision: recommendation,
      why: decisionWhy(recommendation, expectedUpside, language),
      whyNot: decisionWhyNot(recommendation, workspace, language),
      mainPositiveDrivers: positiveDrivers(modelSelection, inputs, language),
      mainNegativeDrivers: negativeDrivers(workspace, inputs, language),
      dataLimitations: workspace.dataReview.missing.map((item) => item.label).slice(0, 8)
    }
  };
}

function exportApprovedValuation(workspace, approvedVersion) {
  const report = workspace.report;
  const conclusion = report.executiveConclusion;
  const ticker = report.companyAndValuationDate.ticker;
  const now = new Date().toISOString();
  const base = {
    id: ticker,
    ticker,
    companyName: report.companyAndValuationDate.companyName,
    sector: workspace.inputs.sector?.value || "",
    currentPrice: conclusion.currentPrice,
    bearFairValue: conclusion.bearFairValue,
    bearProbability: report.bearScenario.probability,
    baseFairValue: conclusion.baseFairValue,
    baseProbability: report.baseScenario.probability,
    bullFairValue: conclusion.bullFairValue,
    bullProbability: report.bullScenario.probability,
    morningstarFairValue: conclusion.morningstarFairValue,
    rangeFairValue: conclusion.rangeFairValue,
    upside: conclusion.expectedUpside,
    highestFairValue: highestValue([conclusion.bearFairValue, conclusion.baseFairValue, conclusion.bullFairValue, conclusion.morningstarFairValue]),
    maxFairValueUpside: conclusion.maximumUpside,
    recommendation: conclusion.recommendation,
    decisionStatus: "ACTIONABLE",
    confidence: conclusion.confidence,
    investmentScore: conclusion.investmentScore,
    qualityScore: null,
    growthScore: null,
    managementScore: null,
    moatScore: null,
    riskScore: null,
    dataQuality: report.dataQuality.completeness,
    evaluationDate: report.companyAndValuationDate.valuationDate,
    approvedDate: now.slice(0, 10),
    valuationVersion: approvedVersion.versionId,
    methodologyVersion: report.methodologyVersion,
    approvedReport: report,
    approvedReportText: workspace.renderedReport,
    approvedInputSnapshot: workspace.inputs,
    approvedSourceSnapshot: workspace.sectionSources,
    valuationVersions: workspace.versions,
    approvalTimestamp: now,
    investorNotes: workspace.investorNotes,
    companySnapshot: null,
    manualInputsSnapshot: {},
    history: []
  };
  return {
    ...base,
    ...scoreEvaluatedCompany(base)
  };
}

function model(methodName, fairValue, explanation, assumptions, language) {
  const baseWeight = VALUATION_POLICY.modelWeights[methodName] ?? 0.04;
  return {
    method: methodName,
    assumptions: {
      wacc: assumptions.wacc,
      revenueGrowth: assumptions.revenueGrowth,
      operatingMargin: assumptions.operatingMargin,
      capexToRevenue: assumptions.capexToRevenue,
      terminalGrowth: assumptions.terminalGrowth
    },
    weight: baseWeight,
    confidence: positive(fairValue) ? 0.72 : 0.35,
    fairValue,
    explanation: text(language, explanationArabic(methodName), explanation)
  };
}

function normalizeModelWeights(models) {
  const weighted = models.filter((item) => positive(item.fairValue) && item.weight > 0);
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  return models.map((item) => ({
    ...item,
    weight: item.weight > 0 && total > 0 ? item.weight / total : item.weight
  }));
}

function forecastFcfBridge(inputs, assumptions) {
  const years = [];
  let revenue = positive(inputs.revenue) ? inputs.revenue : 0;
  let priorFcf = positive(inputs.freeCashFlow) ? inputs.freeCashFlow : null;
  for (let year = 1; year <= 5; year += 1) {
    const previousRevenue = revenue;
    revenue *= 1 + assumptions.revenueGrowth;
    const operatingIncome = revenue * assumptions.operatingMargin;
    const tax = Math.max(0, operatingIncome * assumptions.taxRate);
    const nopat = operatingIncome - tax;
    const da = revenue * assumptions.daToRevenue;
    const capex = revenue * assumptions.capexToRevenue;
    const workingCapitalChange = Math.max(0, revenue - previousRevenue) * assumptions.workingCapitalToRevenueGrowth;
    const freeCashFlow = nopat + da - capex - workingCapitalChange;
    years.push({
      year,
      revenue,
      revenueGrowth: assumptions.revenueGrowth,
      operatingMargin: assumptions.operatingMargin,
      operatingIncome,
      tax,
      nopat,
      da,
      capex,
      workingCapitalChange,
      freeCashFlow,
      fcfGrowth: priorFcf ? (freeCashFlow - priorFcf) / Math.abs(priorFcf) : null
    });
    priorFcf = freeCashFlow;
  }
  return years;
}

function dcfFairValuePerShare({ forecast, terminalGrowth, wacc, cash, debt, shares }) {
  if (!forecast.length || !positive(shares)) return null;
  let pv = 0;
  for (const row of forecast) {
    pv += row.freeCashFlow / Math.pow(1 + wacc, row.year);
  }
  const terminalFcf = forecast[forecast.length - 1].freeCashFlow * (1 + terminalGrowth);
  const terminalValue = terminalFcf / Math.max(wacc - terminalGrowth, 0.01);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, forecast.length);
  const netCash = (toNumber(cash) || 0) - (toNumber(debt) || 0);
  return (pv + pvTerminal + netCash) / shares;
}

function equityValueFromEv(enterpriseValue, inputs) {
  if (!positive(enterpriseValue) || !positive(inputs.dilutedShares)) return null;
  return (enterpriseValue + (inputs.cash || 0) - (inputs.totalDebt || 0)) / inputs.dilutedShares;
}

function capexAssumption(inputs, defaults, overrides, language) {
  const override = overrideValue(overrides, "capexToRevenue");
  if (Number.isFinite(override)) {
    return {
      value: override,
      source: "Investor override",
      why: text(language, "تم استخدام تعديل المستثمر لمنهجية CapEx مع تمييزه كتعديل.", "The investor override is used for CapEx and clearly labeled as an override.")
    };
  }
  const guidance = toNumber(inputs.capexGuidance);
  if (positive(guidance) && positive(inputs.revenue)) {
    return {
      value: guidance / inputs.revenue,
      source: "Company CapEx guidance",
      why: text(language, "الأولوية الأولى هي Guidance الخاص بـ CapEx لأنه صادر من الشركة.", "Company CapEx guidance has first priority because it comes from management.")
    };
  }
  const historical = positive(inputs.capex) && positive(inputs.revenue) ? Math.abs(inputs.capex) / inputs.revenue : null;
  if (Number.isFinite(historical)) {
    return {
      value: clamp(historical, 0.005, 0.22),
      source: "Historical CapEx as % of Revenue",
      why: text(language, "تم استخدام CapEx التاريخي كنسبة من Revenue لأنه أفضل دليل متاح.", "Historical CapEx as a percentage of Revenue is used because it is the best available company-specific evidence.")
    };
  }
  return {
    value: defaults.capexToRevenue,
    source: "Sector/classification policy default",
    why: text(language, "لا توجد Guidance أو بيانات CapEx مؤكدة، لذلك استخدم النظام افتراضًا منهجيًا وخفّض الثقة.", "No confirmed CapEx guidance or company data is available, so the system uses a labeled methodology default and reduces confidence.")
  };
}

function derivedGrowth(inputs, defaultGrowth) {
  if (positive(inputs.revenueEstimates) && positive(inputs.revenue)) return clamp(inputs.revenueEstimates / inputs.revenue - 1, -0.12, 0.32);
  const guidanceNumber = toNumber(inputs.revenueGuidance);
  if (Number.isFinite(guidanceNumber)) return Math.abs(guidanceNumber) > 1 ? clamp(guidanceNumber / inputs.revenue - 1, -0.12, 0.32) : clamp(guidanceNumber, -0.12, 0.32);
  return defaultGrowth;
}

function derivedMargin(inputs, defaultMargin) {
  const margin = safeDiv(inputs.operatingIncome, inputs.revenue);
  return Number.isFinite(margin) ? clamp(margin, -0.1, 0.45) : defaultMargin;
}

function confidenceScore(workspace, modelSelection, wacc, expectedUpside) {
  const modelCount = modelSelection.selected.filter((item) => positive(item.fairValue)).length;
  return Math.round(clamp(workspace.dataReview.completeness * 0.45 + wacc.confidence * 0.25 + modelCount * 7 + (Number.isFinite(expectedUpside) ? 10 : 0), 20, 94));
}

function investmentScoreFrom(expectedUpside, dataQuality, confidence) {
  const upsideScore = Number.isFinite(expectedUpside) ? clamp(50 + expectedUpside * 160, 0, 100) : 45;
  return Math.round(upsideScore * 0.55 + dataQuality * 0.25 + confidence * 0.2);
}

function recommendationFromUpside(upside, dataQuality) {
  if (dataQuality < 68 || !Number.isFinite(upside)) return "HOLD";
  if (upside >= 0.18) return "BUY";
  if (upside <= -0.2) return "SELL";
  return "HOLD";
}

function createVersion({ status, workspace, report, assumptions, approvalStatus, approvalTimestamp = null, investorNotes = "", versionId = null, timestamp }) {
  return {
    versionId: versionId || `draft-${workspace.ticker || "TICKER"}-${timestamp.replace(/[-:.TZ]/g, "").slice(0, 14)}`,
    type: status,
    methodologyVersion: VALUATION_METHODOLOGY_VERSION,
    inputDataSnapshot: workspace.inputs,
    sourceSnapshot: workspace.sectionSources,
    assumptions,
    report,
    decision: report?.finalInvestmentDecision?.decision || null,
    approvalStatus,
    approvalTimestamp,
    investorNotes,
    timestamp
  };
}

function renderReportText(report) {
  const sections = [
    ["1. Company and Valuation Date", `${report.companyAndValuationDate.companyName} (${report.companyAndValuationDate.ticker}) - ${report.companyAndValuationDate.valuationDate}`],
    ["2. Executive Conclusion", `${report.executiveConclusion.recommendation} / confidence ${report.executiveConclusion.confidence}% / Range FV ${report.executiveConclusion.rangeFairValue}`],
    ["3. Data Quality", `${report.dataQuality.completeness}/100`],
    ["4. Company Classification", `${report.companyClassification.classification}: ${report.companyClassification.reason}`],
    ["5. Financial Performance Review", Object.values(report.financialPerformanceReview).join(" ")],
    ["6. Assumption Rationale", Object.values(report.assumptionRationale).map((item) => item.why).join(" ")],
    ["7. Valuation Models", report.valuationModels.map((item) => `${item.method}: ${item.fairValue}`).join(" / ")],
    ["8. Bear Scenario", `${report.bearScenario.fairValue}`],
    ["9. Base Scenario", `${report.baseScenario.fairValue}`],
    ["10. Bull Scenario", `${report.bullScenario.fairValue}`],
    ["11. Risks", report.risks.join(" ")],
    ["12. Catalysts", report.catalysts.join(" ")],
    ["13. What Would Change the Valuation", report.whatWouldChangeTheValuation.join(" ")],
    ["14. Final Investment Decision", `${report.finalInvestmentDecision.decision}: ${report.finalInvestmentDecision.why}`]
  ];
  return sections.map(([heading, body]) => `${heading}\n${body}`).join("\n\n");
}

function reviewItem(definition, item = {}) {
  return {
    fieldId: definition.id,
    label: definition.label,
    sectionId: definition.sectionId,
    value: item?.value ?? null,
    source: item?.source || "-",
    sourceDate: item?.sourceDate || "-",
    mode: item?.mode || "-",
    confidence: item?.confidence ?? null,
    userConfirmed: Boolean(item?.userConfirmed),
    originalTextReference: item?.originalTextReference || ""
  };
}

function usableConfirmed(item) {
  return Boolean(item && !item.rejected && !item.notAvailable && item.userConfirmed && item.value !== null && item.value !== undefined && item.value !== "");
}

function isOutdated(sourceDate, nowMs) {
  if (!sourceDate) return false;
  const dateMs = Date.parse(sourceDate);
  if (!Number.isFinite(dateMs)) return false;
  return nowMs - dateMs > 1000 * 60 * 60 * 24 * 180;
}

function overrideValue(overrides, key) {
  const parsed = toNumber(overrides?.[key]?.value);
  return Number.isFinite(parsed) ? parsed : null;
}

function overrideScenarioProbability(assumptions, scenario) {
  return toNumber(assumptions?.scenarioProbabilities?.[scenario]);
}

function rationale(language, value, label, source, override) {
  if (override?.value !== undefined && override?.reason) {
    return text(language, `${label} تم تعديله بواسطة المستثمر إلى ${formatNumber(value)} بسبب: ${override.reason}.`, `${label} was overridden by the investor to ${formatNumber(value)} because: ${override.reason}.`);
  }
  return text(language, `${label} تم اختياره من ${source} مع تمييزه كافتراض منهجي عند نقص البيانات.`, `${label} was selected from ${source} and labeled as a methodology assumption where company data is missing.`);
}

function explanationArabic(methodName) {
  return `${methodName} مناسب هنا لأنه يستخدم البيانات المؤكدة المتاحة، ولا يدخل أي رقم غير مدعوم كمعلومة شركة.`;
}

function excludedReason(model, classification, inputs, language) {
  if (["DCF", "Price/FCF", "Reverse DCF"].includes(model) && !positive(inputs.freeCashFlow)) return text(language, `تم استبعاد ${model} بسبب نقص FCF مؤكد.`, `${model} was excluded because confirmed FCF is missing.`);
  if (model === "P/E" && !positive(inputs.eps)) return text(language, "تم استبعاد P/E بسبب نقص EPS مؤكد.", "P/E was excluded because confirmed EPS is missing.");
  if (model === "EV/EBITDA" && !positive(inputs.ebitda)) return text(language, "تم استبعاد EV/EBITDA بسبب نقص EBITDA مؤكد.", "EV/EBITDA was excluded because confirmed EBITDA is missing.");
  if (model === "Morningstar Fair Value" && !positive(inputs.morningstarFairValue)) return text(language, "تم استبعاد Morningstar Fair Value لأنه لم يتم إدخاله.", "Morningstar Fair Value was excluded because it was not supplied.");
  if (model === "Analyst Consensus" && !positive(inputs.analystTargetAverage)) return text(language, "تم استبعاد Analyst Consensus بسبب نقص السعر المستهدف.", "Analyst Consensus was excluded because target price is missing.");
  return text(language, `تم استبعاد ${model} لأنه أقل ملاءمة لتصنيف ${classification}.`, `${model} was excluded because it is less appropriate for the ${classification} classification.`);
}

function performanceLine(value, label, language) {
  if (!Number.isFinite(toNumber(value))) return text(language, `${label}: غير متوفر من بيانات مؤكدة.`, `${label}: not available from confirmed data.`);
  return `${label}: ${formatNumber(value)}`;
}

function scenarioReport(scenario) {
  return {
    probability: scenario.probability,
    fairValue: scenario.fairValue,
    revenueAssumptions: scenario.revenueAssumption,
    marginAssumptions: scenario.marginAssumption,
    fcfAssumptions: scenario.fcfAssumption,
    capexAssumptions: scenario.capexAssumption,
    wacc: scenario.wacc,
    terminalGrowth: scenario.terminalGrowth,
    exitMultiple: scenario.exitMultiple,
    forecast: scenario.forecast,
    keyRisks: scenario.keyRisks,
    keyCatalysts: scenario.keyCatalysts
  };
}

function scenarioRisks(name, classification, language) {
  if (name === "Bear") return [text(language, `تباطؤ Growth وضغط الهوامش في تصنيف ${classification.classification}.`, `Slower Growth and margin pressure for the ${classification.classification} classification.`)];
  return [text(language, "الافتراضات قد تفشل إذا تغيرت البيئة التنافسية أو ارتفع WACC.", "Assumptions may fail if competition changes or WACC rises.")];
}

function scenarioCatalysts(name, language) {
  if (name === "Bull") return [text(language, "تحسن الهوامش واستدامة cash conversion يمكن أن يرفعا Fair Value.", "Margin improvement and durable cash conversion could lift Fair Value.")];
  return [text(language, "تحقق Guidance واستقرار الهوامش يدعمان السيناريو.", "Guidance delivery and margin stability support the scenario.")];
}

function risksFromInputs(inputs, bear, language) {
  const risks = [text(language, "أي انخفاض في Revenue Growth أو ضغط في Operating Margin يخفض Base Fair Value.", "Any decline in Revenue Growth or pressure on Operating Margin lowers Base Fair Value.")];
  if (!positive(inputs.cash) || positive(inputs.totalDebt)) risks.push(text(language, "الرافعة المالية أو نقص بيانات النقد والدين يخفض الثقة.", "Leverage or missing cash/debt data reduces confidence."));
  if (bear?.fairValue) risks.push(text(language, "Bear scenario يوضح حساسية التقييم للهوامش وWACC.", "The Bear scenario shows valuation sensitivity to margins and WACC."));
  return risks;
}

function catalystsFromInputs(inputs, bull, language) {
  const catalysts = [text(language, "تحسن FCF conversion هو المحفز الأهم للتقييم.", "Improved FCF conversion is the most important valuation catalyst.")];
  if (bull?.fairValue) catalysts.push(text(language, "Bull scenario يتطلب نموًا أقوى مع انضباط CapEx.", "The Bull scenario requires stronger growth with CapEx discipline."));
  return catalysts;
}

function whatWouldChange(language) {
  return [
    text(language, "تغير WACC بأكثر من 100 نقطة أساس.", "A WACC change greater than 100 bps."),
    text(language, "تغير Base FCF Growth أو Operating Margin عن الافتراض.", "A change in Base FCF Growth or Operating Margin versus assumptions."),
    text(language, "ظهور بيانات جديدة من Morningstar أو Analyst Consensus.", "New Morningstar or Analyst Consensus data.")
  ];
}

function positiveDrivers(modelSelection, inputs, language) {
  return [
    modelSelection.selected.length ? text(language, "وجود أكثر من نموذج تقييم مدعوم ببيانات مؤكدة.", "Multiple valuation models are supported by confirmed data.") : "",
    positive(inputs.freeCashFlow) ? "FCF" : "",
    positive(inputs.morningstarFairValue) ? "Morningstar Fair Value" : ""
  ].filter(Boolean);
}

function negativeDrivers(workspace, inputs, language) {
  return [
    workspace.dataReview.missing.length ? text(language, "بعض البيانات المطلوبة لا تزال ناقصة.", "Some required data remains missing.") : "",
    !positive(inputs.ebitda) ? "EBITDA" : "",
    !positive(inputs.analystTargetAverage) ? "Analyst Consensus" : ""
  ].filter(Boolean);
}

function limitations(workspace, modelSelection, language) {
  const limitationsList = [];
  if (workspace.dataReview.missing.length) limitationsList.push(text(language, "بعض الحقول مفقودة ولا يتم تعويضها بأرقام مخترعة.", "Some fields are missing and are not replaced with invented values."));
  if (!modelSelection.selected.some((item) => item.method === "DCF")) limitationsList.push(text(language, "DCF غير متاح أو منخفض الثقة بسبب نقص FCF أو الأسهم.", "DCF is unavailable or low-confidence because FCF or share count is missing."));
  return limitationsList.length ? limitationsList : [text(language, "لا توجد قيود حرجة بعد مراجعة البيانات.", "No critical limitations after data review.")];
}

function decisionWhy(recommendation, upside, language) {
  return text(language,
    `${recommendation} لأن العائد المتوقع المحسوب من Range FV هو ${formatPercent(upside)} مع تطبيق منهجية ثابتة.`,
    `${recommendation} because expected upside from Range FV is ${formatPercent(upside)} under the fixed methodology.`);
}

function decisionWhyNot(recommendation, workspace, language) {
  if (recommendation === "BUY") return text(language, "ليست توصية شراء غير مشروطة؛ تعتمد على جودة البيانات والافتراضات المؤكدة.", "This is not an unconditional buy; it depends on data quality and confirmed assumptions.");
  if (recommendation === "SELL") return text(language, "قد لا يكون البيع مناسبًا إذا ظهرت بيانات جديدة ترفع FCF أو تخفض WACC.", "Sell may not hold if new data raises FCF or lowers WACC.");
  return text(language, `HOLD لأن هامش الأمان أو اكتمال البيانات لا يكفي لتوصية أقوى.`, `HOLD because margin of safety or data completeness is not strong enough for a more decisive call.`);
}

function betaFor(classification) {
  const map = {
    "Mature Cash Generator": 0.95,
    "High-Growth Profitable Company": 1.15,
    "Cyclical Company": 1.25,
    "Capital-Intensive Company": 1.2,
    "Financial Institution": 1.05,
    "Early-Stage Growth Company": 1.35,
    "Commodity Company": 1.3,
    "Holding Company / Conglomerate": 1,
    REIT: 0.9,
    "Unprofitable Growth Company": 1.45
  };
  return map[classification] || VALUATION_POLICY.wacc.defaultBeta;
}

function workspaceId(ticker) {
  return `workspace-${String(ticker || "draft").toUpperCase()}-${Date.now()}`;
}

function approvedVersionId(ticker, timestamp) {
  return `VAL-${String(ticker || "TICKER").toUpperCase()}-${timestamp.replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

function scenarioMetric(report, name, key) {
  const scenario = name === "Bear" ? report?.bearScenario : name === "Base" ? report?.baseScenario : report?.bullScenario;
  return scenario?.forecast?.[scenario.forecast.length - 1]?.[key] ?? scenario?.[key];
}

function positive(value) {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function text(language, ar, en) {
  return language === "ar" ? ar : en;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff%/ ]/g, "").replace(/\s+/g, " ").trim();
}

function formatNumber(value) {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return "-";
  return Math.abs(parsed) >= 1000 ? Math.round(parsed).toLocaleString("en-US") : Number(parsed.toFixed(4)).toString();
}

function formatPercent(value) {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return "-";
  return `${(parsed * 100).toFixed(1)}%`;
}
