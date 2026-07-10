import { createCompanyShell } from "../data/sampleData.js";
import { createDataField, hasUsableValue, isDataField, missingField, readFieldValue, selectField, SOURCES, statusFromTimestamp, UPDATE_STATUS } from "./fields.js";
import { PROVIDER_TYPES, providerConfidence } from "./providerContracts.js";

const FINANCIAL_FIELDS = [
  "revenue",
  "grossProfit",
  "operatingIncome",
  "netIncome",
  "eps",
  "freeCashFlow",
  "operatingCashFlow",
  "capex",
  "ebitda",
  "cash",
  "debt",
  "equity",
  "shares",
  "dividends",
  "buybacks"
];

const CORE_HEALTH_FIELDS = [
  ["quote.price", "Current price", 12],
  ["quote.marketCap", "Market capitalization", 5],
  ["financials.latest.revenue", "Revenue", 10],
  ["financials.latest.grossProfit", "Gross profit", 5],
  ["financials.latest.operatingIncome", "Operating income", 8],
  ["financials.latest.netIncome", "Net income", 5],
  ["financials.latest.eps", "EPS", 8],
  ["financials.latest.freeCashFlow", "Free cash flow", 12],
  ["financials.latest.cash", "Cash", 5],
  ["financials.latest.debt", "Debt", 5],
  ["financials.latest.equity", "Equity", 5],
  ["financials.latest.shares", "Diluted shares", 5],
  ["consensus.target", "Analyst target", 3],
  ["manual.morningstarFairValue", "Morningstar fair value", 2]
];

export function buildUnifiedDataCompany(rawCompany, options = {}) {
  const baseCompany = rawCompany || createCompanyShell(options.ticker);
  const source = options.source || inferFallbackSource(baseCompany);
  const provider = options.provider || defaultProviderForSource(source);
  const timestamp = options.timestamp || baseCompany.quote?.updatedAt || new Date().toISOString();
  const manualInputs = options.manualInputs || {};
  const previousCompany = options.previousCompany || null;
  const fields = {};
  const quote = wrapQuote(baseCompany.quote || {}, { source, timestamp, provider, fields });
  const consensus = wrapConsensus(baseCompany.consensus || {}, { source, timestamp, provider, fields });
  const financials = wrapFinancialRows(baseCompany.financials || [], { source, timestamp, provider, fields });
  const manualFields = wrapManualFields(manualInputs, fields);
  const financialTimeline = buildFinancialTimeline(baseCompany, { source, timestamp, provider });
  const mergedTimeline = mergeTimeline(previousCompany?.dataPlatform?.timeline, financialTimeline);

  const unified = {
    ...baseCompany,
    quote,
    consensus,
    financials,
    dataPlatform: {
      version: "4.0",
      providerFallbackOrder: ["Morningstar", "Financial Modeling Prep", "Manual Input", "Missing"],
      providers: options.providers || [provider],
      activeSource: source,
      updatedAt: timestamp,
      fields,
      manualFields,
      timeline: mergedTimeline,
      fieldCount: Object.keys(fields).length
    }
  };
  unified.dataPlatform.health = assessDataHealth(unified);
  return unified;
}

export function mergeCompanyDataHistory(previousCompany, nextCompany) {
  if (!previousCompany?.dataPlatform?.timeline || previousCompany.ticker !== nextCompany.ticker) return nextCompany;
  const merged = {
    ...nextCompany,
    dataPlatform: {
      ...nextCompany.dataPlatform,
      timeline: mergeTimeline(previousCompany.dataPlatform.timeline, nextCompany.dataPlatform?.timeline)
    }
  };
  merged.dataPlatform.health = assessDataHealth(merged);
  return merged;
}

export function assessDataHealth(company) {
  const fields = company.dataPlatform?.fields || {};
  const rows = CORE_HEALTH_FIELDS.map(([key, label, weight]) => {
    const field = fields[key] || missingField(key);
    const status = field.updateStatus;
    const quality = fieldQuality(field);
    return { key, label, weight, field, status, quality };
  });
  const totalWeight = rows.reduce((sum, item) => sum + item.weight, 0);
  const weightedQuality = rows.reduce((sum, item) => sum + item.weight * item.quality, 0);
  const missingFields = rows.filter((item) => item.status === UPDATE_STATUS.MISSING).map(toHealthItem);
  const outdatedFields = rows.filter((item) => item.status === UPDATE_STATUS.OUTDATED).map(toHealthItem);
  const conflictingFields = [
    ...rows.filter((item) => item.status === UPDATE_STATUS.CONFLICT).map(toHealthItem),
    ...collectTimelineConflicts(company.dataPlatform?.timeline)
  ];
  const overallScore = totalWeight ? Math.round(weightedQuality / totalWeight) : 0;
  return {
    overallScore,
    rating: overallScore >= 85 ? "Institutional" : overallScore >= 70 ? "Researchable" : overallScore >= 45 ? "Limited" : "Insufficient",
    missingFields,
    outdatedFields,
    conflictingFields,
    fieldCount: Object.keys(fields).length,
    timelinePeriods: countTimelinePeriods(company.dataPlatform?.timeline)
  };
}

export function getField(company, key) {
  return company.dataPlatform?.fields?.[key] || missingField(key);
}

function wrapQuote(quote, context) {
  return {
    price: register(context.fields, "quote.price", providerField(quote.price, "quote.price", PROVIDER_TYPES.QUOTE, context, 2)),
    marketCap: register(context.fields, "quote.marketCap", providerField(quote.marketCap, "quote.marketCap", PROVIDER_TYPES.QUOTE, context, 2)),
    changePercent: register(context.fields, "quote.changePercent", providerField(quote.changePercent, "quote.changePercent", PROVIDER_TYPES.QUOTE, context, 2)),
    enterpriseValue: register(context.fields, "quote.enterpriseValue", providerField(quote.enterpriseValue, "quote.enterpriseValue", PROVIDER_TYPES.QUOTE, context, 2)),
    updatedAt: quote.updatedAt || context.timestamp
  };
}

function wrapConsensus(consensus, context) {
  return {
    target: register(context.fields, "consensus.target", providerField(consensus.target, "consensus.target", PROVIDER_TYPES.ANALYST, context, 120)),
    low: register(context.fields, "consensus.low", providerField(consensus.low, "consensus.low", PROVIDER_TYPES.ANALYST, context, 120)),
    high: register(context.fields, "consensus.high", providerField(consensus.high, "consensus.high", PROVIDER_TYPES.ANALYST, context, 120)),
    rating: register(context.fields, "consensus.rating", providerField(consensus.rating, "consensus.rating", PROVIDER_TYPES.ANALYST, context, 120))
  };
}

function wrapFinancialRows(financials, context) {
  const sorted = [...financials].sort((a, b) => valueOf(b.year) - valueOf(a.year));
  const rows = sorted.map((row) => wrapFinancialRow(row, context, "annual", "financials"));
  const latest = rows[0];
  if (latest) {
    for (const field of FINANCIAL_FIELDS) {
      context.fields[`financials.latest.${field}`] = latest[field] || missingField(`financials.latest.${field}`);
    }
  }
  return rows;
}

function wrapFinancialRow(row, context, period, statement) {
  const year = valueOf(row.year);
  const wrapped = {
    year,
    fiscalPeriod: row.fiscalPeriod || period,
    date: row.date || String(year || ""),
    period
  };
  for (const field of FINANCIAL_FIELDS) {
    wrapped[field] = providerField(row[field], field, PROVIDER_TYPES.FINANCIAL, {
      ...context,
      statement,
      period,
      fiscalPeriod: wrapped.fiscalPeriod
    }, period === "quarterly" ? 135 : 540);
  }
  return wrapped;
}

function wrapManualFields(manualInputs, fields) {
  const hasMorningstar = hasUsableValue(manualInputs.morningstarFairValue);
  const hasAverageCost = hasUsableValue(manualInputs.averageCost);
  const morningstar = createDataField(manualInputs.morningstarFairValue, {
    field: "manual.morningstarFairValue",
    source: hasMorningstar ? SOURCES.MANUAL : SOURCES.MISSING,
    confidence: 70,
    updateStatus: hasMorningstar ? UPDATE_STATUS.MANUAL : UPDATE_STATUS.MISSING,
    providerType: PROVIDER_TYPES.RESEARCH,
    timestamp: hasMorningstar ? new Date().toISOString() : null
  });
  const averageCost = createDataField(manualInputs.averageCost, {
    field: "manual.averageCost",
    source: hasAverageCost ? SOURCES.MANUAL : SOURCES.MISSING,
    confidence: 70,
    updateStatus: hasAverageCost ? UPDATE_STATUS.MANUAL : UPDATE_STATUS.MISSING,
    providerType: PROVIDER_TYPES.RESEARCH,
    timestamp: hasAverageCost ? new Date().toISOString() : null
  });
  fields["manual.morningstarFairValue"] = morningstar;
  fields["manual.averageCost"] = averageCost;
  return { morningstarFairValue: morningstar, averageCost };
}

function buildFinancialTimeline(company, context) {
  const rawTimeline = company.financialTimeline || {};
  const annual = rawTimeline.annual || {};
  const quarterly = rawTimeline.quarterly || {};
  return {
    annual: {
      incomeStatements: wrapStatementRows(annual.incomeStatements || deriveIncomeStatements(company.financials), context, "annual", "incomeStatement"),
      balanceSheets: wrapStatementRows(annual.balanceSheets || deriveBalanceSheets(company.financials), context, "annual", "balanceSheet"),
      cashFlowStatements: wrapStatementRows(annual.cashFlowStatements || deriveCashFlowStatements(company.financials), context, "annual", "cashFlowStatement")
    },
    quarterly: {
      incomeStatements: wrapStatementRows(quarterly.incomeStatements || [], context, "quarterly", "incomeStatement"),
      balanceSheets: wrapStatementRows(quarterly.balanceSheets || [], context, "quarterly", "balanceSheet"),
      cashFlowStatements: wrapStatementRows(quarterly.cashFlowStatements || [], context, "quarterly", "cashFlowStatement")
    }
  };
}

function wrapStatementRows(rows, context, period, statement) {
  return [...rows]
    .sort((a, b) => String(b.date || b.year || "").localeCompare(String(a.date || a.year || "")))
    .map((row) => wrapFinancialRow(row, context, period, statement));
}

function mergeTimeline(previous, current) {
  if (!previous) return current;
  return {
    annual: {
      incomeStatements: mergeRows(previous.annual?.incomeStatements, current.annual.incomeStatements),
      balanceSheets: mergeRows(previous.annual?.balanceSheets, current.annual.balanceSheets),
      cashFlowStatements: mergeRows(previous.annual?.cashFlowStatements, current.annual.cashFlowStatements)
    },
    quarterly: {
      incomeStatements: mergeRows(previous.quarterly?.incomeStatements, current.quarterly.incomeStatements),
      balanceSheets: mergeRows(previous.quarterly?.balanceSheets, current.quarterly.balanceSheets),
      cashFlowStatements: mergeRows(previous.quarterly?.cashFlowStatements, current.quarterly.cashFlowStatements)
    }
  };
}

function mergeRows(previousRows = [], currentRows = []) {
  const rows = new Map();
  for (const row of previousRows) rows.set(rowKey(row), row);
  for (const row of currentRows) {
    const key = rowKey(row);
    if (rows.has(key)) {
      const prior = rows.get(key);
      rows.set(key, {
        ...row,
        priorVersions: [stripPriorVersions(prior), ...(prior.priorVersions || [])].slice(0, 5)
      });
    } else {
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => String(b.date || b.year || "").localeCompare(String(a.date || a.year || "")));
}

function providerField(value, field, providerType, context, staleAfterDays) {
  const candidate = createDataField(value, {
    field,
    source: context.source,
    timestamp: context.timestamp,
    confidence: providerConfidence(context.provider, providerType),
    updateStatus: statusFromTimestamp(value, context.timestamp, staleAfterDays),
    providerType,
    statement: context.statement || "",
    period: context.period || "",
    fiscalPeriod: context.fiscalPeriod || ""
  });
  return selectField(field, [candidate], {
    providerType,
    source: SOURCES.MISSING
  });
}

function register(fields, key, field) {
  fields[key] = field;
  return field;
}

function fieldQuality(field) {
  if (!isDataField(field) || field.updateStatus === UPDATE_STATUS.MISSING) return 0;
  const confidence = Number.isFinite(field.confidence) ? field.confidence : 70;
  if (field.updateStatus === UPDATE_STATUS.CONFLICT) return confidence * 0.5;
  if (field.updateStatus === UPDATE_STATUS.OUTDATED) return confidence * 0.6;
  return confidence;
}

function toHealthItem(item) {
  return {
    key: item.key,
    label: item.label,
    source: item.field.source,
    timestamp: item.field.timestamp,
    confidence: item.field.confidence,
    updateStatus: item.field.updateStatus
  };
}

function collectTimelineConflicts(timeline) {
  const rows = [
    ...(timeline?.annual?.incomeStatements || []),
    ...(timeline?.annual?.balanceSheets || []),
    ...(timeline?.annual?.cashFlowStatements || []),
    ...(timeline?.quarterly?.incomeStatements || []),
    ...(timeline?.quarterly?.balanceSheets || []),
    ...(timeline?.quarterly?.cashFlowStatements || [])
  ];
  return rows.flatMap((row) => FINANCIAL_FIELDS.flatMap((field) => {
    const value = row[field];
    return value?.conflicts?.length ? [{
      key: `${row.period}.${row.date}.${field}`,
      label: field,
      source: value.source,
      timestamp: value.timestamp,
      confidence: value.confidence,
      updateStatus: value.updateStatus
    }] : [];
  }));
}

function countTimelinePeriods(timeline) {
  return {
    annual: Math.max(
      timeline?.annual?.incomeStatements?.length || 0,
      timeline?.annual?.balanceSheets?.length || 0,
      timeline?.annual?.cashFlowStatements?.length || 0
    ),
    quarterly: Math.max(
      timeline?.quarterly?.incomeStatements?.length || 0,
      timeline?.quarterly?.balanceSheets?.length || 0,
      timeline?.quarterly?.cashFlowStatements?.length || 0
    )
  };
}

function deriveIncomeStatements(financials = []) {
  return financials.map((row) => pick(row, ["year", "date", "revenue", "grossProfit", "operatingIncome", "netIncome", "eps", "ebitda", "shares"]));
}

function deriveBalanceSheets(financials = []) {
  return financials.map((row) => pick(row, ["year", "date", "cash", "debt", "equity"]));
}

function deriveCashFlowStatements(financials = []) {
  return financials.map((row) => pick(row, ["year", "date", "freeCashFlow", "operatingCashFlow", "capex", "dividends", "buybacks"]));
}

function pick(row, keys) {
  return Object.fromEntries(keys.map((key) => [key, row?.[key]]));
}

function rowKey(row) {
  return `${row.period || ""}:${row.fiscalPeriod || ""}:${valueOf(row.date) || valueOf(row.year) || ""}`;
}

function valueOf(value) {
  return readFieldValue(value);
}

function stripPriorVersions(row) {
  const { priorVersions, ...rest } = row;
  return rest;
}

function inferFallbackSource(company) {
  const hasQuote = hasUsableValue(company.quote?.price) || hasUsableValue(company.quote?.marketCap);
  const hasFinancials = Array.isArray(company.financials) && company.financials.some((row) => FINANCIAL_FIELDS.some((field) => hasUsableValue(row[field])));
  const hasConsensus = hasUsableValue(company.consensus?.target);
  return hasQuote || hasFinancials || hasConsensus ? SOURCES.MANUAL : SOURCES.MISSING;
}

function defaultProviderForSource(source) {
  if (source === SOURCES.FMP) {
    return {
      id: "fmp",
      name: SOURCES.FMP,
      providerTypes: [PROVIDER_TYPES.QUOTE, PROVIDER_TYPES.FINANCIAL, PROVIDER_TYPES.ANALYST],
      confidence: {
        [PROVIDER_TYPES.QUOTE]: 98,
        [PROVIDER_TYPES.FINANCIAL]: 96,
        [PROVIDER_TYPES.ANALYST]: 82
      }
    };
  }
  if (source === SOURCES.MANUAL) {
    return {
      id: "manual",
      name: SOURCES.MANUAL,
      providerTypes: [PROVIDER_TYPES.RESEARCH, PROVIDER_TYPES.ANALYST, PROVIDER_TYPES.FINANCIAL, PROVIDER_TYPES.QUOTE],
      confidence: 70
    };
  }
  return {
    id: "missing",
    name: SOURCES.MISSING,
    providerTypes: Object.values(PROVIDER_TYPES),
    confidence: 0
  };
}
