export const ANALYST_BRAIN_VERSION = "Investment Analyst Brain v1.0";

export const ANALYST_BRAIN_FILES = [
  "README.md",
  "01_COMPANY_CLASSIFICATION.md",
  "02_BUSINESS_QUALITY.md",
  "03_VALUATION_MODEL_SELECTION.md",
  "04_FORECAST_POLICY.md",
  "05_WACC_POLICY.md",
  "06_SCENARIO_POLICY.md",
  "07_FAIR_VALUE_POLICY.md",
  "08_RECOMMENDATION_POLICY.md",
  "09_MONITORING_POLICY.md",
  "10_REPORT_TEMPLATE.md",
  "11_OUTPUT_SCHEMA.json",
  "12_MASTER_ANALYST_PROMPT.md"
];

const METHODOLOGY_BASES = [
  "./investment_analyst_brain_v1/",
  "./investment-analyst-brain-v1/",
  "./docs/investment_analyst_brain_v1/",
  "./docs/investment-analyst-brain-v1/"
];

let cachedMethodology = null;

export async function loadAnalystBrainMethodology(fetcher = globalThis.fetch) {
  if (cachedMethodology) return cachedMethodology;
  if (typeof fetcher !== "function") {
    return { version: ANALYST_BRAIN_VERSION, files: [], combinedText: "", outputSchema: null };
  }

  for (const base of METHODOLOGY_BASES) {
    const loaded = await tryLoadBase(base, fetcher);
    if (loaded) {
      cachedMethodology = loaded;
      return loaded;
    }
  }

  return { version: ANALYST_BRAIN_VERSION, files: [], combinedText: "", outputSchema: null };
}

async function tryLoadBase(base, fetcher) {
  try {
    const files = [];
    for (const name of ANALYST_BRAIN_FILES) {
      const response = await fetcher(`${base}${name}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Missing methodology file: ${name}`);
      files.push({ name, content: await response.text() });
    }
    return {
      version: ANALYST_BRAIN_VERSION,
      base,
      files,
      combinedText: files.map((file) => `--- ${file.name} ---\n${file.content}`).join("\n\n"),
      outputSchema: parseSchema(files)
    };
  } catch {
    return null;
  }
}

function parseSchema(files) {
  const schemaFile = files.find((file) => file.name === "11_OUTPUT_SCHEMA.json");
  if (!schemaFile) return null;
  try {
    return JSON.parse(schemaFile.content);
  } catch {
    return null;
  }
}
