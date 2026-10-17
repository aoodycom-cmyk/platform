import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {parseExternalAnalysisInput} from "../src/externalAnalysis/parser.js";
import {normalizeExternalAnalysisReport} from "../src/externalAnalysis/schema.js";
import {saveExternalAnalysis, normalizeExternalAnalysesCollection} from "../src/externalAnalysis/storage.js";
import {classifyDecisionReadiness} from "../src/financialSafety/decisionReadinessUi.js";
import {decisionHeroModel} from "../src/financialSafety/decisionHeroUx.js";
import {appendQuarterlySourceContract} from "../src/financialSafety/quarterlySourceSafety.js";
import {buildFullAnalysisPrompt,buildNewEarningsAnalysisPrompt} from "../src/externalAnalysis/chatgptContract.js";

const load = async name => JSON.parse(await readFile(new URL(`./fixtures/launch-audit/${name}.json`,import.meta.url),"utf8"));
const initial = await load("tsla-q1-initial");
const previous = saveExternalAnalysis({},(await parseExternalAnalysisInput(JSON.stringify(initial),{strictJson:true})).report).report;
previous.priceTargetRequirements.requirementSetId = "TSLA_REQ_Q22026";
const update = await load("tsla-q2-earnings");
update.reportIdentity.previousAnalysisId = previous.id;
update.reportIdentity.previousRequirementSetId = previous.priceTargetRequirements.requirementSetId;
update.previousRequirementsEvaluation.requirementSetId = previous.priceTargetRequirements.requirementSetId;
const parsed = await parseExternalAnalysisInput(JSON.stringify(update),{strictJson:true,currentReport:previous,expectedTicker:"TSLA",expectedReportPeriod:"Q2 2026"});
assert.equal(parsed.report.decision.confidence,45);
assert.equal(parsed.report.metadata.financialVerification.derivedConfidenceScore,90);
assert.equal(classifyDecisionReadiness(parsed.report).status,"verified");
const saved = saveExternalAnalysis({TSLA:[previous]},parsed.report);
const restored = normalizeExternalAnalysesCollection(JSON.parse(JSON.stringify(saved.collection))).TSLA[0];
assert.equal(classifyDecisionReadiness(restored).status,"verified","Revaluation must pass after persisted reload.");
assert.equal(restored.requirementsAssessment.achievementOfReportedWeightPct,40);
assert.equal(restored.priceTargetRequirements.targetQuarter,"Q3 2026");
assert.equal(decisionHeroModel(restored).confidence,45);
await parseExternalAnalysisInput(JSON.stringify(restored),{strictJson:true});

const legacy = structuredClone(restored);
delete legacy.metadata.confidenceBasis;
delete legacy.metadata.revaluationContext;
legacy.decision.confidence=90;
const migrated = normalizeExternalAnalysesCollection({TSLA:[legacy,previous]}).TSLA[0];
assert.equal(migrated.decision.confidence,45,"Old computed confidence must migrate without changing the analyst's estimate.");
assert.equal(classifyDecisionReadiness(migrated).status,"verified","Recover old context from the saved predecessor.");
assert.equal(normalizeExternalAnalysisReport(migrated).decision.confidence,45,"Migration must be idempotent.");

for(const mutate of [
  r=>{r.metadata.franklinV3Report.previousRequirementsEvaluation.requirements[0].requiredValue=1;},
  r=>{r.metadata.franklinV3Report.previousRequirementsEvaluation.requirements[0].weight=100;},
  r=>{r.metadata.franklinV3Report.previousRequirementsEvaluation.assessment.achievementOfReportedWeightPct=100;},
  r=>{r.decision.confidence=90;},
  r=>{r.metadata.franklinV3Report.reportIdentity.previousAnalysisId="wrong-predecessor";}
]){
  const bad=structuredClone(restored);mutate(bad);
  assert.equal(classifyDecisionReadiness(bad).status,"blocked");
  assert.equal(decisionHeroModel(bad).confidence,null,"A blocked report must not show a confidence estimate.");
}
for(const prompt of [buildFullAnalysisPrompt({tickerHint:"TSLA"}),buildNewEarningsAnalysisPrompt(previous,{quarter:2,year:2026})]){
  assert.equal(appendQuarterlySourceContract(prompt),prompt,"Do not append the conflicting legacy sourceType contract to V3.");
  assert.match(prompt,/analystOverlayPct = 0/);
  assert.doesNotMatch(prompt,/بعد analystOverlayPct موثق|غير صفري يحتاج overlayReason|يصالح متوسط الطرق وanalyst overlay/);
}
console.log("TSLA earnings update, reload, legacy migration, frozen target integrity and confidence regressions passed.");
