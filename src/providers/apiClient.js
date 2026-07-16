import { createCompanyShell, starterUniverse } from "../data/sampleData.js";
import { buildUnifiedDataCompany } from "../dataPlatform/dataPlatform.js";
import { createProviderRegistry, enabledProviders, publicProviderMetadata } from "../dataPlatform/providerContracts.js";
import { SOURCES } from "../dataPlatform/fields.js";

export async function searchCompanies(query, apiKeys = {}) {
  const clean = query.trim();
  const keys = normalizeApiKeys(apiKeys);
  const registry = createProviderRegistry(keys);
  const provider = enabledProviders(registry).find((item) => typeof item.search === "function");
  if (!provider) return localSearch(clean);
  if (!clean) return [];
  try {
    return await provider.search(clean);
  } catch {
    return localSearch(clean);
  }
}

export async function fetchResearchData(ticker, apiKeys = {}, manualInputs = {}, previousCompany = null) {
  const keys = normalizeApiKeys(apiKeys);
  const registry = createProviderRegistry(keys, manualInputs);
  const providers = enabledProviders(registry);
  const provider = providers.find((item) => typeof item.loadCompany === "function");

  if (!provider) {
    return buildUnifiedDataCompany(createCompanyShell(ticker), {
      manualInputs,
      previousCompany,
      source: SOURCES.MISSING,
      providers: publicProviderMetadata(registry)
    });
  }

  try {
    const payload = await provider.loadCompany(ticker);
    return buildUnifiedDataCompany(payload.company, {
      manualInputs,
      previousCompany,
      source: payload.source,
      timestamp: payload.timestamp,
      provider: payload.provider,
      providers: publicProviderMetadata(registry)
    });
  } catch {
    return buildUnifiedDataCompany(createCompanyShell(ticker), {
      manualInputs,
      previousCompany,
      source: SOURCES.MISSING,
      providers: publicProviderMetadata(registry)
    });
  }
}

export async function parseInvestmentAnalystBlock({ text, apiKeys = {}, methodology = null, language = "ar" }) {
  const keys = normalizeApiKeys(apiKeys);
  if (!String(text || "").trim() || !keys.openai) {
    return { source: "Local Parser", parsedFields: [], explanations: [], unavailable: true };
  }
  const payload = {
    text,
    language,
    apiKey: keys.openai,
    methodologyText: methodology?.combinedText || "",
    outputSchema: methodology?.outputSchema || null
  };
  try {
    const response = await fetch("./api/parse-investment-analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error("Server AI parser unavailable");
    return await response.json();
  } catch {
    return parseWithOpenAiDirect(payload).catch(() => ({
      source: "Local Parser",
      parsedFields: [],
      explanations: [],
      unavailable: true
    }));
  }
}

function localSearch(query) {
  if (!query) return starterUniverse;
  const needle = query.toLowerCase();
  return starterUniverse.filter((item) => `${item.ticker} ${item.name}`.toLowerCase().includes(needle));
}

function normalizeApiKeys(apiKeys) {
  return typeof apiKeys === "string" ? { fmp: apiKeys } : apiKeys || {};
}

async function parseWithOpenAiDirect(payload) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${payload.apiKey}`
    },
    body: JSON.stringify(openAiParserRequest(payload))
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || "OpenAI parser failed");
  return normalizeOpenAiParserResponse(data);
}

export function openAiParserRequest({ text, language, methodologyText, outputSchema }) {
  return {
    model: "gpt-4.1-mini",
    input: [
      {
        role: "system",
        content: [
          "You parse unstructured equity research data for a deterministic valuation engine.",
          "Use the supplied methodology as policy context, but do not calculate final fair value, recommendation, or investment score.",
          "Never invent missing financial values. Preserve standard financial terms in English.",
          "Return JSON only."
        ].join("\n")
      },
      {
        role: "user",
        content: JSON.stringify({
          language,
          task: "Extract company data fields from the pasted block. Return parsedFields only for values explicitly present or clearly stated.",
          methodologyText,
          outputSchema,
          expectedJsonShape: {
            source: "OpenAI",
            parsedFields: [
              {
                fieldId: "ticker",
                value: "AAPL",
                source: "User Paste",
                sourceDate: "YYYY-MM-DD or blank",
                confidence: 0.9,
                originalTextReference: "short supporting excerpt"
              }
            ],
            explanations: ["short Arabic notes about parsing limitations"]
          },
          pastedBlock: text
        })
      }
    ],
    text: { format: { type: "json_object" } }
  };
}

function normalizeOpenAiParserResponse(data) {
  const raw = data.output_text
    || data.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n")
    || "";
  const parsed = JSON.parse(raw || "{}");
  return {
    source: parsed.source || "OpenAI",
    parsedFields: Array.isArray(parsed.parsedFields) ? parsed.parsedFields : [],
    explanations: Array.isArray(parsed.explanations) ? parsed.explanations : []
  };
}
