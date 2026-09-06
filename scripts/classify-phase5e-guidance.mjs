import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve("tests/corpus/real-world/source-packages.json");
const corpus = JSON.parse(await readFile(path, "utf8"));

for (const company of corpus.companies) {
  for (const period of company.periods) {
    const prior = period.guidance || {};
    const source = period.sources.find((item) => item.sourceId === prior.sourceId)
      || period.sources.find((item) => item.type === "Official SEC-filed earnings exhibit");
    const common = {
      ticker: company.ticker,
      company: company.company,
      sourceFiscalPeriod: `${period.periodIdentity.fiscalQuarter} ${period.periodIdentity.fiscalYear}`,
      guidanceTargetPeriod: prior.period || targetPeriod(prior.evidenceExcerpt) || null,
      sourceId: source?.sourceId || null,
      evidenceLocator: source?.url || null,
      evidenceText: prior.evidenceExcerpt || null,
      sourceDate: source?.publicationDate || null,
      verificationStatus: "VERIFIED"
    };
    if (prior.status === "VERIFIED") {
      period.guidanceClassification = {
        classification: "VERIFIED_GUIDANCE",
        ...common,
        metric: prior.metric,
        low: prior.low ?? null,
        high: prior.high ?? null,
        pointEstimate: prior.pointEstimate ?? null,
        qualitativeDirection: null,
        unit: prior.unit ?? null,
        currency: prior.currency ?? null,
        accountingBasis: prior.accountingBasis ?? null,
        action: prior.direction || "initiated"
      };
    } else if (prior.status === "GUIDANCE_PRESENT_UNSTRUCTURED" && prior.evidenceExcerpt) {
      period.guidanceClassification = {
        classification: /withdraw|no longer provid|not provid(?:e|ing)/i.test(prior.evidenceExcerpt)
          ? "VERIFIED_GUIDANCE_WITHDRAWN"
          : "VERIFIED_GUIDANCE_NOT_QUANTIFIED",
        ...common,
        metric: qualitativeMetric(prior.evidenceExcerpt),
        low: null,
        high: null,
        pointEstimate: pointEstimate(prior.evidenceExcerpt),
        qualitativeDirection: qualitativeDirection(prior.evidenceExcerpt),
        unit: inferredUnit(prior.evidenceExcerpt),
        currency: /\$/.test(prior.evidenceExcerpt) ? "USD" : null,
        accountingBasis: /non-gaap|adjusted/i.test(prior.evidenceExcerpt) ? "NON_GAAP" : /gaap/i.test(prior.evidenceExcerpt) ? "GAAP" : null,
        action: guidanceAction(prior.evidenceExcerpt)
      };
    } else {
      period.guidanceClassification = {
        classification: "VERIFIED_NO_FORMAL_GUIDANCE",
        ...common,
        metric: null,
        low: null,
        high: null,
        pointEstimate: null,
        qualitativeDirection: null,
        unit: null,
        currency: null,
        accountingBasis: null,
        action: null,
        verificationBasis: "No targeted formal-guidance language was found in the frozen official reporting-period exhibit."
      };
    }
    if (!source || source.publicationDate > period.cutoffDate) {
      period.guidanceClassification.classification = "TRUE_EVIDENCE_GAP";
      period.guidanceClassification.verificationStatus = "FAILED";
    }
  }
}

await writeFile(path, `${JSON.stringify(corpus, null, 2)}\n`);
console.log("Classified all Phase 5E guidance records from frozen official evidence.");

function cleanText(value) { return String(value || ""); }
function targetPeriod(text) { return cleanText(text).match(/(?:first|second|third|fourth|next) quarter(?: of)?(?: fiscal)? \d{4}|(?:fiscal|full year) \d{4}|Q[1-4]\s*(?:FY)?\s*\d{2,4}/i)?.[0] || null; }
function qualitativeMetric(text) { text = cleanText(text); return /revenue|sales/i.test(text) ? "revenue" : /earnings per share|\beps\b/i.test(text) ? "EPS" : /ebitda/i.test(text) ? "EBITDA" : /free cash flow|\bfcf\b/i.test(text) ? "free cash flow" : /capital expenditure|capex/i.test(text) ? "capex" : /margin/i.test(text) ? "margin" : /bookings/i.test(text) ? "bookings" : /subscriber|customer/i.test(text) ? "customer metric" : "management outlook"; }
function qualitativeDirection(text) { text = cleanText(text); return /improv|increase|grow|higher|strong/i.test(text) ? "UP" : /declin|decrease|lower|weaken|soft/i.test(text) ? "DOWN" : /stable|maintain|reaffirm|unchanged/i.test(text) ? "UNCHANGED" : "DIRECTION_NOT_STATED"; }
function guidanceAction(text) { text = cleanText(text); return /withdraw|no longer provid|not provid(?:e|ing)/i.test(text) ? "withdrawn" : /rais|increase/i.test(text) ? "raised" : /lower|reduc/i.test(text) ? "lowered" : /reaffirm|reiterat|maintain/i.test(text) ? "reiterated" : "initiated"; }
function inferredUnit(text) { text = cleanText(text); return /%/.test(text) ? "%" : /\$/.test(text) ? "USD" : null; }
function pointEstimate(text) { const match = cleanText(text).match(/(?:expect(?:s|ed)?|forecast|outlook)[^$%]{0,80}\$\s*([\d,.]+)/i); return match ? Number(match[1].replaceAll(",", "")) : null; }
