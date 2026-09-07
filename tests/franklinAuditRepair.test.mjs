import assert from "node:assert/strict";
import { buildFranklinV3ReportTemplate } from "../src/externalAnalysis/v3Contract.js";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { normalizeFranklinV3Input } from "../src/externalAnalysis/v3InputNormalizer.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import {
  assertDispatchedPayloadValid,
  dispatchJsonPayload,
  JSON_IMPORT_ROUTES
} from "../src/externalAnalysis/jsonContractRouter.js";

const { goldenB, previousReport } = await quietImport("./franklinFinancialContractV3.test.mjs");
const { canonical } = await quietImport("./intcOwnerAcceptance.test.mjs");
const now = new Date("2026-07-25T10:00:00.000Z");
const originalOwnerFixture = JSON.stringify(canonical);

const frozenPrevious = structuredClone(previousReport);
Object.assign(frozenPrevious.priceTargetRequirements.requirements[0], {
  type: "maximum",
  baselineValue: 200,
  baselineDisplay: "$200m baseline cap",
  previousValue: 190,
  previousDisplay: "$190m previous cap",
  currentLevel: 190,
  requiredValue: previousReport.priceTargetRequirements.requirements[0].requiredValue,
  requiredDisplay: previousReport.priceTargetRequirements.requirements[0].requiredDisplay,
  unit: "USD",
  currency: "USD",
  accountingBasis: "non-GAAP",
  period: "Q2 2026",
  importance: "critical",
  whyItMatters: "This saved cap is part of the old investment contract."
});

const template = buildFranklinV3ReportTemplate({
  analysisType: "EARNINGS_REVALUATION",
  previousReport: frozenPrevious,
  selectedPeriod: "Q2 2026"
});
const templateRequirement = template.previousRequirementsEvaluation.requirements[0];
assert.equal(templateRequirement.type, "maximum");
assert.equal(templateRequirement.unit, "USD");
assert.equal(templateRequirement.baselineValue, 200);
assert.equal(templateRequirement.previousValue, 190);
assert.equal(templateRequirement.importance, "critical");
assert.equal(templateRequirement.whyItMatters, "This saved cap is part of the old investment contract.");

const sparseRevaluation = mutate(goldenB, (report) => {
  const req = report.previousRequirementsEvaluation.requirements[0];
  for (const field of [
    "type",
    "unit",
    "currency",
    "accountingBasis",
    "period",
    "baselineValue",
    "baselineDisplay",
    "previousValue",
    "previousDisplay",
    "currentLevel",
    "importance",
    "whyItMatters"
  ]) {
    delete req[field];
  }
});
assertValid(sparseRevaluation, frozenContext(), "Sparse previous requirement evaluations must validate against the saved frozen set.");
const parsedSparse = await parseExternalAnalysisInput(JSON.stringify(sparseRevaluation), {
  now,
  strictJson: true,
  currentReport: frozenPrevious,
  expectedTicker: "VTH",
  expectedReportPeriod: "Q2 2026"
});
const adaptedRequirement = parsedSparse.report.previousRequirementsEvaluation.requirements[0];
assert.equal(adaptedRequirement.type, "maximum");
assert.equal(adaptedRequirement.unit, "USD");
assert.equal(adaptedRequirement.baselineValue, 200);
assert.equal(adaptedRequirement.previousValue, 190);
assert.equal(adaptedRequirement.importance, "critical");
assert.equal(adaptedRequirement.whyItMatters, "This saved cap is part of the old investment contract.");
assert.equal(adaptedRequirement.actualValue, sparseRevaluation.previousRequirementsEvaluation.requirements[0].actualValue);
assert.equal(adaptedRequirement.status, sparseRevaluation.previousRequirementsEvaluation.requirements[0].status);

expectInvalidRevaluation((report) => {
  report.previousRequirementsEvaluation.requirements[0].type = "minimum";
}, /Old type cannot change/);
expectInvalidRevaluation((report) => {
  report.previousRequirementsEvaluation.requirements[0].unit = "EUR";
}, /Old unit cannot change/);
expectInvalidRevaluation((report) => {
  report.previousRequirementsEvaluation.requirements[0].baselineValue = 999;
}, /Old baselineValue cannot change/);

expectRejectedOwner((report) => { report.sources.push(null); }, /sources\.5.*object/);
expectRejectedOwner((report) => { report.strengths.push(null); }, /strengths\.\d+.*object/);
expectRejectedOwner((report) => { report.nextRequirements.requirements[0] = null; }, /nextRequirements\.requirements\.0.*object/);
expectRejectedOwner((report) => { report.valuation.current.base = [85]; }, /valuation\.current\.base.*finite JSON number/);
expectRejectedOwner((report) => { report.marketPrice.value = [90.07]; }, /marketPrice\.value.*JSON number/);
expectRejectedOwner((report) => { report.forecast.yearlyForecast[0].revenue.value = "not-a-number"; }, /forecast\.yearlyForecast\.0\.revenue\.value.*finite JSON number/);
expectRejectedOwner((report) => { report.businessQuality.score = [72]; }, /businessQuality\.score/);
expectRejectedOwner((report) => { report.valuation.current.unsupportedExtraField = 1; }, /Unknown nested property valuation\.current\.unsupportedExtraField/);
expectRejectedOwner((report) => { report.forecast.yearlyForecast[0].revenue.sourceId = "NOPE"; }, /forecast\.yearlyForecast\.0\.revenue\.sourceId.*sourceId NOPE/);
expectRejectedOwner((report) => { report.forecast = {}; }, /forecast\.yearlyForecast.*at least one forecast row/);
expectRejectedOwner((report) => { marketSource(report).date = "2099-01-01"; }, /Market-price source date/);
expectRejectedOwner((report) => { marketSource(report).date = "2001-01-01"; }, /Market-price source date/);
expectRejectedOwner((report) => { marketSource(report).url = null; }, /Market-price source must include a valid raw http\(s\) URL/);
expectRejectedOwner((report) => { marketSource(report).type = "SEC"; }, /Market-price source must be type Market Data/);
expectRejectedOwner((report) => { marketSource(report).usedFor = []; }, /marketPrice in usedFor|usedFor must be a non-empty/);
expectRejectedOwner((report) => { report.valuation.valuationResults[0].inputs.normalizedForwardEps = 2000; }, /P\/E fairValue/);
expectRejectedOwner((report) => { report.reportIdentity.companyName = ""; }, /companyName is required/);
expectRejectedOwner((report) => { report.reportIdentity.periodEndDate = null; }, /periodEndDate is required/);

const peValidation = validateFranklinV3Report(canonical);
assert.equal(peValidation.valid, true, JSON.stringify(peValidation.errors, null, 2));
assertMethodVerification(peValidation, "Forward P/E", "VERIFIED");

const nullablePeInput = mutate(canonical, (report) => {
  report.valuation.valuationResults[0].inputs.forwardEps = null;
});
const nullablePeValidation = validateFranklinV3Report(nullablePeInput);
assert.equal(nullablePeValidation.valid, true, JSON.stringify(nullablePeValidation.errors, null, 2));
assertMethodVerification(nullablePeValidation, "Forward P/E", "VERIFIED");

for (const [field, value, receivedType] of [
  ["normalizedForwardEps", "2", "string"],
  ["forwardEps", [2], "array"],
  ["eps", { value: 2 }, "object"],
  ["impliedMultiple", true, "boolean"],
  ["forwardMultiple", "41", "string"],
  ["peMultiple", [41], "array"],
  ["multiple", { value: 41 }, "object"]
]) {
  expectStructuredOwnerError(canonical, (report) => {
    report.valuation.valuationResults[0].inputs[field] = value;
  }, `valuation.valuationResults.0.inputs.${field}`, receivedType);
}

const evEbitdaOwner = mutate(canonical, configureEvEbitda);
const evEbitdaValidation = validateFranklinV3Report(evEbitdaOwner);
assert.equal(evEbitdaValidation.valid, true, JSON.stringify(evEbitdaValidation.errors, null, 2));
assertMethodVerification(evEbitdaValidation, "EV/EBITDA", "VERIFIED");

const evEbitdaWithAdjustment = mutate(evEbitdaOwner, (report) => {
  report.valuation.valuationResults[0].fairValue = 75;
  report.valuation.valuationResults[0].calculation = { nonOperatingAdjustments: -50 };
});
const adjustedEvValidation = validateFranklinV3Report(evEbitdaWithAdjustment);
assert.equal(adjustedEvValidation.valid, true, JSON.stringify(adjustedEvValidation.errors, null, 2));
assertMethodVerification(adjustedEvValidation, "EV/EBITDA", "VERIFIED");

const priceFcfOwner = mutate(canonical, (report) => {
  report.valuation.methodology.primaryMethod = "P/FCF";
  report.valuation.methodology.modelWeights[0].method = "P/FCF";
  Object.assign(report.valuation.valuationResults[0], {
    method: "P/FCF",
    fairValue: 100,
    inputs: { normalizedFreeCashFlow: 50, dilutedShares: 10, impliedMultiple: 20 }
  });
});
const priceFcfValidation = validateFranklinV3Report(priceFcfOwner);
assert.equal(priceFcfValidation.valid, true, JSON.stringify(priceFcfValidation.errors, null, 2));
assertMethodVerification(priceFcfValidation, "P/FCF", "VERIFIED");

const chatGptAliasInputs = normalizeFranklinV3Input(mutate(priceFcfOwner, (report) => {
  report.valuation.valuationResults[0].inputs = {
    "2027E_FCF_USD_million": 50,
    shares_million: 10,
    targetMultiple: 20
  };
}));
assert.deepEqual(
  {
    freeCashFlow: chatGptAliasInputs.valuation.valuationResults[0].inputs.normalizedFreeCashFlow,
    shares: chatGptAliasInputs.valuation.valuationResults[0].inputs.dilutedShares,
    multiple: chatGptAliasInputs.valuation.valuationResults[0].inputs.impliedMultiple
  },
  { freeCashFlow: 50, shares: 10, multiple: 20 }
);
assert.equal(validateFranklinV3Report(chatGptAliasInputs).valid, true);

const chatGptEvAliases = normalizeFranklinV3Input(mutate(evEbitdaWithAdjustment, (report) => {
  report.valuation.valuationResults[0].inputs = {
    "2027E_EBITDA_USD_million": 100,
    targetMultiple: 10,
    netDebt_USD_million: 200,
    dilutedShares_million: 10
  };
}));
assert.deepEqual(
  {
    ebitda: chatGptEvAliases.valuation.valuationResults[0].inputs.normalizedEbitda,
    multiple: chatGptEvAliases.valuation.valuationResults[0].inputs.evEbitdaMultiple,
    netDebt: chatGptEvAliases.valuation.valuationResults[0].inputs.netDebt,
    shares: chatGptEvAliases.valuation.valuationResults[0].inputs.dilutedShares
  },
  { ebitda: 100, multiple: 10, netDebt: 200, shares: 10 }
);
assert.equal(validateFranklinV3Report(chatGptEvAliases).valid, true);

const chatGptPeAliases = normalizeFranklinV3Input(mutate(canonical, (report) => {
  report.valuation.valuationResults[0].inputs = { "2027E_EPS": 2, targetMultiple: 41 };
}));
assert.equal(chatGptPeAliases.valuation.valuationResults[0].inputs.normalizedForwardEps, 2);
assert.equal(chatGptPeAliases.valuation.valuationResults[0].inputs.impliedMultiple, 41);
assert.equal(validateFranklinV3Report(chatGptPeAliases).valid, true);

const conflictingPriceFcf = mutate(priceFcfOwner, (report) => {
  report.valuation.valuationResults[0].inputs.fcfPerShare = 999;
});
assert.ok(validateFranklinV3Report(conflictingPriceFcf).errors.some((error) => error.field.endsWith("fcfPerShare")));

for (const [field, value, receivedType] of [
  ["normalizedEbitda", "100", "string"],
  ["ebitda", [100], "array"],
  ["evEbitdaMultiple", { value: 10 }, "object"],
  ["netDebt", true, "boolean"],
  ["dilutedShares", "10", "string"]
]) {
  expectStructuredOwnerError(evEbitdaOwner, (report) => {
    report.valuation.valuationResults[0].inputs[field] = value;
  }, `valuation.valuationResults.0.inputs.${field}`, receivedType);
}
expectStructuredOwnerError(evEbitdaOwner, (report) => {
  delete report.valuation.valuationResults[0].inputs.netDebt;
  report.valuation.valuationResults[0].calculation = { netDebt: "200", dilutedShares: 10 };
}, "valuation.valuationResults.0.calculation.netDebt", "string");

const dcfValidation = validateFranklinV3Report(goldenB, frozenContext());
assert.equal(dcfValidation.valid, true, JSON.stringify(dcfValidation.errors, null, 2));
assertMethodVerification(dcfValidation, "DCF", "VERIFIED");

const unknownMethodOwner = mutate(canonical, (report) => {
  report.valuation.methodology.secondaryMethods[1] = "Mystery Model";
  report.valuation.methodology.modelWeights[2].method = "Mystery Model";
  report.valuation.valuationResults[2].method = "Mystery Model";
});
const unknownMethodValidation = validateFranklinV3Report(unknownMethodOwner);
assert.equal(unknownMethodValidation.valid, false);
assertMethodVerification(unknownMethodValidation, "Mystery Model", "NOT_VERIFIED");
assert.ok(unknownMethodValidation.errors.some((error) => error.method === "Mystery Model" && error.verificationState === "NOT_VERIFIED"));

expectStructuredOwnerError(canonical, (report) => {
  report.financialNormalization = { cash: [100] };
}, "financialNormalization.cash", "array");
expectStructuredOwnerError(canonical, (report) => {
  report.financialNormalization = { cash: "100" };
}, "financialNormalization.cash", "string");
expectStructuredOwnerError(canonical, (report) => {
  report.financialNormalization = { debt: true };
}, "financialNormalization.debt", "boolean");
expectStructuredOwnerError(canonical, (report) => {
  report.financialNormalization = { freeCashFlow: { value: "500" } };
}, "financialNormalization.freeCashFlow.value", "string");
expectStructuredOwnerError(canonical, (report) => {
  report.financialNormalization = { cash: { value: 100, unexpectedAmount: 100 } };
}, "financialNormalization.cash.unexpectedAmount", "number");

const nullableFinancialMetric = mutate(canonical, (report) => {
  report.financialNormalization = {
    reportingCurrency: "USD",
    cash: { value: null, unit: "USD", accountingBasis: "GAAP", period: "Q2 2026", sourceId: null }
  };
});
const nullableFinancialValidation = validateFranklinV3Report(nullableFinancialMetric);
assert.equal(nullableFinancialValidation.valid, true, JSON.stringify(nullableFinancialValidation.errors, null, 2));
assert.equal(nullableFinancialMetric.financialNormalization.cash.value, null, "Unknown financial data must remain null, not become zero.");

const emptyFinancialNormalization = mutate(canonical, (report) => {
  report.financialNormalization = {};
});
const emptyFinancialValidation = validateFranklinV3Report(emptyFinancialNormalization);
assert.equal(emptyFinancialValidation.valid, true, JSON.stringify(emptyFinancialValidation.errors, null, 2));
assert.match(emptyFinancialValidation.warnings.map((warning) => `${warning.field}: ${warning.message}`).join("\n"), /financialNormalization/);

const emptyCalculationAudit = mutate(canonical, (report) => {
  report.valuation.calculationAudit = {};
});
const emptyAuditValidation = validateFranklinV3Report(emptyCalculationAudit);
assert.equal(emptyAuditValidation.valid, true, JSON.stringify(emptyAuditValidation.errors, null, 2));
assert.match(emptyAuditValidation.warnings.map((warning) => `${warning.field}: ${warning.message}`).join("\n"), /valuation\.calculationAudit/);

const parsedOwner = await parseExternalAnalysisInput(JSON.stringify(canonical), {
  now: new Date("2026-08-24T15:30:00.000Z"),
  expectedTicker: "INTC",
  expectedReportPeriod: "Q2 2026"
});
assert.equal(parsedOwner.report.company.ticker, "INTC");
assert.equal(parsedOwner.report.metadata.franklinV3Report.marketPrice.value, 90.07);
assert.equal(JSON.stringify(canonical), originalOwnerFixture, "Invalid probes must not mutate the canonical owner fixture.");

console.log("Franklin audit repair regression checks passed.");

function assertValid(report, context, message) {
  const validation = validateFranklinV3Report(report, context);
  assert.equal(validation.valid, true, `${message}\n${JSON.stringify(validation.errors, null, 2)}`);
}

function expectInvalidRevaluation(mutator, pattern) {
  const candidate = mutate(goldenB, mutator);
  const validation = validateFranklinV3Report(candidate, frozenContext());
  assert.equal(validation.valid, false, `Expected invalid revaluation for ${pattern}`);
  assert.match(validation.errors.map((error) => `${error.field}: ${error.message}`).join("\n"), pattern);
}

function expectRejectedOwner(mutator, pattern) {
  const candidate = mutate(canonical, mutator);
  const dispatched = dispatchJsonPayload(candidate, {
    intendedRoute: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
    context: { expectedTicker: "INTC", expectedReportPeriod: "Q2 2026" }
  });
  assert.equal(dispatched.validation.valid, false, `Expected owner payload rejection for ${pattern}`);
  const joined = dispatched.validation.errors.map((error) => `${error.field}: ${error.message}`).join("\n");
  assert.match(joined, pattern);
  assert.throws(() => assertDispatchedPayloadValid(dispatched, candidate), /فشل التحقق من JSON/);
}

function expectStructuredOwnerError(base, mutator, field, receivedType) {
  const candidate = mutate(base, mutator);
  const dispatched = dispatchJsonPayload(candidate, {
    intendedRoute: JSON_IMPORT_ROUTES.FULL_ANALYSIS,
    context: { expectedTicker: "INTC", expectedReportPeriod: "Q2 2026" }
  });
  assert.equal(dispatched.validation.valid, false, `Expected structured validation error at ${field}`);
  const error = dispatched.validation.errors.find((item) => item.field === field);
  assert.ok(error, JSON.stringify(dispatched.validation.errors, null, 2));
  assert.equal(error.jsonPath, `$.${field}`);
  assert.equal(error.receivedType, receivedType);
  assert.equal(dispatched.validation.warnings.some((warning) => warning.field === field), false, `${field} must not degrade to a warning.`);
}

function assertMethodVerification(validation, method, state) {
  const verification = validation.valuationMethodVerifications.find((item) => item.method === method);
  assert.ok(verification, `Missing valuation verification state for ${method}`);
  assert.equal(verification.state, state, JSON.stringify(verification, null, 2));
}

function configureEvEbitda(report) {
  report.valuation.methodology.primaryMethod = "EV/EBITDA";
  report.valuation.methodology.modelWeights[0].method = "EV/EBITDA";
  Object.assign(report.valuation.valuationResults[0], {
    method: "EV/EBITDA",
    fairValue: 80,
    inputs: {
      normalizedEbitda: 100,
      evEbitdaMultiple: 10,
      netDebt: 200,
      dilutedShares: 10
    }
  });
}

function frozenContext() {
  return { currentReport: frozenPrevious, expectedTicker: "VTH", expectedReportPeriod: "Q2 2026" };
}

function marketSource(report) {
  return report.sources.find((source) => source.id === report.marketPrice.sourceId);
}

function mutate(value, mutator) {
  const copy = structuredClone(value);
  mutator(copy);
  return copy;
}

async function quietImport(path) {
  const originalLog = console.log;
  console.log = () => {};
  try {
    return await import(path);
  } finally {
    console.log = originalLog;
  }
}
