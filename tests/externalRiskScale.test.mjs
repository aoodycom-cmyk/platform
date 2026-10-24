import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { normalizeExternalAnalysisReport } from '../src/externalAnalysis/schema.js';
import { validateExternalAnalysisSupplement } from '../src/externalAnalysis/supplementValidator.js';
import { normalizeExternalAnalysisSupplement } from '../src/externalAnalysis/supplementSchema.js';
import { mergeExternalAnalysisSupplement } from '../src/externalAnalysis/supplementMerge.js';
import { buildMissingRequirementsPrompt, analyzeExternalAnalysisCompletion } from '../src/externalAnalysis/missingFields.js';
import { riskAssessmentMetric } from '../src/ui/reportAssessmentMetrics.js';
import { externalAnalysisToHomeCard } from '../src/externalAnalysis/reportAdapter.js';
import { parseExternalAnalysisInput } from '../src/externalAnalysis/parser.js';
import { createEarningsUpdatePreview } from '../src/state/store.js';
const parsed = await parseExternalAnalysisInput(readFileSync(new URL('./fixtures/franklin-import-valid.json', import.meta.url), 'utf8'));
const old = { ...parsed.report, scores: { ...parsed.report.scores, risk: 80, riskScale: null } };
const supplement = (fields) => normalizeExternalAnalysisSupplement({schemaVersion:'external-analysis-supplement/v1', fields});
const validFields = { 'scores.risk': 80, 'scores.riskScale': 'higher-is-riskier' };
test('old untyped risk is preserved but never inverted, ranked or shown on a severity bar', () => {
 const report = normalizeExternalAnalysisReport(old);
 assert.equal(report.scores.risk,80); assert.equal(report.scores.riskScale,null);
 assert.deepEqual(riskAssessmentMetric(report),{kind:'unverified-risk',score:80,progress:null,tone:'warning'});
 const prompt=buildMissingRequirementsPrompt(report);
 assert.ok(prompt.fields.some(x=>x.path==='scores.risk'));
 assert.ok(prompt.fields.some(x=>x.path==='scores.riskScale'));
 assert.match(prompt.text,/higher-is-riskier/); assert.match(prompt.text,/100 أعلى مخاطر/);
});
test('new supplements must explicitly reaffirm score and canonical direction together', () => {
 for(const fields of [{'scores.risk':80},{'scores.riskScale':'higher-is-riskier'}, {...validFields,'scores.riskScale':'higher-is-safer'},{...validFields,'scores.risk':101}]){
  assert.equal(validateExternalAnalysisSupplement(supplement(fields),old).valid,false);
 }
 assert.equal(validateExternalAnalysisSupplement(supplement(validFields),old).valid,true);
});
test('same numeric reassessment persists meaning through normalization, JSON reload and home adapter', () => {
 const merged=mergeExternalAnalysisSupplement(old,supplement(validFields));
 assert.equal(merged.report.scores.risk,80); assert.equal(merged.report.scores.riskScale,'higher-is-riskier');
 const reloaded=normalizeExternalAnalysisReport(JSON.parse(JSON.stringify(merged.report)));
 assert.equal(reloaded.scores.riskScale,'higher-is-riskier');
 assert.equal(riskAssessmentMetric(reloaded).progress,80);
 assert.equal(externalAnalysisToHomeCard(reloaded).riskScale,'higher-is-riskier');
});
test('conflict resolution cannot attach incoming direction to a kept or manually changed old score', () => {
 const incoming=supplement({...validFields,'scores.risk':20});
 for(const options of [{resolutions:{'scores.risk':'keep-current'}},{resolutions:{'scores.risk':'manual'},manualValues:{'scores.risk':40}}]){
  const merged=mergeExternalAnalysisSupplement(old,incoming,options);
  assert.equal(merged.report.scores.risk,80);assert.equal(merged.report.scores.riskScale,null);
 }
 const accepted=mergeExternalAnalysisSupplement(old,incoming,{resolutions:{'scores.risk':'use-new'}});
 assert.equal(accepted.report.scores.risk,20);assert.equal(accepted.report.scores.riskScale,'higher-is-riskier');
});
test('zero and hundred are valid and retain direction',()=>{
 for(const risk of [0,100]) assert.equal(validateExternalAnalysisSupplement(supplement({...validFields,'scores.risk':risk}),old).valid,true);
});

test('unrelated supplement preserves untyped risk and immutable original',()=>{
 const report={...old, rawAnalysisOriginal:'original audit payload', earningsQuality:{status:null}};
 const result=mergeExternalAnalysisSupplement(report,supplement({'earningsQuality.status':'Strong'}));
 assert.equal(result.report.scores.risk,80);assert.equal(result.report.scores.riskScale,null);
 assert.equal(result.report.rawAnalysisOriginal,'original audit payload');
});
test('BE 35 and TXN 63 historical supplements are not inferred from ticker or complemented',()=>{
 for(const [ticker, risk] of [['BE',35],['TXN',63]]) {
  const report=normalizeExternalAnalysisReport({...old, company:{...old.company,ticker},scores:{...old.scores,risk}});
  assert.equal(report.scores.risk,risk);assert.equal(report.scores.riskScale,null);
  assert.equal(riskAssessmentMetric(report).progress,null);
 }
});

test('earnings preview shows direction changes even when numeric risk is unchanged',()=>{
 const typed={...old,scores:{...old.scores,riskScale:'higher-is-riskier'}};
 const preview=createEarningsUpdatePreview(old,typed);
 const change=preview.changes.find(x=>x.path==='scores.risk');
 assert.match(change.before,/unknown direction/);assert.match(change.after,/higher is riskier/);
 assert.equal(change.type,'changed');
});
