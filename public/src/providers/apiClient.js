import { createCompanyShell, starterUniverse } from "../data/sampleData.js";
import { buildUnifiedDataCompany } from "../dataPlatform/dataPlatform.js";
import { createProviderRegistry, enabledProviders, publicProviderMetadata } from "../dataPlatform/providerContracts.js";
import { SOURCES } from "../dataPlatform/fields.js";

export async function searchCompanies(query) {
  const clean = query.trim();
  const registry = createProviderRegistry();
  const provider = enabledProviders(registry).find((item) => typeof item.search === "function");
  if (!provider) return localSearch(clean);
  if (!clean) return [];
  return provider.search(clean);
}

export async function fetchResearchData(ticker, manualInputs = {}, previousCompany = null) {
  const registry = createProviderRegistry({}, manualInputs);
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

  const payload = await provider.loadCompany(ticker);
  return buildUnifiedDataCompany(payload.company, {
    manualInputs,
    previousCompany,
    source: payload.source,
    timestamp: payload.timestamp,
    provider: payload.provider,
    providers: publicProviderMetadata(registry)
  });
}

export async function parseInvestmentAnalystBlock({ text, methodology = null, language = "ar" }) {
  if (!String(text || "").trim()) {
    return { source: "Local Parser", parsedFields: [], explanations: [], unavailable: true };
  }
  const payload = {
    text,
    language,
    methodologyText: methodology?.combinedText || "",
    outputSchema: methodology?.outputSchema || null
  };
  try {
    const response = await fetch("./api/parse-investment-analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw await safeApiError(response, "Server AI parser unavailable");
    return await response.json();
  } catch (error) {
    return {
      source: "Server Parser",
      parsedFields: [],
      explanations: [error.userMessage || "AI parser is unavailable from the private server."],
      unavailable: true
    };
  }
}

function localSearch(query) {
  if (!query) return starterUniverse;
  const needle = query.toLowerCase();
  return starterUniverse.filter((item) => `${item.ticker} ${item.name}`.toLowerCase().includes(needle));
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

export async function safeApiError(response, fallback) {
  const data = await response.json().catch(() => ({}));
  const error = new Error(data?.error?.code || fallback);
  error.status = response.status;
  error.code = data?.error?.code || "API_ERROR";
  error.userMessage = data?.error?.message || fallback;
  return error;
}
