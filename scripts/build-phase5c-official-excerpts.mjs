import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

class RateLimitError extends Error {}

const path = resolve("tests/corpus/real-world/source-packages.json");
const corpus = JSON.parse(await readFile(path, "utf8"));
const retrievalDate = new Date().toISOString().slice(0, 10);
const jobs = [];
for (const company of corpus.companies) {
  for (const period of company.periods) {
    const release = period.sources.find((source) => source.type.includes("2.02"));
    const exhibit = period.sources.find((source) => source.type === "Official SEC-filed earnings exhibit");
    if (exhibit) {
      period.officialEvidenceAcquisition = status("COMPLETE", null, exhibit.sourceId);
      continue;
    }
    if (release) {
      period.officialEvidenceAcquisition ||= status("PENDING", "Official SEC exhibit is queued for retrieval.");
      jobs.push({ company, period, release });
      continue;
    }
    period.officialEvidenceAcquisition ||= status("PENDING", "No Item 2.02 package was located; official IR alternative discovery is required.");
  }
}

const queue = [...jobs];
const failures = [];
let stoppedForRateLimit = false;
while (queue.length && !stoppedForRateLimit) {
  const job = queue.shift();
  job.period.officialEvidenceAcquisition = status("PENDING", "Retrieval in progress.", null, job.period.officialEvidenceAcquisition?.attempts);
  await persist();
  try {
    await enrich(job);
    const exhibit = job.period.sources.find((source) => source.type === "Official SEC-filed earnings exhibit");
    job.period.officialEvidenceAcquisition = status("COMPLETE", null, exhibit.sourceId, job.period.officialEvidenceAcquisition.attempts + 1);
  } catch (error) {
    const retryable = error instanceof RateLimitError || /\b(?:429|5\d\d)\b/.test(error.message);
    job.period.officialEvidenceAcquisition = status(retryable ? "RETRYABLE" : "FAILED", error.message, null, job.period.officialEvidenceAcquisition.attempts + 1);
    failures.push({ ticker: job.company.ticker, accession: job.release.accession, retryable, error: error.message });
    if (error instanceof RateLimitError) stoppedForRateLimit = true;
  }
  await persist();
}

corpus.officialExcerptAcquisition = {
  retrievalDate,
  attempted: jobs.length,
  completedThisRun: jobs.length - queue.length - failures.length,
  remaining: queue.length + (stoppedForRateLimit ? 1 : 0),
  stoppedForRateLimit,
  failures
};
await persist();
console.log(JSON.stringify(corpus.officialExcerptAcquisition, null, 2));
if (failures.length || queue.length) process.exitCode = 2;

async function enrich({ company, period, release }) {
  const base = release.filingIndexUrl.replace(/\/[^/]+-index\.html$/, "");
  const directory = await getJson(`${base}/index.json`);
  const candidates = (directory.directory?.item || [])
    .filter((item) => /\.(?:html?|txt)$/i.test(item.name))
    .filter((item) => !/-index(?:-headers)?\.html$/i.test(item.name))
    .filter((item) => !/^R\d+\.htm$/i.test(item.name))
    .sort((left, right) => Number(right.size || 0) - Number(left.size || 0));
  const selected = candidates.find((item) => item.name !== release.url.split("/").at(-1)) || candidates[0];
  if (!selected) throw new Error("No official HTML or full-submission text exhibit found");
  const documentUrl = `${base}/${selected.name}`;
  const html = await getText(documentUrl);
  const text = htmlToText(html);
  const source = {
    sourceId: `${release.sourceId}-EXHIBIT`,
    type: "Official SEC-filed earnings exhibit",
    primary: true,
    url: documentUrl,
    publicationDate: release.publicationDate,
    retrievalDate,
    sha256: createHash("sha256").update(html).digest("hex"),
    contentLength: html.length
  };
  period.sources.push(source);

  const guidanceExcerpt = excerpt(text, /guidance|outlook|expect(?:s|ed)?|forecast|project(?:s|ed)?|anticipate(?:s|d)?|reaffirm(?:s|ed)?/i);
  const guidance = guidanceExcerpt ? parseGuidance(guidanceExcerpt, period, source.sourceId) : null;
  period.guidance = guidance || {
    status: guidanceExcerpt ? "GUIDANCE_PRESENT_UNSTRUCTURED" : "NOT_APPLICABLE",
    determination: guidanceExcerpt ? "GUIDANCE PRESENT" : "NO FORMAL GUIDANCE",
    reason: guidanceExcerpt ? "Official outlook language was found but complete structured guidance was not independently verified." : "No company guidance language was found in the selected official exhibit.",
    evidenceExcerpt: guidanceExcerpt || null,
    sourceId: guidanceExcerpt ? source.sourceId : null
  };

  const narrativeExcerpt = excerpt(text, /demand|pricing|margin|backlog|capital expenditure|capex|supply|artificial intelligence|\bAI\b|customer|outlook/i);
  period.narrative = narrativeExcerpt ? {
    status: "VERIFIED",
    topic: narrativeTopic(narrativeExcerpt),
    managementStatement: narrativeExcerpt,
    claimTreatment: "SOURCE_QUOTATION_ONLY",
    sourceId: source.sourceId
  } : { status: "NOT_APPLICABLE", reason: "No targeted material management statement was found in the selected official exhibit." };
}

function parseGuidance(value, period, sourceId) {
  const dollars = [...value.matchAll(/\$\s*([\d,.]+)\s*(million|billion|m|bn|b)?\s*(?:to|-|–|and)\s*\$?\s*([\d,.]+)\s*(million|billion|m|bn|b)?/gi)];
  const percentages = [...value.matchAll(/([\d.]+)\s*%\s*(?:to|-|–|and)\s*([\d.]+)\s*%/gi)];
  const match = dollars[0] || percentages[0];
  if (!match) return null;
  const isPct = Boolean(percentages[0]);
  const scale = isPct ? 1 : unitScale(match[2] || match[4]);
  const low = Number(String(match[1]).replaceAll(",", "")) * scale;
  const high = Number(String(match[3]).replaceAll(",", "")) * scale;
  if (![low, high].every(Number.isFinite)) return null;
  return {
    status: "VERIFIED",
    metric: metricName(value),
    period: guidancePeriod(value, period),
    low: Math.min(low, high),
    high: Math.max(low, high),
    midpoint: (low + high) / 2,
    unit: isPct ? "%" : "USD",
    currency: isPct ? null : "USD",
    accountingBasis: /non-gaap|adjusted/i.test(value) ? "NON_GAAP" : /gaap/i.test(value) ? "GAAP" : "UNSPECIFIED",
    direction: /rais|increas/i.test(value) ? "raised" : /lower|reduc/i.test(value) ? "lowered" : /reaffirm|reiterat|maintain/i.test(value) ? "reiterated" : /withdraw/i.test(value) ? "withdrawn" : "initiated",
    evidenceExcerpt: value,
    sourceId
  };
}

function excerpt(text, pattern) {
  const match = pattern.exec(text);
  if (!match) return null;
  const start = Math.max(0, text.lastIndexOf(". ", match.index - 260) + 2);
  const endCandidate = text.indexOf(". ", Math.min(text.length, match.index + 360));
  return text.slice(start, endCandidate > start ? endCandidate + 1 : Math.min(text.length, start + 620)).trim().slice(0, 620);
}

function htmlToText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
}
function unitScale(unit = "") { return /billion|bn|^b$/i.test(unit) ? 1e9 : /million|^m$/i.test(unit) ? 1e6 : 1; }
function metricName(value) { return /revenue|sales/i.test(value) ? "revenue" : /earnings per share|\beps\b/i.test(value) ? "EPS" : /margin/i.test(value) ? "margin" : /capital expenditure|capex/i.test(value) ? "capex" : "company outlook metric"; }
function guidancePeriod(value, period) { return value.match(/(?:first|second|third|fourth|next) quarter(?: of)?(?: fiscal)? \d{4}|(?:fiscal|full year) \d{4}|Q[1-4]\s*(?:FY)?\s*\d{2,4}/i)?.[0] || `${period.periodIdentity.fiscalQuarter} ${period.periodIdentity.fiscalYear}`; }
function narrativeTopic(value) { return ["demand","pricing","margin","backlog","capex","supply","AI","customer","outlook"].find((topic) => new RegExp(topic, "i").test(value)) || "management outlook"; }

async function getJson(url) { return JSON.parse(await getText(url)); }
async function getText(url) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await delay(800 + randomJitter(350) + (2 ** attempt) * 750);
    const response = await fetch(url, { headers: { "user-agent": "Franklin quality audit contact@example.com", accept: "text/html,application/json" } });
    if (response.ok) return response.text();
    if (response.status !== 429) throw new Error(`SEC request failed ${response.status}: ${url}`);
    const retryAfter = Number(response.headers.get("retry-after"));
    await delay(Number.isFinite(retryAfter) ? retryAfter * 1000 : (2 ** attempt) * 1500 + randomJitter(800));
  }
  throw new RateLimitError(`SEC request remained throttled: ${url}`);
}

function status(state, reason = null, sourceId = null, attempts = 0) {
  return { state, reason, sourceId, attempts: Number(attempts) || 0, updatedAt: new Date().toISOString() };
}
function randomJitter(max) { return Math.floor(Math.random() * max); }
function delay(milliseconds) { return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds)); }
async function persist() { await writeFile(path, `${JSON.stringify(corpus, null, 2)}\n`); }
