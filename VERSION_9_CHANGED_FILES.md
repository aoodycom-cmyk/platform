# Version 9 Changed Files

Baseline used for Version 9 comparison: `3751331 Update app icon with Franklin finance mark`.

Untracked old file excluded from delivery: `equity-research-v2.zip`.

| Path | New Or Existing | Reason | Summary | Legacy Logic? |
| --- | --- | --- | --- | --- |
| `AI_ANALYST_CONTRACT.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `ARCHITECTURE.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `CHANGELOG.md` | EXISTING | Document Version 9 changes | Adds final delivery and engine-specific changelog sections | NO |
| `docs/ARCHITECTURE.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `docs/index.html` | EXISTING | Visible app title update | Updates browser title to AI Equity Research Platform V9.1 | NO |
| `docs/investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.json` | NEW | Add methodology contract | Defines canonical version, precedence, model support, and validation rules | NO |
| `docs/investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.md` | NEW | Add methodology contract | Defines canonical version, precedence, model support, and validation rules | NO |
| `docs/investment_analyst_brain_v1/11_OUTPUT_SCHEMA.json` | EXISTING | Update output schema | Aligns report JSON with canonical v1.1 required sections | NO |
| `docs/investment_analyst_brain_v1/12_MASTER_ANALYST_PROMPT.md` | EXISTING | Update AI prompt boundary | Clarifies AI can parse/explain but not calculate | NO |
| `docs/investment_analyst_brain_v1/README.md` | EXISTING | Document canonical methodology | Adds v1.1 contract guidance | NO |
| `docs/src/analystBrain/engine.js` | NEW | Build canonical deterministic Analyst Brain engine | Pipeline, classification, forecasts, model selection, valuation, recommendation, monitoring | NO |
| `docs/src/analystBrain/methodology.js` | EXISTING | Load canonical methodology files | Adds v1.1 version and contract files to methodology loader | NO |
| `docs/src/analystBrain/schemaValidator.js` | EXISTING | Strengthen JSON validation | Nested validation for schema, probabilities, weights, forecast rows, monitoring, recommendation | NO |
| `docs/src/i18n/language.js` | EXISTING | Localization update | Adds Version 9.1 and INSUFFICIENT_DATA labels | NO |
| `docs/src/ui/components.js` | EXISTING | Visible mobile version label | Updates UI eyebrow from Version 8 to Version 9.1 | PARTIAL - still renders legacy and canonical report shapes |
| `docs/src/valuationWorkflow/workflow.js` | EXISTING | Integrate canonical Analyst Brain path | One-paste workflow calls runAnalystBrainEngine directly; approval validates canonical output | YES - contains legacy V7/V8 workflow plus new canonical Analyst Brain call path |
| `index.html` | EXISTING | Visible app title update | Updates browser title to AI Equity Research Platform V9.1 | NO |
| `investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.json` | NEW | Add methodology contract | Defines canonical version, precedence, model support, and validation rules | NO |
| `investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.md` | NEW | Add methodology contract | Defines canonical version, precedence, model support, and validation rules | NO |
| `investment_analyst_brain_v1/11_OUTPUT_SCHEMA.json` | EXISTING | Update output schema | Aligns report JSON with canonical v1.1 required sections | NO |
| `investment_analyst_brain_v1/12_MASTER_ANALYST_PROMPT.md` | EXISTING | Update AI prompt boundary | Clarifies AI can parse/explain but not calculate | NO |
| `investment_analyst_brain_v1/README.md` | EXISTING | Document canonical methodology | Adds v1.1 contract guidance | NO |
| `METHODOLOGY_VERSION_CONTRACT.md` | NEW | Methodology contract report | Documents source of truth and conflict precedence | NO |
| `package.json` | EXISTING | Version metadata | Bumps package version to 9.0.0 | NO |
| `PROJECT_REVIEW.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `public/index.html` | EXISTING | Visible app title update | Updates browser title to AI Equity Research Platform V9.1 | NO |
| `public/investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.json` | NEW | Add methodology contract | Defines canonical version, precedence, model support, and validation rules | NO |
| `public/investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.md` | NEW | Add methodology contract | Defines canonical version, precedence, model support, and validation rules | NO |
| `public/investment_analyst_brain_v1/11_OUTPUT_SCHEMA.json` | EXISTING | Update output schema | Aligns report JSON with canonical v1.1 required sections | NO |
| `public/investment_analyst_brain_v1/12_MASTER_ANALYST_PROMPT.md` | EXISTING | Update AI prompt boundary | Clarifies AI can parse/explain but not calculate | NO |
| `public/investment_analyst_brain_v1/README.md` | EXISTING | Document canonical methodology | Adds v1.1 contract guidance | NO |
| `public/src/analystBrain/engine.js` | NEW | Build canonical deterministic Analyst Brain engine | Pipeline, classification, forecasts, model selection, valuation, recommendation, monitoring | NO |
| `public/src/analystBrain/methodology.js` | EXISTING | Load canonical methodology files | Adds v1.1 version and contract files to methodology loader | NO |
| `public/src/analystBrain/schemaValidator.js` | EXISTING | Strengthen JSON validation | Nested validation for schema, probabilities, weights, forecast rows, monitoring, recommendation | NO |
| `public/src/i18n/language.js` | EXISTING | Localization update | Adds Version 9.1 and INSUFFICIENT_DATA labels | NO |
| `public/src/ui/components.js` | EXISTING | Visible mobile version label | Updates UI eyebrow from Version 8 to Version 9.1 | PARTIAL - still renders legacy and canonical report shapes |
| `public/src/valuationWorkflow/workflow.js` | EXISTING | Integrate canonical Analyst Brain path | One-paste workflow calls runAnalystBrainEngine directly; approval validates canonical output | YES - contains legacy V7/V8 workflow plus new canonical Analyst Brain call path |
| `README.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `src/analystBrain/engine.js` | NEW | Build canonical deterministic Analyst Brain engine | Pipeline, classification, forecasts, model selection, valuation, recommendation, monitoring | NO |
| `src/analystBrain/methodology.js` | EXISTING | Load canonical methodology files | Adds v1.1 version and contract files to methodology loader | NO |
| `src/analystBrain/schemaValidator.js` | EXISTING | Strengthen JSON validation | Nested validation for schema, probabilities, weights, forecast rows, monitoring, recommendation | NO |
| `src/i18n/language.js` | EXISTING | Localization update | Adds Version 9.1 and INSUFFICIENT_DATA labels | NO |
| `src/ui/components.js` | EXISTING | Visible mobile version label | Updates UI eyebrow from Version 8 to Version 9.1 | PARTIAL - still renders legacy and canonical report shapes |
| `src/valuationWorkflow/workflow.js` | EXISTING | Integrate canonical Analyst Brain path | One-paste workflow calls runAnalystBrainEngine directly; approval validates canonical output | YES - contains legacy V7/V8 workflow plus new canonical Analyst Brain call path |
| `SUPPORTED_VALUATION_MODELS.md` | NEW | Supported models report | Documents every selectable model, requirements, formulas, rejection rules, code, and tests | NO |
| `tests/investmentAnalystBrain.test.mjs` | EXISTING | Add canonical test coverage | Covers classifications, model support, weights, external caps, and negative validation | NO |
| `TODO.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `VALUATION_CALCULATION_AUDIT.md` | NEW | Calculation audit report | Step-by-step DCF, multiples, financial institution, REIT, and probability-weighted FV examples | NO |
| `VALUATION_WORKFLOW.md` | EXISTING | Documentation update | Documents Version 9 architecture, rules, workflow, limitations, and next work | NO |
| `VERSION_9_CHANGED_FILES.md` | NEW | Version 9 support update | Updated to support final V9 delivery | NO |
| `version_9_evidence/sample-reports/01_profitable_high_growth/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/01_profitable_high_growth/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/01_profitable_high_growth/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/02_unprofitable_transition/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/02_unprofitable_transition/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/02_unprofitable_transition/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/03_cyclical_company/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/03_cyclical_company/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/03_cyclical_company/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/04_capital_intensive/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/04_capital_intensive/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/04_capital_intensive/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/05_financial_institution/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/05_financial_institution/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/05_financial_institution/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/06_reit/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/06_reit/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/06_reit/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/07_holding_company/input.txt` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/07_holding_company/readable-report.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/07_holding_company/report.json` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/sample-reports/INDEX.md` | NEW | Sample report evidence | Generated inputs, readable report, and final JSON for required company cases | NO |
| `version_9_evidence/screenshots/mobile/01-paste-input.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/02-data-review.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/03-decision-summary.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/04-bear-base-bull-cards.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/05-assumptions.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/06-valuation-models.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/07-monitoring.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/mobile/08-export.png` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/screenshots/README.md` | NEW | Mobile UI evidence | 390x844 screenshot proof for requested screens | NO |
| `version_9_evidence/test-results/assertion-counts.txt` | NEW | Test evidence | Stores actual test command, terminal output, and assertion counts | NO |
| `version_9_evidence/test-results/terminal-output.txt` | NEW | Test evidence | Stores actual test command, terminal output, and assertion counts | NO |
| `VERSION_9_IMPLEMENTATION_REPORT.md` | NEW | Final delivery report | Summarizes completed, partial, not implemented, assumptions, limits, legacy dependencies | NO |
| `VERSION_9_TEST_RESULTS.md` | NEW | Test evidence | Stores actual test command, terminal output, and assertion counts | NO |
