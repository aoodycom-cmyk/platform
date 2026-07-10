import { compact, money, percent, safeDiv, toNumber } from "../domain/financialMetrics.js";
import { analysisText, decisionLabel, exitThesisText, factorLabel, ratingLabel, sourceLabel } from "../i18n/language.js";

const MISSING = "غير متوفر من بيانات موثقة.";

export function buildInstitutionalResearch(researchResult) {
  const company = researchResult.company;
  const profile = buildCompanyProfile(company);
  const competitive = buildCompetitiveAnalysis(company, researchResult);
  const performance = buildHistoricalPerformance(company);
  const historicalValuation = buildHistoricalValuation(company);
  const earnings = buildEarningsCenter(company);
  const analyst = buildAnalystConsensus(company);
  const thesis = buildInvestmentThesis(researchResult);
  const timeline = buildResearchTimeline(company);
  const cio = buildCioSummary({ company, researchResult, profile, competitive, thesis });

  return {
    profile,
    competitive,
    performance,
    historicalValuation,
    earnings,
    analyst,
    thesis,
    timeline,
    cio
  };
}

function buildCompanyProfile(company) {
  const source = sourceLabel(company.researchProfile?.source || company.dataPlatform?.activeSource || "Verified provider data");
  return {
    source,
    businessSummary: text(company.researchProfile?.businessSummary),
    businessModel: text(company.researchProfile?.businessModel),
    revenueSegments: list(company.researchProfile?.revenueSegments),
    geographicExposure: list(company.researchProfile?.geographicExposure),
    customers: list(company.researchProfile?.customers),
    competitiveAdvantages: list([
      ...(company.researchProfile?.competitiveAdvantages || []),
      ...(company.qualitative?.moatSignals || [])
    ]),
    keyProducts: list(company.researchProfile?.keyProducts),
    management: list(company.researchProfile?.management)
  };
}

function buildCompetitiveAnalysis(company, researchResult) {
  return {
    mainCompetitors: list(company.researchProfile?.competitors),
    marketShare: list(company.researchProfile?.marketShare),
    competitiveStrengths: list([
      ...(company.researchProfile?.competitiveStrengths || []),
      ...(researchResult.moat?.factors || []).filter((item) => item.status !== "missing").map((item) => item.label)
    ]),
    competitiveWeaknesses: list([
      ...(company.researchProfile?.competitiveWeaknesses || []),
      ...(researchResult.risk?.factors || []).filter((item) => item.status !== "missing" && item.impact < 0).map((item) => item.label)
    ]),
    peerComparison: list(company.researchProfile?.peerComparison)
  };
}

function buildHistoricalPerformance(company) {
  const rows = [...(company.financials || [])]
    .map(performanceRow)
    .filter((row) => Number.isFinite(row.year))
    .sort((a, b) => a.year - b.year)
    .slice(-10);
  return {
    rows,
    charts: {
      revenue: chartSeries(rows, "revenue"),
      eps: chartSeries(rows, "eps"),
      freeCashFlow: chartSeries(rows, "freeCashFlow"),
      operatingMargin: chartSeries(rows, "operatingMargin"),
      roic: chartSeries(rows, "roic"),
      grossMargin: chartSeries(rows, "grossMargin"),
      debt: chartSeries(rows, "debt"),
      shares: chartSeries(rows, "shares")
    },
    summary: rows.length ? `${rows.length} annual periods available.` : MISSING
  };
}

function buildHistoricalValuation(company) {
  const current = latestFinancial(company);
  const price = toNumber(company.quote?.price);
  const enterpriseValue = toNumber(company.quote?.enterpriseValue) || toNumber(company.quote?.marketCap);
  const marketCap = toNumber(company.quote?.marketCap);
  const shares = toNumber(current.shares);
  const currentMarketCap = Number.isFinite(marketCap) ? marketCap : Number.isFinite(price) && Number.isFinite(shares) ? price * shares : null;
  const metrics = [
    multiple("P/E", safeDiv(price, toNumber(current.eps)), null),
    multiple("EV/EBITDA", safeDiv(enterpriseValue, toNumber(current.ebitda)), null),
    multiple("EV/Sales", safeDiv(enterpriseValue, toNumber(current.revenue)), null),
    multiple("Price/FCF", safeDiv(currentMarketCap, toNumber(current.freeCashFlow)), null)
  ];
  return {
    metrics,
    note: "النسب المئوية التاريخية للتقييم تتطلب أسعار سوقية أو Enterprise Value تاريخية موثقة."
  };
}

function buildEarningsCenter(company) {
  const earnings = company.earningsCenter || {};
  return {
    lastEarnings: text(earnings.lastEarnings),
    revenueSurprise: numericText(earnings.revenueSurprise, percent),
    epsSurprise: numericText(earnings.epsSurprise, percent),
    guidance: text(earnings.guidance),
    managementCommentarySummary: text(earnings.managementCommentarySummary),
    nextEarningsDate: text(earnings.nextEarningsDate)
  };
}

function buildAnalystConsensus(company) {
  const consensus = company.consensus || {};
  return {
    targetPrices: {
      low: toNumber(consensus.low),
      average: toNumber(consensus.target),
      high: toNumber(consensus.high)
    },
    rating: text(consensus.rating),
    ratingDistribution: list(company.analystResearch?.ratingDistribution),
    recentUpgrades: list(company.analystResearch?.recentUpgrades),
    recentDowngrades: list(company.analystResearch?.recentDowngrades),
    consensusTrend: list(company.analystResearch?.consensusTrend)
  };
}

function buildInvestmentThesis(researchResult) {
  const positives = researchResult.explanation.positives || [];
  const negatives = researchResult.explanation.negatives || [];
  return {
    whyInvest: list(positives.map(factorMemoLine)),
    whyAvoid: list(negatives.map(factorMemoLine)),
    biggestOpportunities: list([
      ...positiveFactorLabels(researchResult.growth),
      ...positiveFactorLabels(researchResult.quality),
      ...positiveFactorLabels(researchResult.moat)
    ]),
    biggestRisks: list([
      ...negativeFactorLabels(researchResult.risk),
      ...negativeFactorLabels(researchResult.quality),
      ...negativeFactorLabels(researchResult.growth)
    ]),
    thesisChange: list([
      exitThesisText(researchResult.decision),
      ...(researchResult.dataCompleteness.missing || []).slice(0, 3).map((field) => `تحتاج الفرضية أدلة إضافية: ${factorLabel(field)}.`)
    ])
  };
}

function buildResearchTimeline(company) {
  const explicitEvents = Array.isArray(company.researchTimeline) ? company.researchTimeline : [];
  const annualRows = company.dataPlatform?.timeline?.annual?.cashFlowStatements || [];
  const capitalReturnEvents = annualRows.flatMap((row) => {
    const events = [];
    const year = toNumber(row.year);
    const dividends = toNumber(row.dividends);
    const buybacks = toNumber(row.buybacks);
    if (Number.isFinite(dividends) && dividends > 0) {
      events.push(event(year, "Dividend", `توزيعات أرباح مدفوعة: ${money(dividends)}`, row.dividends?.source));
    }
    if (Number.isFinite(buybacks) && buybacks > 0) {
      events.push(event(year, "Buybacks", `إعادة شراء أسهم: ${money(buybacks)}`, row.buybacks?.source));
    }
    return events;
  });
  return [...explicitEvents.map(normalizeEvent), ...capitalReturnEvents]
    .filter((item) => item.date || item.year)
    .sort((a, b) => String(b.date || b.year).localeCompare(String(a.date || a.year)))
    .slice(0, 40);
}

function buildCioSummary({ company, researchResult, profile, thesis }) {
  const fairValueLine = Number.isFinite(researchResult.valuation.compositeFairValue)
    ? `Composite Fair Value عند ${money(researchResult.valuation.compositeFairValue)} مقابل السعر الحالي ${money(company.quote?.price, 2)}.`
    : "Composite Fair Value غير متوفر لأن مدخلات Valuation الأساسية غير مكتملة.";
  const parts = [
    `${company.ticker}: التوصية ${decisionLabel(researchResult.decision.label)} بدرجة ثقة ${researchResult.decision.confidence}%.`,
    fairValueLine,
    `جودة البيانات ${researchResult.dataHealth.overallScore}/100، والتصنيف ${ratingLabel(researchResult.dataCompleteness.rating)}.`,
    profile.businessSummary !== MISSING ? `ملخص الأعمال: ${analysisText(profile.businessSummary)}` : "",
    thesis.whyInvest[0] !== MISSING ? `الدعم الاستثماري: ${thesis.whyInvest.slice(0, 2).join(" ")}` : "",
    thesis.whyAvoid[0] !== MISSING ? `أهم الاعتراضات: ${thesis.whyAvoid.slice(0, 2).join(" ")}` : "",
    `توجيه المركز: ${exitThesisText(researchResult.decision)}`
  ].filter(Boolean);
  return limitWords(parts.join(" "), 300);
}

function performanceRow(row) {
  const revenue = toNumber(row.revenue);
  const grossProfit = toNumber(row.grossProfit);
  const operatingIncome = toNumber(row.operatingIncome);
  const fcf = toNumber(row.freeCashFlow);
  const cash = toNumber(row.cash);
  const debt = toNumber(row.debt);
  const equity = toNumber(row.equity);
  const investedCapital = Number.isFinite(debt) && Number.isFinite(equity) && Number.isFinite(cash) ? debt + equity - cash : null;
  const nopat = Number.isFinite(operatingIncome) ? operatingIncome * 0.82 : null;
  return {
    year: toNumber(row.year),
    revenue,
    eps: toNumber(row.eps),
    freeCashFlow: fcf,
    operatingMargin: safeDiv(operatingIncome, revenue),
    roic: investedCapital > 0 ? safeDiv(nopat, investedCapital) : null,
    grossMargin: safeDiv(grossProfit, revenue),
    debt,
    shares: toNumber(row.shares)
  };
}

function latestFinancial(company) {
  return [...(company.financials || [])].sort((a, b) => toNumber(b.year) - toNumber(a.year))[0] || {};
}

function chartSeries(rows, key) {
  const values = rows.map((row) => ({ year: row.year, value: row[key] })).filter((item) => Number.isFinite(item.value));
  const max = Math.max(...values.map((item) => Math.abs(item.value)), 0);
  return values.map((item) => ({
    ...item,
    width: max ? Math.max(4, Math.round(Math.abs(item.value) / max * 100)) : 0
  }));
}

function multiple(label, current, history) {
  return {
    label,
    current,
    history: Array.isArray(history) ? history : [],
    percentile: Array.isArray(history) && history.length ? percentile(current, history) : null
  };
}

function percentile(current, history) {
  if (!Number.isFinite(current)) return null;
  const clean = history.filter(Number.isFinite).sort((a, b) => a - b);
  if (!clean.length) return null;
  return clean.filter((value) => value <= current).length / clean.length;
}

function positiveFactorLabels(engine) {
  return (engine?.factors || []).filter((item) => item.impact > 0 && item.status !== "missing").map(factorMemoLine);
}

function negativeFactorLabels(engine) {
  return (engine?.factors || []).filter((item) => item.impact < 0 || item.status === "missing").map(factorMemoLine);
}

function factorMemoLine(item) {
  return `${factorLabel(item.label)}: ${analysisText(item.explanation)}`;
}

function normalizeEvent(item) {
  return {
    date: item.date || "",
    year: item.year || "",
    type: item.type || "Research",
    title: item.title || item.description || MISSING,
    source: sourceLabel(item.source || "Verified provider data")
  };
}

function event(year, type, title, source) {
  return { year, type, title, source: sourceLabel(source || "Verified provider data") };
}

function text(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return MISSING;
}

function numericText(value, formatter) {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? formatter(parsed) : MISSING;
}

function list(values) {
  const clean = Array.isArray(values) ? values.filter((item) => typeof item === "string" ? item.trim() : Boolean(item)).map(String) : [];
  return clean.length ? [...new Set(clean)] : [MISSING];
}

function limitWords(text, maxWords) {
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(" ")}...`;
}

export function formatResearchValue(value, kind = "number") {
  if (!Number.isFinite(value)) return "-";
  if (kind === "money") return money(value);
  if (kind === "compact") return compact(value);
  if (kind === "percent") return percent(value);
  if (kind === "multiple") return `${value.toFixed(1)}x`;
  return String(value);
}
