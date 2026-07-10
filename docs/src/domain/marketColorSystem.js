export const COLOR_CATEGORIES = {
  STRONG_POSITIVE: "strong-positive",
  POSITIVE: "positive",
  AMBER: "amber",
  NEUTRAL: "neutral",
  WARNING: "warning",
  NEGATIVE: "negative",
  MISSING: "missing"
};

export function upsideColorCategory(value) {
  if (!Number.isFinite(value)) return COLOR_CATEGORIES.MISSING;
  if (value >= 0.25) return COLOR_CATEGORIES.STRONG_POSITIVE;
  if (value >= 0.1) return COLOR_CATEGORIES.POSITIVE;
  if (value >= 0) return COLOR_CATEGORIES.NEUTRAL;
  if (value > -0.15) return COLOR_CATEGORIES.WARNING;
  return COLOR_CATEGORIES.NEGATIVE;
}

export function fairValueColorCategory(fairValue, currentPrice, tolerance = 0.02) {
  if (!Number.isFinite(fairValue) || !Number.isFinite(currentPrice) || currentPrice <= 0) return COLOR_CATEGORIES.MISSING;
  const spread = (fairValue - currentPrice) / currentPrice;
  if (Math.abs(spread) <= tolerance) return COLOR_CATEGORIES.NEUTRAL;
  return spread > 0 ? COLOR_CATEGORIES.POSITIVE : COLOR_CATEGORIES.NEGATIVE;
}

export function recommendationColorCategory(recommendation, status) {
  if (status === "INSUFFICIENT_DATA") return COLOR_CATEGORIES.MISSING;
  if (recommendation === "BUY" || recommendation === "شراء") return COLOR_CATEGORIES.POSITIVE;
  if (recommendation === "SELL" || recommendation === "بيع") return COLOR_CATEGORIES.NEGATIVE;
  if (recommendation === "HOLD" || recommendation === "احتفاظ") return COLOR_CATEGORIES.AMBER;
  return COLOR_CATEGORIES.MISSING;
}

export function riskColorCategory(value) {
  if (typeof value === "string") {
    if (value === "Low" || value === "مخاطر منخفضة") return COLOR_CATEGORIES.POSITIVE;
    if (value === "Medium" || value === "مخاطر متوسطة") return COLOR_CATEGORIES.AMBER;
    if (value === "High" || value === "مخاطر مرتفعة") return COLOR_CATEGORIES.NEGATIVE;
  }
  if (!Number.isFinite(value)) return COLOR_CATEGORIES.MISSING;
  if (value >= 75) return COLOR_CATEGORIES.POSITIVE;
  if (value >= 55) return COLOR_CATEGORIES.AMBER;
  return COLOR_CATEGORIES.NEGATIVE;
}

export function scoreColorCategory(score) {
  if (!Number.isFinite(score)) return COLOR_CATEGORIES.MISSING;
  if (score >= 85) return COLOR_CATEGORIES.STRONG_POSITIVE;
  if (score >= 70) return COLOR_CATEGORIES.POSITIVE;
  if (score >= 55) return COLOR_CATEGORIES.AMBER;
  if (score >= 40) return COLOR_CATEGORIES.WARNING;
  return COLOR_CATEGORIES.NEGATIVE;
}

export function colorClass(category, prefix = "signal") {
  return `${prefix}-${category || COLOR_CATEGORIES.MISSING}`;
}

export function colorIcon(category) {
  if (category === COLOR_CATEGORIES.STRONG_POSITIVE || category === COLOR_CATEGORIES.POSITIVE) return "↑";
  if (category === COLOR_CATEGORIES.WARNING || category === COLOR_CATEGORIES.NEGATIVE) return "↓";
  if (category === COLOR_CATEGORIES.MISSING) return "—";
  return "→";
}

export function formatSignedPercent(value, digits = 0) {
  if (!Number.isFinite(value)) return "—";
  const rounded = (value * 100).toFixed(digits);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}
