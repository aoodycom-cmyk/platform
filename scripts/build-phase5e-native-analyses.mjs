import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildFranklinV3ReportTemplate } from "../src/externalAnalysis/v3Contract.js";
import { calculateV3RequirementAssessment, validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { parseExternalAnalysisInput, stringifyExternalAnalysisReport } from "../src/externalAnalysis/parser.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { attachCompletionStatus } from "../src/externalAnalysis/missingFields.js";
import { attachRequirementSetIdentityToReport } from "../src/externalAnalysis/historicalRequirements.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";
import { buildMetricSnapshot } from "../src/domain/financialMetrics.js";
import { runValuation } from "../src/engines/valuationEngine.js";
import { auditAnalysisIntegrity } from "../src/aiIntegrity/auditor.js";

const root = resolve("artifacts/phase5e");
const corpus = JSON.parse(await readFile(resolve("tests/corpus/real-world/source-packages.json"), "utf8"));
const freezePhase6c = process.argv.includes("--freeze-phase6c");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : 100;
const selected = corpus.companies.slice(0, limit);
const output = { schemaVersion: "franklin-phase5e-native-corpus/v1", generatedAt: new Date().toISOString(), analyses: [], verification: [], twoPeriodChains: [], threePeriodChains: [] };

if (freezePhase6c) {
  const company = corpus.companies.find((item) => item.ticker === "QCOM");
  const periods = consecutiveQuarterTail(company?.periods || [], 3);
  if (!company || periods.length !== 3) throw new Error("Verified QCOM three-period evidence chain is unavailable.");
  const chain = await runChain(company, periods);
  const fixtureRoot = resolve("tests/fixtures/phase6c/chains/qcom-q1-q3-2026");
  await mkdir(fixtureRoot, { recursive: true });
  for (const [index, item] of chain.entries()) {
    await writeFile(resolve(fixtureRoot, `period-${index + 1}.json`), `${JSON.stringify(item.native, null, 2)}\n`);
  }
  await writeFile(resolve(fixtureRoot, "manifest.json"), `${JSON.stringify({
    schemaVersion: "franklin-phase6c-chain-fixture/v1",
    evidenceCorpus: "tests/corpus/real-world/source-packages.json",
    ticker: company.ticker,
    company: company.company,
    twoPeriodChain: chain.slice(0, 2).map(chainManifestItem),
    threePeriodChain: chain.map(chainManifestItem),
    verification: { nativeValidation: "PASS", import: "PASS", storage: "PASS", integrity: "PASS", roundTrip: "PASS" }
  }, null, 2)}\n`);
  console.log(`Phase 6C chain fixtures: PASS (${company.ticker}, ${chain.map((item) => item.reportPeriod).join(" -> ")})`);
  process.exit(0);
}

for (const company of selected) {
  const period = company.periods.filter((item) => /^Q[1-4]$/.test(item.periodIdentity.fiscalQuarter))
    .sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate)).at(-1);
  const native = buildNative(company, period);
  const periodName = `${period.periodIdentity.fiscalQuarter} ${period.periodIdentity.fiscalYear}`;
  const direct = validateFranklinV3Report(native, { expectedTicker: company.ticker, expectedReportPeriod: periodName });
  if (!direct.valid) throw new Error(`${company.ticker} native validation failed:\n${JSON.stringify(direct.errors, null, 2)}`);
  const now = new Date(`${period.cutoffDate}T23:59:59.000Z`);
  const parsed = await parseExternalAnalysisInput(JSON.stringify(native), {
    now, expectedTicker: company.ticker, expectedReportPeriod: periodName, strictJson: true
  });
  const external = validateExternalAnalysisReport(parsed.report);
  if (!external.valid) throw new Error(`${company.ticker} external validation failed:\n${JSON.stringify(external.errors, null, 2)}`);
  let ready = attachCompletionStatus(parsed.report, external);
  ready.id = `${company.ticker}-${periodName.replace(" ", "-")}-phase5e-initial`;
  ready = attachRequirementSetIdentityToReport(ready, now);
  const saved = saveExternalAnalysis({}, ready, { allowDuplicate: true, now }).report;
  const roundTrip = await parseExternalAnalysisInput(stringifyExternalAnalysisReport(saved), {
    now, expectedTicker: company.ticker, expectedReportPeriod: periodName, strictJson: true
  });
  const financialCompany = toFinancialCompany(company, period);
  const metrics = buildMetricSnapshot(financialCompany);
  const valuation = runValuation(financialCompany);
  const integrity = runIntegrity(company, period, native);
  const roundTripMatch = JSON.stringify(roundTrip.report.metadata.franklinV3Report) === JSON.stringify(native);
  if (!roundTripMatch) throw new Error(`${company.ticker} material round-trip mismatch.`);
  if (integrity.findings.some((item) => ["CRITICAL", "MAJOR"].includes(item.severity))) {
    throw new Error(`${company.ticker} integrity audit found critical/major findings:\n${JSON.stringify(integrity.findings, null, 2)}`);
  }
  output.analyses.push({ ticker: company.ticker, reportPeriod: periodName, native, saved });
  output.verification.push({ ticker: company.ticker, native: "PASS", import: "PASS", storage: "PASS", financialReference: metrics.financialPeriodCount > 0 ? "PASS" : "FAIL", valuationEngine: valuation.name ? "PASS" : "FAIL", integrity: "PASS", roundTrip: "PASS" });
}

for (const company of corpus.companies) {
  if (output.twoPeriodChains.length >= 30 && output.threePeriodChains.length >= 10) break;
  const periods = consecutiveQuarterTail(company.periods, 3);
  if (periods.length < 2) continue;
  const chainLength = output.threePeriodChains.length < 10 && periods.length >= 3 ? 3 : 2;
  const chain = await runChain(company, periods.slice(-chainLength));
  if (output.twoPeriodChains.length < 30) output.twoPeriodChains.push({ ticker: company.ticker, periods: chain.slice(0, 2).map((item) => item.reportPeriod), status: "PASS" });
  if (chainLength === 3) output.threePeriodChains.push({ ticker: company.ticker, periods: chain.map((item) => item.reportPeriod), status: "PASS" });
}
if (output.twoPeriodChains.length < 30 || output.threePeriodChains.length < 10) {
  throw new Error(`Insufficient real chains: two-period=${output.twoPeriodChains.length}, three-period=${output.threePeriodChains.length}`);
}

await mkdir(root, { recursive: true });
await writeFile(resolve(root, "native-analyses.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Phase 5E native execution: PASS (${output.analyses.length}/${limit})`);
console.log(`Phase 5E real chains: PASS (${output.twoPeriodChains.length} two-period, ${output.threePeriodChains.length} three-period)`);

async function runChain(company, periods) {
  let collection = {};
  let previous = null;
  const results = [];
  for (const [index, period] of periods.entries()) {
    const periodName = `${period.periodIdentity.fiscalQuarter} ${period.periodIdentity.fiscalYear}`;
    let native = buildNative(company, period);
    if (index > 0) native = asRevaluation(native, previous);
    const validation = validateFranklinV3Report(native, { currentReport: previous, expectedTicker: company.ticker, expectedReportPeriod: periodName });
    if (!validation.valid) throw new Error(`${company.ticker} ${periodName} chain validation failed:\n${JSON.stringify(validation.errors, null, 2)}`);
    const now = new Date(`${period.cutoffDate}T23:59:59.000Z`);
    const parsed = await parseExternalAnalysisInput(JSON.stringify(native), { now, currentReport: previous, expectedTicker: company.ticker, expectedReportPeriod: periodName, strictJson: true });
    const external = validateExternalAnalysisReport(parsed.report);
    if (!external.valid) throw new Error(`${company.ticker} ${periodName} chain external validation failed:\n${JSON.stringify(external.errors, null, 2)}`);
    let ready = attachCompletionStatus(parsed.report, external);
    ready.id = `${company.ticker}-${periodName.replace(" ", "-")}-phase5e-chain`;
    ready = attachRequirementSetIdentityToReport(ready, now);
    const saved = saveExternalAnalysis(collection, ready, { allowDuplicate: true, now });
    collection = saved.collection;
    previous = saved.report;
    const reimported = await parseExternalAnalysisInput(stringifyExternalAnalysisReport(previous), { now, currentReport: index ? collection[company.ticker]?.[1] : null, expectedTicker: company.ticker, expectedReportPeriod: periodName, strictJson: true });
    if (JSON.stringify(reimported.report.metadata.franklinV3Report) !== JSON.stringify(native)) throw new Error(`${company.ticker} ${periodName} chain round-trip mismatch.`);
    const integrity = runIntegrity(company, period, native);
    if (integrity.findings.some((item) => ["CRITICAL", "MAJOR"].includes(item.severity))) throw new Error(`${company.ticker} ${periodName} chain integrity failed.`);
    results.push({
      reportPeriod: periodName,
      analysisType: native.analysisType,
      reportId: previous.id,
      requirementSetId: previous.priceTargetRequirements.requirementSetId,
      native
    });
  }
  return results;
}

function chainManifestItem(item, index) {
  return {
    fixture: `period-${index + 1}.json`,
    reportPeriod: item.reportPeriod,
    analysisType: item.analysisType,
    reportId: item.reportId,
    requirementSetId: item.requirementSetId,
    previousAnalysisId: item.native.reportIdentity.previousAnalysisId,
    previousRequirementSetId: item.native.reportIdentity.previousRequirementSetId,
    cutoffDate: item.native.reportIdentity.analysisDate,
    marketPrice: item.native.marketPrice
  };
}

function asRevaluation(report, previous) {
  const prior = previous.metadata.franklinV3Report;
  const template = buildFranklinV3ReportTemplate({ analysisType: "EARNINGS_REVALUATION", tickerHint: report.reportIdentity.ticker, selectedPeriod: `${report.reportIdentity.fiscalQuarter} ${report.reportIdentity.fiscalYear}`, previousReport: previous });
  report.analysisType = "EARNINGS_REVALUATION";
  report.reportIdentity.previousAnalysisId = previous.id;
  report.reportIdentity.previousRequirementSetId = previous.priceTargetRequirements.requirementSetId;
  report.previousRequirementsEvaluation = template.previousRequirementsEvaluation;
  report.previousRequirementsEvaluation.requirements = report.previousRequirementsEvaluation.requirements.map((item) => ({ ...item, status: "NOT_REPORTED", partialCreditPct: null, actualValue: null, actualDisplay: "لم يثبت ضمن حزمة الفترة الحالية", actualRaw: null, direction: null, impact: "لم يُقيّم لغياب تطابق دلالي مؤكد", evaluationNote: "بقي المتطلب غير منشور ولم يُفترض نجاحه أو إخفاقه.", sourceId: null }));
  const assessment = calculateV3RequirementAssessment(report.previousRequirementsEvaluation.requirements);
  report.previousRequirementsEvaluation.assessment = { ...assessment, overallStatus: "INCOMPLETE", summary: "لم تتوفر أدلة كافية لتقييم متطلبات الفترة السابقة، فبقيت كلها غير منشورة." };
  report.valuation.reviewStatus = report.valuation.current.base === prior.valuation.current.base ? "UNCHANGED" : "UPDATED";
  report.valuation.previous = template.valuation.previous;
  report.valuation.change = {
    bearPct: pctChange(report.valuation.current.bear, template.valuation.previous.bear),
    basePct: pctChange(report.valuation.current.base, template.valuation.previous.base),
    bullPct: pctChange(report.valuation.current.bull, template.valuation.previous.bull),
    summary: "تغيرت مرساة التقييم مع سعر الإغلاق التاريخي الجديد للفترة الحالية."
  };
  const baseDelta = round(report.valuation.current.base - template.valuation.previous.base);
  report.valuation.valuationBridge.whyBaseChangedOrNot = "تغيرت القيمة الأساسية لأن مرساة سعر السوق التاريخي تغيرت بين تاريخي القطع.";
  report.valuation.valuationBridge.baseChangeBridge = { previousBase: template.valuation.previous.base, operatingForecastImpact: 0, marginAndCashFlowImpact: 0, balanceSheetImpact: 0, dilutionImpact: 0, valuationParametersImpact: baseDelta, otherImpact: 0, reconciledCurrentBase: report.valuation.current.base, currentBase: report.valuation.current.base, reconciliationGap: 0 };
  report.thesis = { status: "UNCHANGED", previousSummary: prior.thesis.updatedSummary, updatedSummary: "الأطروحة بقيت محايدة ومحدودة، مع تحديث الحقائق والسعر إلى الفترة التالية من دون اختلاق توقعات.", changeReason: "لم يظهر في الحزمة دليل كافٍ لتغيير الأطروحة المحدودة؛ جرى تحديث الفترة والمرساة فقط.", keySupports: ["استمرت صلة الحقائق بالمصدر الرسمي لكل فترة."], keyThreats: ["لا يزال التقييم المستقل الكامل غير متاح ضمن حزمة القياس."] };
  report.audit.previousRequirementWeightTotalPct = 100;
  return report;
}

function buildNative(company, period) {
  const id = period.periodIdentity;
  const periodName = `${id.fiscalQuarter} ${id.fiscalYear}`;
  const report = buildFranklinV3ReportTemplate({ tickerHint: company.ticker, selectedPeriod: periodName, analysisType: "INITIAL" });
  const price = period.historicalMarketPrice;
  const filingSource = period.sources.find((source) => source.accession === id.accession) || period.sources[0];
  const guidanceSource = period.sources.find((source) => source.sourceId === period.guidanceClassification.sourceId) || filingSource;
  const facts = Object.fromEntries(period.evidenceClaims.map((claim) => [claim.metric, claim]));
  const debt = sumFinite(facts.debtCurrent?.value, facts.debtNoncurrent?.value);
  const fcf = Number.isFinite(facts.operatingCashFlow?.value) && Number.isFinite(facts.capex?.value)
    ? facts.operatingCashFlow.value - Math.abs(facts.capex.value) : null;
  const sourceId = filingSource.sourceId;
  const base = price.price;
  const bear = round(base * 0.8);
  const bull = round(base * 1.2);
  Object.assign(report, {
    companyGlossary: [
      { termAr: "الإيرادات", termEn: "Revenue", plainExplanationAr: "قيمة المبيعات المثبتة في الإفصاح المالي الرسمي للفترة محل التحليل.", whyItMattersAr: "توضح حجم النشاط المبلغ عنه." },
      { termAr: "ربحية السهم", termEn: "Earnings per share", plainExplanationAr: "حصة السهم المخففة من صافي الربح وفق الأساس المحاسبي المعلن.", whyItMattersAr: "تربط الربح بعدد الأسهم." },
      { termAr: "التدفق النقدي الحر", termEn: "Free cash flow", plainExplanationAr: "التدفق التشغيلي بعد طرح القيمة المطلقة للإنفاق الرأسمالي عند توفرهما.", whyItMattersAr: "يقيس النقد المتبقي بصورة مبسطة." },
      { termAr: "مضاعف الربحية", termEn: "P/E", plainExplanationAr: "طريقة حسابية تضرب ربحية السهم المفترضة في مضاعف معلن لإنتاج قيمة السهم.", whyItMattersAr: "تجعل حساب القيمة قابلًا لإعادة الإنتاج." }
    ], strengths: [], weaknesses: [], risks: [{ title: "محدودية التقييم المستقل", severity: "high", explanation: "لا تتضمن الحزمة توقعًا ماليًا مستقلاً كاملًا، ولذلك قد تختلف القيمة الجوهرية ماديًا عن مرساة السعر التاريخي.", whatToMonitor: "الإفصاح المالي والتوجيه الرسمي في الفترة التالية.", thesisBreaker: "ظهور دليل رسمي يناقض الحقائق المستخدمة.", sourceIds: [] }], catalysts: [], monitoringChecklist: [],
    reportIdentity: { ticker: company.ticker, companyName: company.company, fiscalQuarter: id.fiscalQuarter, fiscalYear: id.fiscalYear, periodEndDate: id.periodEnd, earningsReleaseDate: period.earningsReleaseDate, analysisDate: period.cutoffDate, previousAnalysisId: null, previousRequirementSetId: null },
    company: { sector: "غير مصنف ضمن حزمة الدليل", industry: "غير مصنف ضمن حزمة الدليل", reportingCurrency: "USD", tradingCurrency: price.currency, securityUnit: "share" },
    companyProfile: { summary: `تعرض هذه الحزمة تحليلًا ماليًا لشركة ${company.company} اعتمادًا على الإفصاح الرسمي المجمد حتى تاريخ القطع.`, businessModel: "لم تتضمن حزمة القياس وصفًا تشغيليًا كاملًا؛ لذلك يقتصر هذا التقرير على الحقائق المالية الموثقة ولا يفترض نموذج أعمال غير مثبت.", activities: [], customers: [], mainGrowthDrivers: [] },
    dataQuality: { score: 90, confidence: "HIGH", reportedDataThrough: id.periodEnd, missingCriticalFields: [], notes: ["الإجماع التاريخي غير متاح، لذلك لا توجد دعوى تفوق أو إخفاق."] },
    classification: { companyType: "شركة عامة مدرجة", businessStage: "قائمة", cyclicality: "غير متحقق ضمن الحزمة", capitalIntensity: "غير متحقق ضمن الحزمة", evidence: [`إفصاح SEC الرسمي للفترة ${periodName}.`], confidence: "LOW" },
    businessQuality: { score: 50, rating: "محايد", confidence: "LOW", components: { growth: 50, profitability: 50, cashFlow: 50, balanceSheet: 50, capitalAllocation: 50, competitiveAdvantage: 50, management: 50 }, explanation: "الدرجة محايدة ومنخفضة الثقة لأنها ليست حقيقة صادرة عن الشركة، بل تفسير محدود لاختبار المسار الأصلي مع منع الادعاءات غير المدعومة." },
    marketPrice: { value: base, currency: price.currency, asOf: price.asOf, priceType: price.priceType, sourceId: price.sourceId },
    latestQuarter: latestQuarter(period, facts, sourceId, debt, fcf),
    financialNormalization: normalization(periodName, facts, sourceId, debt, fcf),
    forecast: { materiality: "NON_MATERIAL", yearlyForecast: [{ period: `FY${id.fiscalYear}`, ...Object.fromEntries(["revenue", "revenueGrowthPct", "eps", "ebitda", "ebitdaMarginPct", "freeCashFlow", "fcfMarginPct"].map((key) => [key, { value: null, basis: null }])) }], estimateRevisions: [], changedAssumptions: [], wacc: { value: null, rangeLow: null, rangeHigh: null, reason: "لا توجد فرضية توقع موثقة." }, terminalGrowth: { value: null, reason: "لا توجد فرضية نمو نهائي موثقة." }, sensitivity: [], summary: "لم يُنشأ توقع رقمي؛ البيانات المستقبلية غير المكتملة لم تُحوّل إلى حقائق أو تقديرات مصطنعة." },
    valuation: valuationBlock(base, bear, bull),
    thesis: { status: "INITIAL", previousSummary: null, updatedSummary: "الأطروحة محايدة ومحدودة: التقرير يثبت إمكانية تشغيل تحليل فرانكلين الأصلي على الأدلة التاريخية من دون اختلاق توقعات.", changeReason: null, keySupports: ["البيانات المالية والسعر مرتبطان بمصادر مجمدة."], keyThreats: ["غياب توقع مالي مستقل كامل يمنع استنتاج قيمة جوهرية عالية الثقة."] },
    decision: { scope: "STOCK_LEVEL", action: "WATCH", confidence: 25, investmentScore: 50, rationale: ["السعر التاريخي مستخدم كمرساة سيناريو لا كتوصية استثمارية."], whyNot: ["لا تتوفر توقعات مستقلة كافية لقرار شراء أو بيع."], biggestAssumption: "استمرار السعر كمرساة محايدة لحظة القطع.", mainRisk: "قد تختلف القيمة الجوهرية عن سعر السوق بصورة مادية.", upgradeTriggers: [], downgradeTriggers: [] },
    nextRequirements: nextRequirements(company.ticker, periodName, base, bull),
    sources: [toV3Source(filingSource, sourceId, ["latestQuarter", "financialNormalization"]), ...(guidanceSource.sourceId === sourceId ? [] : [toV3Source(guidanceSource, guidanceSource.sourceId, ["latestQuarter.guidance", "latestQuarter.forwardOutlook"])]), { id: price.sourceId, title: `${company.ticker} historical close`, type: "Market Data", date: price.asOf, url: price.sourceUrl, usedFor: ["marketPrice"] }],
    limitations: ["التقييم سيناريو سوقي تفسيري منخفض الثقة وليس حقيقة صادرة عن الشركة.", "لا توجد دعوى تفوق أو إخفاق لغياب إجماع تاريخي موثوق في الحزمة."],
    audit: { scenarioProbabilityTotalPct: 100, valuationMethodWeightTotalPct: 100, previousRequirementWeightTotalPct: null, nextRequirementWeightTotalPct: 100, consistencyNotes: ["كل الحقائق الرقمية الحالية مرتبطة بإفصاح SEC للفترة نفسها."] }
  });
  return report;
}

function latestQuarter(period, facts, sourceId, debt, fcf) {
  const metric = (fact, unit = null) => ({ actualValue: fact?.value ?? null, unit, consensusValue: null, priorYearValue: null, yoyPct: null, result: "NA", sourceId: fact ? sourceId : null });
  const simple = (value, unit) => ({ actualValue: value ?? null, unit: value == null ? null : unit, sourceId: value == null ? null : sourceId });
  const revenue = metric(facts.revenue, "USD"); revenue.qoqPct = null;
  const eps = metric(facts.dilutedEps, "USD/share"); delete eps.qoqPct;
  const margin = (numerator) => ({ actualValue: Number.isFinite(numerator?.value) && Number.isFinite(facts.revenue?.value) && facts.revenue.value ? round(numerator.value / facts.revenue.value * 100) : null, consensusValue: null, priorYearValue: null, result: "NA", sourceId: numerator && facts.revenue ? sourceId : null });
  const g = period.guidanceClassification;
  const direction = ({ raised: "raised", lowered: "lowered", reiterated: "maintained", initiated: "new", withdrawn: "not_reported" })[g.action] || "not_reported";
  const guidance = g.classification === "VERIFIED_NO_FORMAL_GUIDANCE" ? [] : [{ period: g.guidanceTargetPeriod, topic: g.metric, previousGuidance: null, currentGuidance: g.evidenceText, previousLow: null, previousHigh: null, currentLow: g.low, currentHigh: g.high, midpoint: g.pointEstimate, unit: g.unit, currency: g.currency, accountingBasis: g.accountingBasis, direction, interpretation: `التصنيف المستقل: ${g.classification}.`, sourceId: g.sourceId }];
  return { summary: "يعرض هذا القسم فقط المقاييس المثبتة في الإفصاح الرسمي، وأي حقل غير متاح بقي فارغًا.", coreMetrics: { revenue, eps, grossMarginPct: margin(facts.grossProfit), operatingMarginPct: margin(facts.operatingIncome), freeCashFlow: { actualValue: fcf, unit: fcf == null ? null : "USD", priorYearValue: null, yoyPct: null, sourceId: fcf == null ? null : sourceId }, cash: simple(facts.cash?.value, "USD"), debt: simple(debt, "USD") }, companySpecificKpis: [], guidance, forwardOutlook: { growthOutlook: "unclear", marginOutlook: "unclear", fcfOutlook: "unclear", demandOutlook: "unclear", capacityOutlook: "unclear", executionOutlook: "unclear", guidanceTrend: direction, managementTone: "unclear", summary: period.narrative.status === "VERIFIED" ? `يتضمن الإفصاح الرسمي بيانًا إداريًا ماديًا عن ${arabicTopic(period.narrative.topic)}؛ أُبقي الاتجاه غير واضح لأن الحزمة لا تثبت تفسيرًا كميًا مستقلًا.` : "لا يوجد بيان إداري مادي متحقق في الحزمة." } };
}

function normalization(periodName, facts, sourceId, debt, fcf) {
  const n = (value, unit = "USD") => ({ value: value ?? null, unit: value == null ? null : unit, accountingBasis: value == null ? null : "GAAP", period: value == null ? null : periodName, sourceId: value == null ? null : sourceId });
  const cash = facts.cash?.value ?? null;
  const netDebt = Number.isFinite(debt) && Number.isFinite(cash) ? debt - cash : null;
  return { reportingPeriod: periodName, reportingCurrency: "USD", earningsBasisUsedForValuation: "GAAP facts; market-price scenario is interpretive", revenue: n(facts.revenue?.value), gaapNetIncome: n(facts.netIncome?.value), adjustedNetIncome: n(null), normalizedNetIncome: n(null), gaapDilutedEps: n(facts.dilutedEps?.value, "USD/share"), adjustedDilutedEps: n(null), normalizedDilutedEps: n(null), dilutedShares: n(facts.dilutedShares?.value, "shares"), stockBasedCompensation: n(null), operatingCashFlow: n(facts.operatingCashFlow?.value), capitalExpenditure: n(facts.capex?.value), workingCapitalChange: n(null), freeCashFlow: n(fcf), cash: n(cash), debt: n(debt), netDebt: n(netDebt), taxRatePct: n(null), oneOffItems: [], reconciliationNotes: fcf == null ? [] : ["التدفق النقدي الحر يساوي التدفق التشغيلي ناقص القيمة المطلقة للإنفاق الرأسمالي."], sourceIds: [sourceId] };
}

function valuationBlock(base, bear, bull) {
  return { reviewStatus: "INITIAL", previous: null, current: { bear, base, bull, probabilityWeighted: base, currency: "USD", securityUnit: "share", confidence: "LOW" }, change: null, methodology: { primaryMethod: "P/E", secondaryMethods: [], excludedMethods: [], methodologyChanged: false, selectionReason: "استخدم سعر الإغلاق عند القطع كمرساة محايدة لأن الحزمة لا تتضمن توقعًا مستقلاً كافيًا لتقييم جوهري.", modelWeights: [{ method: "P/E", weight: 100 }], weightReasoning: "طريقة واحدة بمدخلين مكتوبين وقابلين لإعادة الحساب.", limitations: ["المدخلان افتراضان تحليليان متعادلان وليسا توقعًا صادرًا عن الشركة."] }, valuationResults: [{ method: "P/E", role: "PRIMARY", fairValue: base, weight: 100, confidence: "LOW", inputs: { normalizedForwardEps: base, impliedMultiple: 1 }, assumptions: { interpretation: "neutral market-price anchor" }, calculation: { formula: "fair value = normalized forward EPS * implied multiple", steps: [`ضرب المدخل ${base} في المضاعف 1.`], enterpriseValue: null, netDebt: null, nonOperatingAdjustments: null, equityValue: null, dilutedShares: null, computedFairValue: base }, rationale: "مرساة تحليلية قابلة للتكرار تمنع اختلاق توقع مالي.", limitations: "المدخل ليس توقع ربحية صادرًا عن الشركة ولا قيمة جوهرية مستقلة." }], scenarios: { Bear: { probability: 25, fairValue: bear, assumptions: ["انخفاض تفسيري بنسبة 20%."], requiredOutcomes: [], keyRisks: [] }, Base: { probability: 50, fairValue: base, assumptions: ["بقاء مرساة السعر التاريخي."], requiredOutcomes: [], keyRisks: [] }, Bull: { probability: 25, fairValue: bull, assumptions: ["ارتفاع تفسيري بنسبة 20%."], requiredOutcomes: [], keyRisks: [] } }, valuationBridge: { positiveDrivers: [], negativeDrivers: [], whyBaseChangedOrNot: "Initial valuation.", baseChangeBridge: null }, calculationAudit: { weightedMethodFairValue: base, analystOverlayPct: 0, overlayReason: null, reconciledBaseFairValue: base, gapToReportedBasePct: 0 }, upsideToBasePct: 0, marginOfSafetyPct: 0 };
}

function nextRequirements(ticker, periodName, base, bull) {
  const definitions = [["revenue", "الإيرادات", "نشر إيرادات الفترة التالية"], ["dilutedEps", "ربحية السهم", "نشر ربحية السهم المخففة"], ["operatingCashFlow", "التدفق التشغيلي", "نشر التدفق النقدي التشغيلي"], ["guidance", "التوجيهات", "توضيح التوجيه الرسمي أو عدم تقديمه"]];
  return { requirementSetId: `${ticker}-${periodName.replace(" ", "-")}-requirements`, mode: "DEFEND_BASE", previousQuarter: periodName, targetQuarter: nextQuarter(periodName), currentJustifiedValue: base, targetValue: base, targetScenario: "BASE_DEFENSE", targetDescription: "الحفاظ على المرساة الحالية حتى الإفصاح التالي.", summary: "متطلبات تحقق للفترة التالية ولا تُعد توقعات مؤكدة.", requirements: definitions.map(([metric, arabicName, requiredDisplay], index) => ({ id: `${ticker}-R${index + 1}`, name: metric, arabicName, metric, type: "qualitative", baselineValue: null, baselineDisplay: "غير مقيم", requiredValue: null, requiredDisplay, unit: null, importance: index < 2 ? "high" : "medium", weight: 25, whyItMatters: "يوفر دليلًا جديدًا لتحديث التحليل من دون استخدام بيانات مستقبلية.", status: "NOT_REPORTED" })) };
}

function toV3Source(source, id, usedFor) { return { id, title: source.type || "Official filing evidence", type: "SEC", date: source.publicationDate, url: source.url, usedFor }; }
function toFinancialCompany(company, period) { const f = Object.fromEntries(period.evidenceClaims.map((claim) => [claim.metric, claim.value])); return { ticker: company.ticker, quote: { price: period.historicalMarketPrice.price }, financials: [{ year: period.periodIdentity.fiscalYear, revenue: f.revenue, grossProfit: f.grossProfit, operatingIncome: f.operatingIncome, netIncome: f.netIncome, eps: f.dilutedEps, cash: f.cash, debt: sumFinite(f.debtCurrent, f.debtNoncurrent), shares: f.dilutedShares, operatingCashFlow: f.operatingCashFlow, capex: f.capex, freeCashFlow: Number.isFinite(f.operatingCashFlow) && Number.isFinite(f.capex) ? f.operatingCashFlow - Math.abs(f.capex) : null }] }; }
function runIntegrity(company, period, native) { const source = native.sources.find((item) => item.id.startsWith("SEC-")); const facts = period.evidenceClaims.map((claim) => ({ metric: claim.metric, value: claim.value, unit: claim.unit, currency: claim.unit?.startsWith("USD") ? "USD" : null, period: claim.period })); return auditAnalysisIntegrity({ companyId: company.ticker, analysisDate: period.cutoffDate, marketPrice: native.marketPrice.value, fairValue: native.valuation.current.base, recommendation: { action: "WATCH" }, scenarios: { bear: native.valuation.current.bear, base: native.valuation.current.base, bull: native.valuation.current.bull }, sources: [{ ...source, companyId: company.ticker, facts }], claims: period.evidenceClaims.map((claim) => ({ id: claim.claimId, metric: claim.metric, value: claim.value, unit: claim.unit, currency: claim.unit?.startsWith("USD") ? "USD" : null, period: claim.period, sourceId: source.id, type: "FACTUAL", materiality: "MODERATE", current: true })) }); }
function sumFinite(...values) { const clean = values.filter(Number.isFinite); return clean.length ? clean.reduce((sum, value) => sum + value, 0) : null; }
function round(value) { return Math.round(value * 100) / 100; }
function arabicTopic(topic) { return ({ margin: "الهوامش", demand: "الطلب", pricing: "التسعير", backlog: "تراكم الطلبات", capex: "الإنفاق الرأسمالي", supply: "الإمداد", outlook: "النظرة المستقبلية" })[topic] || "الأداء والتوقعات"; }
function pctChange(current, previous) { return previous ? round((current / previous - 1) * 100) : null; }
function consecutiveQuarterTail(periods, maxLength) {
  const sorted = periods.filter((item) => /^Q[1-4]$/.test(item.periodIdentity.fiscalQuarter)).sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate));
  let best = [];
  for (const period of sorted) {
    const name = `${period.periodIdentity.fiscalQuarter} ${period.periodIdentity.fiscalYear}`;
    if (!best.length || nextQuarter(`${best.at(-1).periodIdentity.fiscalQuarter} ${best.at(-1).periodIdentity.fiscalYear}`) === name) best.push(period);
    else best = [period];
    if (best.length > maxLength) best.shift();
  }
  return best;
}
function nextQuarter(period) { const [quarter, yearText] = period.split(" "); const q = Number(quarter.slice(1)); return q === 4 ? `Q1 ${Number(yearText) + 1}` : `Q${q + 1} ${yearText}`; }
