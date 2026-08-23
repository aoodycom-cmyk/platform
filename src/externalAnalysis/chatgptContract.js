// Canonical public entrypoint for Franklin ↔ ChatGPT contracts.
// INITIAL and EARNINGS_REVALUATION use compact machine-readable request envelopes.
// Legacy helper exports remain available for compatibility only.

export * from "./chatgptContractLegacy.js";
export {
  buildExternalAnalysisJsonTemplate
} from "./chatgptContractLegacy.js";
export {
  buildInitialAnalysisPrompt as buildFullAnalysisPrompt,
  FRANKLIN_INITIAL_PROMPT_VERSION
} from "./initialAnalysisPrompt.js";
export {
  buildEarningsRevaluationPrompt as buildNewEarningsAnalysisPrompt,
  FRANKLIN_EARNINGS_PROMPT_VERSION
} from "./earningsRevaluationPolicyV2.js";
