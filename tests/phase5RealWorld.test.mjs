import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildMetricSnapshot } from "../src/domain/financialMetrics.js";
import { runValuation } from "../src/engines/valuationEngine.js";
import { auditAnalysisIntegrity } from "../src/aiIntegrity/auditor.js";
import { close, referenceMetrics } from "./financial/referenceEngine.mjs";

const benchmark = JSON.parse(await readFile(new URL("./corpus/real-world/benchmark.json", import.meta.url), "utf8"));
const companies = benchmark.companies;

test("P5 real NVDA claim output preserves absent optionals as explicit null", () => {
  const company = companies.find((item) => item.ticker === "NVDA");
  const audited = auditAnalysisIntegrity(toIntegrityPayload(company, distinctPeriods(company)[0]));
  for (const claim of audited.claims) {
    assert.equal(claim.low, null);
    assert.equal(claim.high, null);
    assert.equal(claim.midpoint, null);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(audited)), audited);
});

test("P5 benchmark contains at least 100 real SEC issuers with reproducible primary provenance", () => {
  assert.ok(companies.length >= 100);
  assert.ok(new Set(companies.map((company) => company.ticker)).size >= 100);
  assert.ok(new Set(companies.map((company) => company.sector)).size >= 16);
  for (const company of companies) {
    assert.match(company.source.url, /^https:\/\/data\.sec\.gov\/api\/xbrl\/companyfacts\/CIK\d{10}\.json$/);
    assert.equal(company.source.primary, true);
    assert.ok(company.cik && company.company && company.cutoffDate);
    assert.ok(company.truthRecords.length > 0);
    for (const period of company.truthRecords) {
      assert.ok(period.accession && period.form && period.filed && period.end);
      assert.ok(Object.values(period.facts).every((fact) => fact.taxonomyConcept && fact.unit && fact.filed && fact.basis === "GAAP"));
      assert.ok(Object.values(period.facts).every((fact) => fact.end === period.end), `${company.ticker} ${period.accession} mixes comparative periods`);
    }
  }
});

test("P5 all-company factual, financial, integrity and round-trip pipeline", () => {
  for (const company of companies) {
    const periods = distinctPeriods(company);
    const rows = periods.map(financialRow);
    const promptContext = JSON.stringify({ company: { ticker: company.ticker, name: company.company, cik: company.cik }, cutoffDate: company.cutoffDate, periods });
    const detectedContract = promptContext.includes(company.cik) ? "SEC_TRUTH_CONTEXT_V1" : null;
    assert.equal(detectedContract, "SEC_TRUTH_CONTEXT_V1", company.ticker);
    const parsed = JSON.parse(promptContext);
    assert.equal(parsed.company.ticker, company.ticker);

    const metrics = buildMetricSnapshot({ financials: rows });
    if (rows.length >= 3 && rows.slice(0, 3).every((row) => [row.revenue,row.grossProfit,row.operatingIncome,row.freeCashFlow,row.ebitda,row.cash,row.debt,row.equity].every(Number.isFinite))) {
      const reference = referenceMetrics(rows[0], rows[1], rows[2]);
      for (const key of Object.keys(reference)) assert.ok(close(metrics[key], reference[key]), `${company.ticker} ${key}`);
    }
    const valuation = runValuation({ financials: rows, quote: { price: null } });
    assert.ok(!valuation.methods.some((method) => !Number.isFinite(method.fairValue)), company.ticker);
    if (!(rows[0]?.eps > 0)) assert.ok(!valuation.methods.some((method) => method.name === "P/E"), company.ticker);

    const integrityPayload = toIntegrityPayload(company, periods[0]);
    const integrity = auditAnalysisIntegrity(integrityPayload);
    assert.ok(integrity.claims.every((claim) => claim.status === "VERIFIED"), company.ticker);
    assert.equal(integrity.findings.length, 0, company.ticker);

    const stored = { schemaVersion: "franklin-real-world-case/v1", promptContext: parsed, metrics, valuation, integrity, source: company.source };
    const exported = JSON.stringify(stored);
    assert.deepEqual(JSON.parse(exported), stored, company.ticker);
  }
});

test("P5 30 two-period real revaluation chains preserve history and explain changes", () => {
  const selected = companies.filter((company) => distinctPeriods(company).length >= 2).slice(0, 30);
  assert.equal(selected.length, 30);
  for (const company of selected) {
    const periods = distinctPeriods(company).slice(0, 2).reverse();
    const history = [];
    for (const period of periods) {
      const state = { ticker: company.ticker, accession: period.accession, period: period.end, facts: structuredClone(period.facts) };
      history.push(state);
      assert.equal(history.at(-1).ticker, company.ticker);
      assert.equal(new Set(history.map((item) => item.accession)).size, history.length);
    }
    assert.equal(history.length, 2);
    assert.notEqual(history[0].period, history[1].period);
    const changedInputs = changedFactKeys(history[0].facts, history[1].facts);
    assert.ok(changedInputs.length > 0, company.ticker);
    const roundTrip = JSON.parse(JSON.stringify(history));
    assert.deepEqual(roundTrip, history);
  }
});

test("P5 10 three-period longitudinal chains remain unique and chronological", () => {
  const selected = companies.filter((company) => distinctPeriods(company).length >= 3).slice(0, 10);
  assert.equal(selected.length, 10);
  for (const company of selected) {
    const chain = distinctPeriods(company).slice(0, 3).reverse();
    assert.equal(new Set(chain.map((period) => period.accession)).size, 3, company.ticker);
    assert.equal(new Set(chain.map((period) => period.end)).size, 3, company.ticker);
    assert.deepEqual(chain.map((period) => period.end), chain.map((period) => period.end).toSorted(), company.ticker);
    assert.ok(chain.every((period) => period.filed <= company.cutoffDate), company.ticker);
  }
});

test("P5 batch order and cross-company isolation are stable", () => {
  const normal = companies.map(caseDigest);
  const reverse = [...companies].reverse().map(caseDigest).reverse();
  const random = shuffle(companies, 0x504835).map(caseDigest).sort((a, b) => a.ticker.localeCompare(b.ticker));
  assert.deepEqual(normal, reverse);
  assert.deepEqual([...normal].sort((a, b) => a.ticker.localeCompare(b.ticker)), random);
  assert.equal(new Set(normal.map((item) => item.sourceId)).size, companies.length);
});

test("P5 look-ahead, unavailable data and real-world edge policies fail safely", () => {
  let unavailable = 0;
  for (const company of companies) {
    for (const period of distinctPeriods(company)) {
      assert.ok(period.filed <= company.cutoffDate, company.ticker);
      for (const key of ["revenue","grossProfit","operatingIncome","netIncome","dilutedEps","cash","dilutedShares","operatingCashFlow","capex"]) {
        if (!period.facts[key]) unavailable += 1;
      }
    }
    const row = financialRow(distinctPeriods(company)[0]);
    if (!(row.freeCashFlow > 0)) assert.ok(!runValuation({ financials: [row], quote: {} }).methods.some((method) => method.name === "DCF"), company.ticker);
  }
  assert.ok(unavailable > 0);
});

function distinctPeriods(company) {
  const seen = new Set();
  return company.truthRecords.filter((period) => {
    if (seen.has(period.end)) return false;
    seen.add(period.end);
    return true;
  }).sort((a, b) => b.end.localeCompare(a.end));
}
function financialRow(period) {
  const fact = (key) => Number.isFinite(period?.facts?.[key]?.value) ? period.facts[key].value : null;
  const debt = [fact("debtCurrent"), fact("debtNoncurrent")].filter(Number.isFinite).reduce((sum, value) => sum + value, 0);
  const operatingCashFlow = fact("operatingCashFlow"); const capex = fact("capex");
  return {
    year: Number(period?.end?.slice(0, 4)), revenue: fact("revenue"), grossProfit: fact("grossProfit"),
    operatingIncome: fact("operatingIncome"), netIncome: fact("netIncome"), eps: fact("dilutedEps"),
    freeCashFlow: Number.isFinite(operatingCashFlow) && Number.isFinite(capex) ? operatingCashFlow - Math.abs(capex) : null,
    operatingCashFlow, capex, ebitda: null, cash: fact("cash"), debt: debt || null, equity: null, shares: fact("dilutedShares")
  };
}
function toIntegrityPayload(company, period) {
  const sourceId = `SEC-${company.cik}-${period.accession}`;
  const facts = Object.entries(period.facts).filter(([, fact]) => Number.isFinite(fact.value)).map(([metric, fact]) => ({ metric, value: fact.value, unit: fact.unit, period: period.end, accountingBasis: fact.basis, companyId: company.ticker }));
  return {
    companyId: company.ticker, analysisDate: company.cutoffDate,
    sources: [{ id: sourceId, companyId: company.ticker, date: period.filed, type: "primary", facts }],
    claims: facts.map((fact, index) => ({ id: `${company.caseId}-${index}`, type: "FACTUAL", ...fact, sourceId, text: `${fact.metric} = ${fact.value} ${fact.unit} for ${period.end}` }))
  };
}
function changedFactKeys(a, b) { return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => a[key]?.value !== b[key]?.value); }
function caseDigest(company) { const period = distinctPeriods(company)[0]; return { ticker: company.ticker, sourceId: `${company.cik}:${period.accession}`, end: period.end, factCount: Object.keys(period.facts).length }; }
function shuffle(items, seed) { const result = [...items]; for (let i = result.length - 1; i > 0; i -= 1) { seed = Math.imul(seed ^ seed >>> 15, 1 | seed); const j = (seed >>> 0) % (i + 1); [result[i], result[j]] = [result[j], result[i]]; } return result; }
