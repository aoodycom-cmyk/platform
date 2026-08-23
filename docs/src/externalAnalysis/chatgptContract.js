// Canonical public entrypoint for Franklin ↔ ChatGPT contracts.
// INITIAL analysis now uses a compact machine-readable request envelope.
// Earnings/revaluation helpers remain preserved until their own migration step.

export * from "./chatgptContractLegacy.js";
export {
  buildExternalAnalysisJsonTemplate,
  buildNewEarningsAnalysisPrompt
} from "./chatgptContractLegacy.js";
export {
  buildInitialAnalysisPrompt as buildFullAnalysisPrompt,
  FRANKLIN_INITIAL_PROMPT_VERSION
} from "./initialAnalysisPrompt.js";
