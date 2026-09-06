import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve("tests/corpus/real-world/source-packages.json");
const corpus = JSON.parse(await readFile(inputPath, "utf8"));
const retrievalDate = new Date().toISOString().slice(0, 10);
const queue = [...corpus.companies];
const failures = [];

await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const company = queue.shift();
    try {
      const cutoffs = company.periods.map((period) => period.cutoffDate).sort();
      const from = shiftYear(cutoffs[0], -1);
      const to = cutoffs.at(-1);
      const sourceUrl = `https://api.nasdaq.com/api/quote/${encodeURIComponent(company.ticker)}/historical?assetclass=stocks&fromdate=${from}&todate=${to}&limit=5000`;
      const payload = await getJson(sourceUrl);
      const rows = payload.data?.tradesTable?.rows || [];
      for (const period of company.periods) {
        const row = rows.map(normalizeRow).filter(Boolean).find((item) => item.date <= period.cutoffDate);
        if (!row) throw new Error(`No price at or before ${period.cutoffDate}`);
        period.historicalMarketPrice = {
          status: "VERIFIED",
          ticker: company.ticker,
          price: row.close,
          currency: "USD",
          asOf: row.date,
          timestamp: `${row.date}T16:00:00-04:00`,
          priceType: "LAST_CLOSE",
          source: "Nasdaq Historical",
          sourceId: `NASDAQ-${company.ticker}-${row.date}`,
          sourceUrl,
          retrievalDate
        };
      }
    } catch (error) {
      failures.push({ ticker: company.ticker, error: error.message });
    }
  }
}));

corpus.marketPriceAcquisition = {
  provider: "Nasdaq Historical",
  retrievalDate,
  completeCompanies: corpus.companies.length - failures.length,
  failures
};
await writeFile(inputPath, `${JSON.stringify(corpus, null, 2)}\n`);
console.log(JSON.stringify(corpus.marketPriceAcquisition, null, 2));
if (failures.length) process.exitCode = 2;

function normalizeRow(row) {
  const [month, day, year] = String(row.date || "").split("/");
  const close = Number(String(row.close || "").replaceAll("$", "").replaceAll(",", ""));
  if (!year || !Number.isFinite(close) || close <= 0) return null;
  return { date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, close };
}

function shiftYear(date, delta) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCFullYear(value.getUTCFullYear() + delta);
  return value.toISOString().slice(0, 10);
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      accept: "application/json, text/plain, */*",
      referer: "https://www.nasdaq.com/market-activity/stocks/"
    }
  });
  if (!response.ok) throw new Error(`Nasdaq request failed ${response.status}`);
  return response.json();
}
