import test from "node:test";
import assert from "node:assert/strict";
import { buildMetricSnapshot, CAGR, safeDiv, toNumber, weightedAverage } from "../src/domain/financialMetrics.js";
import { runValuation } from "../src/engines/valuationEngine.js";
import { calculateRangeFairValue, calculateUpside } from "../src/domain/evaluatedCompanies.js";
import { goldenCases } from "./financial/goldenDataset.mjs";
import { close, referenceDcf, referenceMetrics, referenceRange, referenceValuation } from "./financial/referenceEngine.mjs";

const SEED = 0x4652414e;
const tolerance = { ratio: 1e-12, money: 1e-8, perShare: 1e-9 };

test("P3 golden dataset has 100 diverse independently calculated cases", () => {
  assert.equal(goldenCases.length, 100);
  assert.equal(new Set(goldenCases.map((item) => item.category)).size, 20);
  for (const item of goldenCases) {
    const [current, prior, oldest] = item.financials;
    const actual = buildMetricSnapshot({ financials: item.financials });
    const expected = referenceMetrics(current, prior, oldest);
    for (const key of Object.keys(expected)) assert.ok(close(actual[key], expected[key], tolerance.ratio), `${item.id} ${key}`);
    if (!item.expected.valuation) continue;
    const result = runValuation({ financials: item.financials, quote: { price: 25 } });
    const reference = item.expected.valuation;
    for (const method of result.methods) {
      if (reference.methods[method.name] !== undefined) assert.ok(close(method.fairValue, reference.methods[method.name], tolerance.perShare), `${item.id} ${method.name}`);
    }
    assert.ok(close(result.compositeFairValue, reference.composite, tolerance.perShare), `${item.id} composite`);
  }
});

test("P3 DCF intermediate mathematics and sensitivity properties", () => {
  const base = { fcf: 120, growth: .08, discountRate: .095, terminalGrowth: .025, netCash: 40, shares: 50, years: 5 };
  const value = referenceDcf(base);
  assert.equal(value.forecast.length, 5);
  assert.ok(close(value.equityValue, value.enterpriseValue + 40));
  assert.ok(close(value.fairValuePerShare, value.equityValue / 50));
  assert.ok(referenceDcf({ ...base, discountRate: .11 }).fairValuePerShare < value.fairValuePerShare);
  assert.ok(referenceDcf({ ...base, terminalGrowth: .03 }).fairValuePerShare > value.fairValuePerShare);
  assert.ok(referenceDcf({ ...base, fcf: 140 }).fairValuePerShare > value.fairValuePerShare);
  assert.ok(referenceDcf({ ...base, netCash: 20 }).fairValuePerShare < value.fairValuePerShare);
  assert.ok(referenceDcf({ ...base, shares: 60 }).fairValuePerShare < value.fairValuePerShare);
});

test("P3 accounting, units, split, currency and metamorphic invariants", () => {
  assert.equal(safeDiv(250, 1000), .25);
  assert.equal(calculateUpside(120, 100), .2);
  assert.ok(close(calculateRangeFairValue({ bearFairValue: 80, bearProbability: .2, baseFairValue: 100, baseProbability: .5, bullFairValue: 140, bullProbability: .3 }), referenceRange([{ value: 80, probability: .2 }, { value: 100, probability: .5 }, { value: 140, probability: .3 }])));
  const base = goldenCases[3];
  const scaled = structuredClone(base); scaled.financials.forEach((row) => { for (const key of ["revenue","grossProfit","operatingIncome","netIncome","freeCashFlow","ebitda","cash","debt","equity","shares"]) row[key] *= 1000; });
  const a = buildMetricSnapshot({ financials: base.financials }); const b = buildMetricSnapshot({ financials: scaled.financials });
  for (const key of ["grossMargin","operatingMargin","fcfMargin","revenueGrowth","revenueCagr","roic","netDebtToEbitda"]) assert.ok(close(a[key], b[key]));
  const original = runValuation({ financials: base.financials, quote: { price: 20 } });
  const split = structuredClone(base.financials); split.forEach((row) => { row.shares *= 4; row.eps /= 4; });
  const afterSplit = runValuation({ financials: split, quote: { price: 5 } });
  assert.ok(close(original.compositeFairValue / 4, afterSplit.compositeFairValue));
  assert.deepEqual(buildMetricSnapshot({ financials: [...base.financials].reverse() }), buildMetricSnapshot({ financials: base.financials }));
});

test("P3 10000 seeded differential/property scenarios", () => {
  const random = mulberry32(SEED);
  for (let index = 0; index < 10000; index += 1) {
    const oldestRevenue = between(random, 10, 1e7); const g1 = between(random, -.08, .25); const g2 = between(random, -.08, .25);
    const priorRevenue = oldestRevenue * (1 + g1); const revenue = priorRevenue * (1 + g2);
    const margin = between(random, .01, .4); const shares = between(random, .1, 1e6);
    const fcfMargin = between(random, .01, .3); const fcf0 = oldestRevenue * fcfMargin; const fcf1 = priorRevenue * fcfMargin; const fcf2 = revenue * fcfMargin;
    const cash = between(random, 0, revenue); const debt = between(random, 0, revenue * 2); const equity = between(random, revenue * .1, revenue * 3);
    const rows = [
      { year: 2026, revenue, grossProfit: revenue * (margin + .2), operatingIncome: revenue * margin, eps: revenue * margin * .75 / shares, freeCashFlow: fcf2, ebitda: revenue * (margin + .04), cash, debt, equity, shares },
      { year: 2025, revenue: priorRevenue, grossProfit: priorRevenue * (margin + .2), operatingIncome: priorRevenue * margin, eps: priorRevenue * margin * .75 / shares, freeCashFlow: fcf1, ebitda: priorRevenue * (margin + .04), cash, debt, equity, shares },
      { year: 2024, revenue: oldestRevenue, grossProfit: oldestRevenue * (margin + .2), operatingIncome: oldestRevenue * margin, eps: oldestRevenue * margin * .75 / shares, freeCashFlow: fcf0, ebitda: oldestRevenue * (margin + .04), cash, debt, equity, shares }
    ];
    const actual = buildMetricSnapshot({ financials: rows }); const expected = referenceMetrics(rows[0], rows[1], rows[2]);
    for (const key of Object.keys(expected)) assert.ok(close(actual[key], expected[key]), failure(index, key, rows, actual[key], expected[key]));
    const production = runValuation({ financials: rows, quote: { price: 20 } });
    const growth = (actual.revenueCagr + actual.fcfCagr) / 2;
    const reference = referenceValuation({ fcf: fcf2, growth, netCash: cash - debt, shares, eps: rows[0].eps, ebitda: rows[0].ebitda, revenue, roic: actual.roic, operatingMargin: actual.operatingMargin, fcfMargin: actual.fcfMargin });
    assert.ok(close(production.compositeFairValue, reference.composite, tolerance.perShare), failure(index, "composite", rows, production.compositeFairValue, reference.composite));
  }
});

test("P3 numeric fuzz rejects unsafe coercions and never returns nonfinite results", () => {
  const rejected = [null, undefined, "", " ", "abc", "1e9999", NaN, Infinity, -Infinity, {}, [], Symbol("x")];
  for (const value of rejected) assert.doesNotThrow(() => { assert.equal(toNumber(value), null); });
  for (const values of [[0, 1], [-1, 2], [1, NaN], [1, Infinity], [1], null]) assert.equal(CAGR(values), null);
  assert.equal(weightedAverage([{ value: Infinity, weight: 1 }, { value: 2, weight: 0 }]), null);
});

test("P3 reproducibility and test-order independence", () => {
  const cases = [goldenCases[0], goldenCases[49], goldenCases[99]];
  const normal = cases.map((item) => runValuation({ financials: item.financials, quote: { price: 25 } }));
  const reverse = [...cases].reverse().map((item) => runValuation({ financials: item.financials, quote: { price: 25 } })).reverse();
  assert.deepEqual(normal, reverse);
  for (let iteration = 0; iteration < 20; iteration += 1) assert.deepEqual(cases.map((item) => runValuation({ financials: item.financials, quote: { price: 25 } })), normal);
});

function mulberry32(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function between(random, min, max) { return min + random() * (max - min); }
function failure(index, property, input, production, reference) { return JSON.stringify({ seed: SEED, case: index, property, minimizedCounterexample: input, production, reference }); }
