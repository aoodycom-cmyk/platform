import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFranklinV3ReportTemplate } from "../src/externalAnalysis/v3Contract.js";

const ROOT = dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const OUT_DIR = join(ROOT, "artifacts", "audit-repair");
const previousReport = {
  id: "MATRIX-PREVIOUS",
  reportPeriod: "Q1 2026",
  analysisDate: "2026-04-25",
  company: {
    ticker: "MATRIX",
    name: "Matrix Coverage Inc.",
    sector: "Technology",
    industry: "Software",
    currency: "USD"
  },
  fairValueSummary: {
    fairValueLow: 70,
    fairValueBase: 100,
    fairValueHigh: 140,
    probabilityWeightedFairValue: 102
  },
  thesis: { shortSummary: "Previous thesis snapshot." },
  priceTargetRequirements: {
    requirementSetId: "MATRIX_Q2_2026",
    previousQuarter: "Q1 2026",
    targetQuarter: "Q2 2026",
    earningsPeriod: "Q2 2026",
    requirements: [
      {
        id: "q2_revenue_cap",
        name: "Revenue Cap",
        arabicName: "Revenue Cap",
        metric: "Revenue",
        type: "maximum",
        baselineValue: 25,
        baselineDisplay: "$25m",
        previousValue: 25,
        previousDisplay: "$25m",
        currentLevel: 25,
        requiredValue: 30,
        requiredDisplay: "<= $30m",
        unit: "USD",
        currency: "USD",
        accountingBasis: "non-GAAP",
        period: "Q2 2026",
        importance: "high",
        weight: 100,
        whyItMatters: "Frozen semantic field coverage.",
        status: "NOT_REPORTED"
      }
    ]
  }
};

const template = buildFranklinV3ReportTemplate({
  analysisType: "EARNINGS_REVALUATION",
  previousReport,
  selectedPeriod: "Q2 2026"
});
const rows = flatten(template).map((row) => ({
  sourcePath: row.path,
  type: inferType(row.path, row.value),
  requiredNullablePolicy: policyFor(row.path, row.value),
  normalizer: normalizerFor(row.path),
  validator: validatorFor(row.path),
  canonicalDestination: canonicalDestination(row.path),
  persistenceDestination: `externalAnalyses[ticker].metadata.franklinV3Report.${row.path}`,
  consumer: consumerFor(row.path),
  exportReimportPath: `external-analysis-report/v2.metadata.franklinV3Report.${row.path}`,
  intentionalTransform: transformFor(row.path),
  test: testFor(row.path)
}));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, "v3-field-matrix.json"), `${JSON.stringify(rows, null, 2)}\n`);
writeFileSync(join(OUT_DIR, "v3-field-matrix.md"), markdown(rows));
console.log(`Generated ${rows.length} V3 field matrix rows.`);

function flatten(value, path = "$") {
  if (Array.isArray(value)) {
    const rows = [{ path, value }];
    if (value.length) rows.push(...flatten(value[0], `${path}[0]`));
    return rows;
  }
  if (isPlainObject(value)) {
    return [
      { path, value },
      ...Object.entries(value).flatMap(([key, child]) => flatten(child, path === "$" ? key : `${path}.${key}`))
    ];
  }
  return [{ path, value }];
}

function inferType(path, value) {
  if (Array.isArray(value)) return "array";
  if (isPlainObject(value)) return "object";
  if (value === null) {
    if (/(score|confidence|fiscalYear|Value|Pct|weight|probability|bear|base|bull|cash|debt|eps|revenue|margin|growth|price|shares|wacc)/i.test(path)) return "number|null";
    if (/(date|Quarter|Period|currency|unit|type|status|id|name|summary|reason|rationale|thesis|description|method|formula|url|title)/i.test(path)) return "string|null";
    return "null";
  }
  return typeof value;
}

function policyFor(path, value) {
  const required = [
    "schemaVersion",
    "methodologyVersion",
    "analysisType",
    "outputLanguage",
    "reportIdentity.ticker",
    "reportIdentity.companyName",
    "reportIdentity.fiscalQuarter",
    "reportIdentity.fiscalYear",
    "reportIdentity.periodEndDate",
    "reportIdentity.earningsReleaseDate",
    "reportIdentity.analysisDate",
    "company.reportingCurrency",
    "company.tradingCurrency",
    "company.securityUnit",
    "marketPrice.value",
    "marketPrice.currency",
    "marketPrice.asOf",
    "marketPrice.priceType",
    "marketPrice.sourceId",
    "valuation.current.bear",
    "valuation.current.base",
    "valuation.current.bull",
    "valuation.current.probabilityWeighted",
    "valuation.upsideToBasePct",
    "valuation.marginOfSafetyPct",
    "nextRequirements.requirements[0].id",
    "nextRequirements.requirements[0].metric",
    "nextRequirements.requirements[0].type",
    "nextRequirements.requirements[0].weight",
    "sources[0].id",
    "sources[0].type",
    "sources[0].date",
    "sources[0].url",
    "sources[0].usedFor"
  ];
  if (required.includes(path)) return "required non-null";
  if (Array.isArray(value)) return "required array when parent section exists; members must be objects";
  if (isPlainObject(value)) return path === "$" ? "required root object" : "object shape validated when present";
  return value === null ? "nullable by contract unless validator marks path required" : "literal or enum value";
}

function normalizerFor(path) {
  if (path.startsWith("reportIdentity") || path.includes("Quarter") || path.includes("earningsPeriod")) return "normalizeFranklinV3Input: fiscal quarter canonicalization";
  if (path.startsWith("marketPrice")) return "normalizeFranklinV3Input: safe marketPrice alias shape only";
  if (/(confidence|importance|severity|status|result|direction|role|priceType|mode|targetScenario|securityUnit)/.test(path)) return "normalizeFranklinV3Input: enum canonicalization";
  return "none or representation-only";
}

function validatorFor(path) {
  if (path === "$" || path.startsWith("schemaVersion") || path.startsWith("methodologyVersion")) return "validateFranklinV3Report / schema gate";
  if (path.startsWith("reportIdentity")) return "validateFiscalIdentity + validateDateChronology";
  if (path.startsWith("marketPrice") || path.startsWith("company")) return "validateCompanyAndMarket + validateSources";
  if (path.startsWith("forecast")) return "validateForecast + validateAllSourceReferences";
  if (path.startsWith("financialNormalization")) return "validateFinancialNormalization";
  if (path.startsWith("valuation")) return "validateValuation + validateValuationMethodology + validateValuationCalculationAudit";
  if (path.startsWith("previousRequirementsEvaluation")) return "validatePreviousRequirements + validatePreviousRequirementsAssessment";
  if (path.startsWith("nextRequirements")) return "validateNextRequirements + validateNextRequirementTargetSemantics";
  if (path.startsWith("sources")) return "validateSources + validateAllSourceReferences";
  return "validateStructuralContract + section-specific validators";
}

function canonicalDestination(path) {
  const direct = `metadata.franklinV3Report.${path}`;
  const mapped = {
    "reportIdentity.ticker": "company.ticker",
    "reportIdentity.companyName": "company.name",
    "marketPrice.value": "market.priceAtAnalysis + fairValueSummary.currentPrice",
    "valuation.current.bear": "fairValueSummary.fairValueLow",
    "valuation.current.base": "fairValueSummary.fairValueBase",
    "valuation.current.bull": "fairValueSummary.fairValueHigh",
    "valuation.current.probabilityWeighted": "fairValueSummary.probabilityWeightedFairValue",
    "valuation.upsideToBasePct": "fairValueSummary.upsideDownsidePercent",
    "valuation.marginOfSafetyPct": "fairValueSummary.marginOfSafetyPercent",
    "nextRequirements": "priceTargetRequirements",
    "previousRequirementsEvaluation": "previousRequirementsEvaluation + requirementsAssessment",
    "sources": "sources"
  };
  const transform = Object.entries(mapped).find(([prefix]) => path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`));
  return transform ? `${direct}; external mirror: ${transform[1]}` : direct;
}

function consumerFor(path) {
  if (path.startsWith("reportIdentity") || path.startsWith("company") || path.startsWith("marketPrice")) return "stock header, import preview, report summary";
  if (path.startsWith("companyProfile") || path.startsWith("businessQuality") || path.startsWith("strengths") || path.startsWith("weaknesses")) return "company and quality report panels";
  if (path.startsWith("latestQuarter") || path.startsWith("forecast")) return "earnings table, forecast panel, data-health terminal";
  if (path.startsWith("financialNormalization") || path.startsWith("valuation")) return "valuation panel, decision hero, reproducibility warnings";
  if (path.startsWith("previousRequirementsEvaluation") || path.startsWith("nextRequirements")) return "earnings scorecard, quarterly history, requirement lifecycle";
  if (path.startsWith("decision") || path.startsWith("thesis")) return "decision hero and owner report narrative";
  if (path.startsWith("sources")) return "source list, provenance validation, import diagnostics";
  return "metadata preservation and export/re-import";
}

function transformFor(path) {
  if (path.startsWith("previousRequirementsEvaluation.requirements[0]")) return "evaluation rows rehydrate omitted definition fields from saved requirementSetId + id; conflicts rejected";
  if (path.startsWith("nextRequirements")) return "assigned requirementSetId on save; historical lifecycle stores an immutable copy";
  if (path.startsWith("reportIdentity")) return "fiscal quarter parts also derive reportPeriod";
  if (path.startsWith("marketPrice")) return "alias normalization does not invent sourceId or usedFor";
  if (path.startsWith("valuation.valuationResults")) return "supported typed inputs are checked against declared fairValue; model formula text is not executed";
  return "none";
}

function testFor(path) {
  if (path.startsWith("previousRequirementsEvaluation") || path.startsWith("marketPrice") || path.startsWith("forecast") || path.startsWith("valuation")) return "tests/franklinAuditRepair.test.mjs; tests/franklinFinancialContractV3.test.mjs; tests/jsonArchitecture.e2e.mjs";
  if (path.startsWith("nextRequirements") || path.startsWith("latestQuarter")) return "tests/historicalRequirements.test.mjs; tests/quarterlyScorecard.test.mjs; tests/jsonArchitecture.test.mjs";
  if (path.startsWith("sources")) return "tests/franklinAuditRepair.test.mjs; tests/quarterlySourceSafety.test.mjs";
  return "tests/jsonArchitecture.test.mjs; tests/intcOwnerAcceptance.test.mjs";
}

function markdown(items) {
  const header = [
    "# Franklin V3 Field Matrix",
    "",
    "Generated from `buildFranklinV3ReportTemplate()` with an earnings-revaluation previous-report fixture.",
    "",
    "| Source path | Type | Required / nullable policy | Normalizer | Validator | Canonical destination | Persistence | Consumer | Export / re-import | Intentional transform | Test |",
    "|---|---|---|---|---|---|---|---|---|---|---|"
  ];
  return `${header.join("\n")}\n${items.map((item) => [
    item.sourcePath,
    item.type,
    item.requiredNullablePolicy,
    item.normalizer,
    item.validator,
    item.canonicalDestination,
    item.persistenceDestination,
    item.consumer,
    item.exportReimportPath,
    item.intentionalTransform,
    item.test
  ].map(markdownCell).join("|")).map((line) => `|${line}|`).join("\n")}\n`;
}

function markdownCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
