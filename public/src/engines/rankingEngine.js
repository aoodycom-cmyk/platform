const RANKING_WEIGHTS = {
  investmentScore: 30,
  upsideComposite: 15,
  qualityScore: 15,
  growthScore: 10,
  managementScore: 7,
  moatScore: 8,
  riskScore: 8,
  dataQuality: 4,
  confidence: 3
};

const COMPONENT_LABELS = {
  investmentScore: "Investment Score",
  upsideComposite: "Upside %",
  qualityScore: "Quality",
  growthScore: "Growth",
  managementScore: "Management",
  moatScore: "Economic Moat",
  riskScore: "Risk",
  dataQuality: "Data Quality",
  confidence: "Confidence"
};

const UPSIDE_CAP = 0.5;
const UPSIDE_FLOOR = -0.5;

export function scoreEvaluatedCompany(company = {}) {
  const components = normalizedComponents(company);
  const available = Object.entries(components).filter(([, value]) => Number.isFinite(value));
  const availableWeight = available.reduce((sum, [key]) => sum + RANKING_WEIGHTS[key], 0);
  const rankingScore = availableWeight
    ? Math.round(available.reduce((sum, [key, value]) => sum + value * RANKING_WEIGHTS[key], 0) / availableWeight)
    : null;
  const rankingConfidence = rankingConfidenceFor(company, availableWeight);
  const mainPositiveFactor = mainPositive(components);
  const mainNegativeFactor = mainNegative(components);

  return {
    rankingScore,
    rankingConfidence,
    mainPositiveFactor,
    mainNegativeFactor,
    rankingMissingWeight: 100 - availableWeight,
    rankingCoverage: availableWeight,
    rankingComponents: components
  };
}

export function rankEvaluatedCompanies(items = [], sort = {}) {
  const ranked = items.map((item) => ({
    ...item,
    ...scoreEvaluatedCompany(item)
  }));
  const key = sort.key || "rankingPosition";
  const direction = sort.direction === "asc" ? 1 : -1;
  const sorted = key === "rankingPosition"
    ? ranked.sort(defaultRankCompare)
    : ranked.sort((a, b) => customCompare(a, b, key, direction));
  return sorted.map((item, index) => ({
    ...item,
    rankingPosition: index + 1
  }));
}

export function normalizeScore(value) {
  return Number.isFinite(value) ? clamp(value, 0, 100) : null;
}

export function normalizeUpside(value) {
  if (!Number.isFinite(value)) return null;
  const capped = clamp(value, UPSIDE_FLOOR, UPSIDE_CAP);
  return Math.round((capped - UPSIDE_FLOOR) / (UPSIDE_CAP - UPSIDE_FLOOR) * 100);
}

function normalizedComponents(company) {
  const upsideValues = [normalizeUpside(company.upside), normalizeUpside(company.maxFairValueUpside)].filter(Number.isFinite);
  return {
    investmentScore: normalizeScore(company.investmentScore),
    upsideComposite: upsideValues.length ? weightedUpside(upsideValues) : null,
    qualityScore: normalizeScore(company.qualityScore),
    growthScore: normalizeScore(company.growthScore),
    managementScore: normalizeScore(company.managementScore),
    moatScore: normalizeScore(company.moatScore),
    riskScore: normalizeScore(company.riskScore),
    dataQuality: normalizeScore(company.dataQuality),
    confidence: normalizeScore(company.confidence)
  };
}

function weightedUpside(values) {
  if (values.length === 1) return values[0];
  return Math.round(values[0] * 0.7 + values[1] * 0.3);
}

function rankingConfidenceFor(company, availableWeight) {
  const confidence = normalizeScore(company.confidence);
  const dataQuality = normalizeScore(company.dataQuality);
  const evidence = [confidence, dataQuality].filter(Number.isFinite);
  const evidenceScore = evidence.length ? evidence.reduce((sum, value) => sum + value, 0) / evidence.length : 0;
  const actionableMultiplier = company.decisionStatus === "ACTIONABLE" ? 1 : 0.72;
  return Math.round(clamp((availableWeight * 0.75 + evidenceScore * 0.25) * actionableMultiplier, 0, 100));
}

function mainPositive(components) {
  const positive = Object.entries(components)
    .filter(([, value]) => Number.isFinite(value) && value > 55)
    .sort((a, b) => positiveImpact(b) - positiveImpact(a))[0];
  return positive ? COMPONENT_LABELS[positive[0]] : "No strong positive factor";
}

function mainNegative(components) {
  const missing = Object.entries(components).find(([, value]) => !Number.isFinite(value));
  const weak = Object.entries(components)
    .filter(([, value]) => Number.isFinite(value) && value < 45)
    .sort((a, b) => negativeImpact(b) - negativeImpact(a))[0];
  if (weak) return COMPONENT_LABELS[weak[0]];
  if (missing) return `Missing ${COMPONENT_LABELS[missing[0]]}`;
  return "No material negative factor";
}

function positiveImpact([key, value]) {
  return (value - 50) * RANKING_WEIGHTS[key];
}

function negativeImpact([key, value]) {
  return (50 - value) * RANKING_WEIGHTS[key];
}

function defaultRankCompare(a, b) {
  const actionableA = a.decisionStatus === "ACTIONABLE" ? 1 : 0;
  const actionableB = b.decisionStatus === "ACTIONABLE" ? 1 : 0;
  if (actionableA !== actionableB) return actionableB - actionableA;
  if (numberCompare(a.rankingScore, b.rankingScore) !== 0) return numberCompare(b.rankingScore, a.rankingScore);
  if (numberCompare(a.dataQuality, b.dataQuality) !== 0) return numberCompare(b.dataQuality, a.dataQuality);
  return String(a.ticker).localeCompare(String(b.ticker));
}

function customCompare(a, b, key, direction) {
  if (key === "recommendation") {
    return String(a.recommendation || "").localeCompare(String(b.recommendation || "")) * direction || defaultRankCompare(a, b);
  }
  const compared = numberCompare(a[key], b[key]);
  if (compared !== 0) return compared * direction;
  return defaultRankCompare(a, b);
}

function numberCompare(a, b) {
  const aNumber = Number(a);
  const bNumber = Number(b);
  const aFinite = Number.isFinite(aNumber);
  const bFinite = Number.isFinite(bNumber);
  if (aFinite && bFinite) return aNumber - bNumber;
  if (aFinite) return 1;
  if (bFinite) return -1;
  return 0;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
