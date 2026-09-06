import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const userAgent = process.env.SEC_USER_AGENT || "Franklin quality audit contact@example.com";
const output = resolve("tests/corpus/real-world/benchmark.json");
const selections = [
  ["NVDA","Semiconductors"],["AMD","Semiconductors"],["INTC","Semiconductors"],["QCOM","Semiconductors"],["MU","Semiconductors"],["AVGO","Semiconductors"],["TXN","Semiconductors"],["ADI","Semiconductors"],
  ["MSFT","Software"],["ORCL","Software"],["CRM","Software"],["ADBE","Software"],["NOW","Software"],["INTU","Software"],["PLTR","Software"],["SNOW","Cloud"],
  ["AMZN","Internet"],["GOOGL","Internet"],["META","Internet"],["NFLX","Internet"],["EBAY","Internet"],["BKNG","Internet"],
  ["WMT","Retail"],["COST","Retail"],["TGT","Retail"],["HD","Retail"],["LOW","Retail"],["NKE","Consumer"],["SBUX","Consumer"],["MCD","Consumer"],
  ["CAT","Industrials"],["DE","Industrials"],["HON","Industrials"],["GE","Aerospace"],["BA","Aerospace"],["LMT","Aerospace"],["RTX","Aerospace"],["UPS","Industrials"],
  ["XOM","Energy"],["CVX","Energy"],["COP","Energy"],["SLB","Energy"],["OXY","Energy"],["EOG","Energy"],
  ["NEE","Utilities"],["DUK","Utilities"],["SO","Utilities"],["AEP","Utilities"],["EXC","Utilities"],
  ["T","Telecom"],["VZ","Telecom"],["TMUS","Telecom"],["CMCSA","Telecom"],
  ["JNJ","Healthcare"],["PFE","Healthcare"],["MRK","Healthcare"],["LLY","Healthcare"],["ABBV","Healthcare"],["UNH","Healthcare"],["CVS","Healthcare"],["GILD","Healthcare"],
  ["JPM","Financial Services"],["BAC","Financial Services"],["WFC","Financial Services"],["C","Financial Services"],["GS","Financial Services"],["MS","Financial Services"],["BLK","Financial Services"],["AXP","Financial Services"],
  ["PLD","REIT"],["AMT","REIT"],["EQIX","REIT"],["O","REIT"],["SPG","REIT"],["WELL","REIT"],
  ["TSLA","Automotive"],["F","Automotive"],["GM","Automotive"],["RIVN","Automotive"],["LCID","Automotive"],
  ["AAPL","Consumer Technology"],["IBM","Technology"],["CSCO","Technology"],["HPQ","Technology"],["DELL","Technology"],
  ["DIS","Media"],["PSKY","Media"],["WBD","Media"],["ROKU","Media"],
  ["DAL","Airlines"],["UAL","Airlines"],["AAL","Airlines"],["LUV","Airlines"],
  ["FCX","Materials"],["NUE","Materials"],["DOW","Materials"],["LIN","Materials"],
  ["PYPL","Financial Technology"],["XYZ","Financial Technology"],["COIN","Financial Technology"],["SOFI","Financial Technology"]
];

const concepts = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax","Revenues","SalesRevenueNet"],
  grossProfit: ["GrossProfit"],
  operatingIncome: ["OperatingIncomeLoss"],
  netIncome: ["NetIncomeLoss","ProfitLoss"],
  dilutedEps: ["EarningsPerShareDiluted"],
  cash: ["CashAndCashEquivalentsAtCarryingValue","CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  debtCurrent: ["LongTermDebtCurrent","ShortTermBorrowings"],
  debtNoncurrent: ["LongTermDebtNoncurrent","LongTermDebt"],
  dilutedShares: ["WeightedAverageNumberOfDilutedSharesOutstanding"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment"]
};

const tickerRows = await getJson("https://www.sec.gov/files/company_tickers.json");
const tickerMap = new Map(Object.values(tickerRows).map((row) => [row.ticker.toUpperCase(), row]));
const companies = [];
for (const [ticker, sector] of selections) {
  const row = tickerMap.get(ticker);
  if (!row) throw new Error(`SEC ticker unavailable: ${ticker}`);
  const cik = String(row.cik_str).padStart(10, "0");
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  const source = await getJson(url);
  const periods = collectPeriods(source.facts?.["us-gaap"] || {}).slice(0, 3);
  companies.push({
    caseId: `RW-${String(companies.length + 1).padStart(3, "0")}`,
    ticker, company: row.title, cik, sector,
    fiscalYearStructure: inferFiscalStructure(periods),
    profitabilityProfile: inferProfitability(periods),
    leverageProfile: inferLeverage(periods),
    valuationApplicability: sector === "Financial Services" ? ["P/E","P/B"] : sector === "REIT" ? ["AFFO","NAV"] : ["DCF","P/E","EV/EBITDA","EV/Sales","P/FCF"],
    specialComplexity: complexity(ticker, sector),
    selectedReportingPeriods: periods.map(({ fiscalYear, fiscalPeriod, end, form }) => ({ fiscalYear, fiscalPeriod, end, form })),
    cutoffDate: periods[0]?.filed || "UNAVAILABLE",
    source: { url, type: "SEC Company Facts", retrievalDate: new Date().toISOString().slice(0, 10), primary: true },
    truthRecords: periods
  });
  await new Promise((resolveDelay) => setTimeout(resolveDelay, 110));
}
await mkdir(resolve("tests/corpus/real-world"), { recursive: true });
await writeFile(output, JSON.stringify({ schemaVersion: "franklin-real-world-benchmark/v1", generatedAt: new Date().toISOString(), sourcePolicy: "SEC primary facts; unavailable stays unavailable", companies }, null, 2) + "\n");
console.log(`Preserved ${companies.length} SEC real-company records at ${output}`);

function collectPeriods(gaap) {
  const periodMap = new Map();
  for (const [field, tags] of Object.entries(concepts)) {
    const concept = tags.find((tag) => gaap[tag]?.units);
    if (!concept) continue;
    for (const [unit, facts] of Object.entries(gaap[concept].units)) {
      for (const fact of facts) {
        if (!["10-Q","10-K","10-Q/A","10-K/A"].includes(fact.form) || !fact.accn || !fact.end || !fact.filed) continue;
        const key = fact.accn;
        const period = periodMap.get(key) || { accession: fact.accn, form: fact.form, filed: fact.filed, fiscalYear: fact.fy || null, fiscalPeriod: fact.fp || null, candidates: {} };
        period.candidates[field] ||= [];
        period.candidates[field].push({ value: fact.val, unit, taxonomyConcept: concept, start: fact.start || null, end: fact.end, filed: fact.filed, frame: fact.frame || null, basis: "GAAP", classification: field === "operatingCashFlow" || field === "capex" ? "REPORTED_CASH_FLOW" : "COMPANY_REPORTED" });
        periodMap.set(key, period);
      }
    }
  }
  return [...periodMap.values()].map(finalizePeriod).filter(Boolean).sort((a, b) => b.filed.localeCompare(a.filed)).filter((period) => Object.keys(period.facts).length >= 4);
}
function finalizePeriod(period) {
  const all = Object.values(period.candidates).flat();
  const end = all.map((fact) => fact.end).filter((value) => value <= period.filed).sort().at(-1);
  if (!end) return null;
  const facts = {};
  for (const [field, candidates] of Object.entries(period.candidates)) {
    const matching = candidates.filter((fact) => fact.end === end);
    if (!matching.length) continue;
    const preferLongest = field === "operatingCashFlow" || field === "capex";
    matching.sort((left, right) => (preferLongest ? durationDays(right) - durationDays(left) : durationDays(left) - durationDays(right)) || Number(Boolean(right.frame)) - Number(Boolean(left.frame)));
    facts[field] = matching[0];
  }
  const starts = Object.values(facts).map((fact) => fact.start).filter(Boolean).sort();
  return { accession: period.accession, form: period.form, filed: period.filed, start: starts[0] || null, end, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, facts };
}
function durationDays(fact) {
  if (!fact.start) return 0;
  return Math.max(0, (Date.parse(`${fact.end}T00:00:00Z`) - Date.parse(`${fact.start}T00:00:00Z`)) / 86_400_000);
}
async function getJson(url) {
  const response = await fetch(url, { headers: { "user-agent": userAgent, accept: "application/json" } });
  if (!response.ok) throw new Error(`SEC request failed ${response.status}: ${url}`);
  return response.json();
}
function inferFiscalStructure(periods) { const month = periods[0]?.end?.slice(5, 7); return month ? `Latest reported period ends in month ${month}; SEC fiscal labels preserved` : "UNAVAILABLE"; }
function inferProfitability(periods) { const value = periods[0]?.facts?.netIncome?.value; return !Number.isFinite(value) ? "NOT VERIFIED" : value < 0 ? "Loss-making latest filing" : "Profitable latest filing"; }
function inferLeverage(periods) { const facts = periods[0]?.facts || {}; const debt = (facts.debtCurrent?.value || 0) + (facts.debtNoncurrent?.value || 0); const cash = facts.cash?.value; return !Number.isFinite(cash) ? "NOT VERIFIED" : debt > cash * 2 ? "Highly leveraged relative to cash" : cash > debt ? "Net cash on reported fields" : "Debt exceeds cash"; }
function complexity(ticker, sector) { if (["AMZN","MSFT","GOOGL","META","GE","WBD"].includes(ticker)) return "Segments/acquisitions"; if (["NVDA","AAPL","TSLA"].includes(ticker)) return "Split/dilution history"; if (sector === "Financial Services") return "Financial-institution accounting"; if (sector === "REIT") return "REIT-specific metrics"; if (["COST","WMT","TGT","NKE"].includes(ticker)) return "Non-calendar/52-53-week fiscal year"; return "Standard issuer with real disclosure variability"; }
