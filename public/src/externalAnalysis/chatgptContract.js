// Canonical public entrypoint for Franklin ↔ ChatGPT contracts.
// The INITIAL analysis prompt is intentionally compact and machine-readable.
// Earnings/revaluation and legacy helpers remain preserved in the legacy module
// until they are migrated in their own tested step.

export * from "./chatgptContractLegacy.js";
export {
  buildInitialAnalysisPrompt as buildFullAnalysisPrompt,
  FRANKLIN_INITIAL_PROMPT_VERSION
} from "./initialAnalysisPrompt.js";
