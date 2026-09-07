import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const userAgent = process.env.SEC_USER_AGENT || "Franklin quality audit contact@example.com";
const benchmark = JSON.parse(await readFile(resolve("tests/corpus/real-world/benchmark.json"), "utf8"));
const priorCorpus = await readPriorCorpus();
const priorPeriods = new Map((priorCorpus?.companies || []).flatMap((company) => company.periods.map((period) => [`${company.ticker}:${period.periodIdentity.accession}`, period])));
const retrievalDate = new Date().toISOString().slice(0, 10);
const packages = [];

for (const company of benchmark.companies) {
  const submissionsUrl = `https://data.sec.gov/submissions/CIK${company.cik}.json`;
  const submissions = await getJson(submissionsUrl);
  const selectedPeriods = distinctPeriods(company.truthRecords);
  const filings = await filingsForPeriods(submissions, selectedPeriods);
  packages.push({
    caseId: company.caseId,
    ticker: company.ticker,
    company: company.company,
    cik: company.cik,
    retrievalDate,
    submissionsUrl,
    periods: selectedPeriods.map((period) => sourcePackage(company, period, filings, retrievalDate))
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 110));
}

const output = {
  schemaVersion: "franklin-real-world-source-packages/v1",
  generatedAt: new Date().toISOString(),
  sourcePolicy: "Official SEC filing metadata and documents; unavailable evidence remains explicit and is never inferred.",
  companies: packages
};
await mkdir(resolve("tests/corpus/real-world"), { recursive: true });
await writeFile(resolve("tests/corpus/real-world/source-packages.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Preserved official filing packages for ${packages.length} issuers.`);

function sourcePackage(company, period, filings, retrieved) {
  const filing = filings.find((item) => item.accessionNumber === period.accession);
  const release = nearestEarningsRelease(filings, period.filed);
  const cutoffDate = period.filed;
  const result = {
    periodIdentity: { fiscalQuarter: period.fiscalPeriod, fiscalYear: period.fiscalYear, periodEnd: period.end, filingDate: period.filed, accession: period.accession, form: period.form },
    cutoffDate,
    earningsReleaseDate: release?.filingDate || null,
    sources: [
      sourceRecord(company.cik, filing || {
        accessionNumber: period.accession,
        filingDate: period.filed,
        reportDate: period.end,
        form: period.form,
        primaryDocument: null,
        items: ""
      }, filing ? "SEC filing" : "SEC filing accession index (submissions filename unavailable)", retrieved),
      release && sourceRecord(company.cik, release, "SEC Item 2.02 earnings release package", retrieved)
    ].filter(Boolean),
    evidenceClaims: Object.entries(period.facts).map(([metric, fact]) => ({
      claimId: `${company.caseId}-${period.accession}-${metric}`,
      metric, value: fact.value, unit: fact.unit, period: fact.end, accountingBasis: fact.basis,
      taxonomyConcept: fact.taxonomyConcept, sourceAccession: period.accession, verificationStatus: "VERIFIED"
    })),
    guidance: { status: "NOT_VERIFIED", reason: "No guidance extraction has been completed from the official release package." },
    narrative: { status: "NOT_VERIFIED", reason: "No material narrative claim has been extracted and linked." },
    beatMiss: { status: "NOT_APPLICABLE", reason: "The package makes no analyst-consensus beat or miss claim." },
    historicalMarketPrice: { status: "NOT_VERIFIED", reason: "No recognized point-in-time market-price record has been frozen." }
  };
  const prior = priorPeriods.get(`${company.ticker}:${period.accession}`);
  if (prior?.historicalMarketPrice?.status === "VERIFIED" && prior.historicalMarketPrice.asOf <= cutoffDate) {
    result.historicalMarketPrice = prior.historicalMarketPrice;
  }
  const preservedExhibits = (prior?.sources || []).filter((source) => source.type === "Official SEC-filed earnings exhibit");
  if (preservedExhibits.length) {
    result.sources.push(...preservedExhibits);
    result.guidance = prior.guidance;
    result.narrative = prior.narrative;
    result.officialEvidenceAcquisition = prior.officialEvidenceAcquisition;
  }
  return result;
}

function recentFilings(submissions) {
  const recent = submissions.filings?.recent || {};
  return (recent.accessionNumber || []).map((accessionNumber, index) => ({
    accessionNumber, filingDate: recent.filingDate?.[index] || null, reportDate: recent.reportDate?.[index] || null,
    form: recent.form?.[index] || null, primaryDocument: recent.primaryDocument?.[index] || null, items: recent.items?.[index] || ""
  }));
}
async function filingsForPeriods(submissions, periods) {
  const filings = recentFilings(submissions);
  const required = new Set(periods.map((period) => period.accession));
  const found = () => new Set(filings.map((filing) => filing.accessionNumber));
  for (const file of submissions.filings?.files || []) {
    if ([...required].every((accession) => found().has(accession))) break;
    const archived = await getJson(`https://data.sec.gov/submissions/${file.name}`);
    filings.push(...filingRows(archived));
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 110));
  }
  return filings;
}
function filingRows(rows = {}) {
  return (rows.accessionNumber || []).map((accessionNumber, index) => ({
    accessionNumber, filingDate: rows.filingDate?.[index] || null, reportDate: rows.reportDate?.[index] || null,
    form: rows.form?.[index] || null, primaryDocument: rows.primaryDocument?.[index] || null, items: rows.items?.[index] || ""
  }));
}

function nearestEarningsRelease(filings, filingDate) {
  const cutoff = Date.parse(`${filingDate}T00:00:00Z`);
  return filings.filter((item) => item.form === "8-K" && item.items.split(",").map((value) => value.trim()).includes("2.02"))
    .filter((item) => { const days = (cutoff - Date.parse(`${item.filingDate}T00:00:00Z`)) / 86_400_000; return days >= 0 && days <= 60; })
    .sort((left, right) => right.filingDate.localeCompare(left.filingDate))[0] || null;
}

function sourceRecord(cik, filing, type, retrieved) {
  const accession = filing.accessionNumber.replaceAll("-", "");
  const base = `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}`;
  return {
    sourceId: `SEC-${cik}-${filing.accessionNumber}`, type, primary: true, publicationDate: filing.filingDate,
    reportDate: filing.reportDate, accession: filing.accessionNumber, form: filing.form, items: filing.items || null,
    url: filing.primaryDocument ? `${base}/${filing.primaryDocument}` : `${base}/`,
    filingIndexUrl: `${base}/${filing.accessionNumber}-index.html`, retrievalDate: retrieved
  };
}

function distinctPeriods(periods) {
  const seen = new Set();
  return periods.filter((period) => !seen.has(period.end) && seen.add(period.end)).sort((a, b) => b.end.localeCompare(a.end));
}

async function getJson(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent, accept: "application/json" } });
  if (!response.ok) throw new Error(`SEC request failed ${response.status}: ${url}`);
  return response.json();
}
async function readPriorCorpus() {
  try { return JSON.parse(await readFile(resolve("tests/corpus/real-world/source-packages.json"), "utf8")); }
  catch { return null; }
}
