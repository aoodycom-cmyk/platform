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

function localSearch(query) {
  if (!query) return starterUniverse;
  const needle = query.toLowerCase();
  return starterUniverse.filter((item) => `${item.ticker} ${item.name}`.toLowerCase().includes(needle));
}

function normalizeApiKeys(apiKeys) {
  return typeof apiKeys === "string" ? { fmp: apiKeys } : apiKeys || {};
}
