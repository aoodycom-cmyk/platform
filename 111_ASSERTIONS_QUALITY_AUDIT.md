# 111 Assertions Quality Audit

Total assertion statements reviewed: **111**.

## Category Mix

| Category | Count | Percentage |
| --- | --- | --- |
| INTEGRATION CHECK | 2 | 1.8% |
| SHAPE CHECK | 19 | 17.1% |
| NUMERICAL CHECK | 35 | 31.5% |
| NEGATIVE CHECK | 21 | 18.9% |
| BUSINESS RULE CHECK | 19 | 17.1% |
| UI/EXPORT CHECK | 15 | 13.5% |

## Assertion Register

| # | File:Line | Category | Assertion |
| --- | --- | --- | --- |
| 1 | tests/version6.test.mjs:50 | INTEGRATION CHECK | assert.deepEqual( |
| 2 | tests/version6.test.mjs:66 | SHAPE CHECK | assert.equal(missingScore.rankingComponents.upsideComposite, null, "missing upside must stay missing"); |
| 3 | tests/version6.test.mjs:67 | SHAPE CHECK | assert.ok( |
| 4 | tests/version6.test.mjs:76 | SHAPE CHECK | assert.equal(ranked[0].ticker, "ACT", "actionable companies rank before insufficient data"); |
| 5 | tests/version6.test.mjs:77 | NUMERICAL CHECK | assert.equal(ranked[0].rankingPosition, 1, "rank position is recalculated from the visible set"); |
| 6 | tests/version6.test.mjs:79 | NUMERICAL CHECK | assert.equal(ranking.normalizeUpside(1.75), 100, "extreme upside is capped"); |
| 7 | tests/version6.test.mjs:80 | NUMERICAL CHECK | assert.equal(colors.upsideColorCategory(0.25), "strong-positive"); |
| 8 | tests/version6.test.mjs:81 | NUMERICAL CHECK | assert.equal(colors.upsideColorCategory(0.1), "positive"); |
| 9 | tests/version6.test.mjs:82 | NUMERICAL CHECK | assert.equal(colors.upsideColorCategory(0.0999), "neutral"); |
| 10 | tests/version6.test.mjs:83 | NUMERICAL CHECK | assert.equal(colors.upsideColorCategory(-0.0001), "warning"); |
| 11 | tests/version6.test.mjs:84 | NUMERICAL CHECK | assert.equal(colors.upsideColorCategory(-0.15), "negative"); |
| 12 | tests/version6.test.mjs:85 | NUMERICAL CHECK | assert.equal(colors.fairValueColorCategory(102, 100), "neutral"); |
| 13 | tests/version6.test.mjs:86 | NUMERICAL CHECK | assert.equal(colors.fairValueColorCategory(102.1, 100), "positive"); |
| 14 | tests/version6.test.mjs:87 | NUMERICAL CHECK | assert.equal(colors.fairValueColorCategory(97.9, 100), "negative"); |
| 15 | tests/version6.test.mjs:89 | NUMERICAL CHECK | assert.equal(colors.recommendationColorCategory("BUY", "ACTIONABLE"), "positive"); |
| 16 | tests/version6.test.mjs:90 | NUMERICAL CHECK | assert.equal(colors.recommendationColorCategory("HOLD", "ACTIONABLE"), "amber"); |
| 17 | tests/version6.test.mjs:91 | NUMERICAL CHECK | assert.equal(colors.recommendationColorCategory("SELL", "ACTIONABLE"), "negative"); |
| 18 | tests/version6.test.mjs:92 | NEGATIVE CHECK | assert.equal(colors.recommendationColorCategory("BUY", "INSUFFICIENT_DATA"), "missing"); |
| 19 | tests/version6.test.mjs:94 | NUMERICAL CHECK | assert.equal(colors.riskColorCategory(80), "positive", "higher Risk Score means lower risk"); |
| 20 | tests/version6.test.mjs:95 | NUMERICAL CHECK | assert.equal(colors.riskColorCategory(60), "amber"); |
| 21 | tests/version6.test.mjs:96 | NUMERICAL CHECK | assert.equal(colors.riskColorCategory(30), "negative"); |
| 22 | tests/version6.test.mjs:97 | NUMERICAL CHECK | assert.equal(colors.scoreColorCategory(85), "strong-positive"); |
| 23 | tests/version6.test.mjs:98 | NUMERICAL CHECK | assert.equal(colors.scoreColorCategory(70), "positive"); |
| 24 | tests/version6.test.mjs:99 | NUMERICAL CHECK | assert.equal(colors.scoreColorCategory(55), "amber"); |
| 25 | tests/version6.test.mjs:100 | NUMERICAL CHECK | assert.equal(colors.scoreColorCategory(40), "warning"); |
| 26 | tests/version6.test.mjs:101 | NUMERICAL CHECK | assert.equal(colors.scoreColorCategory(39), "negative"); |
| 27 | tests/version6.test.mjs:103 | NUMERICAL CHECK | assert.equal(colors.formatSignedPercent(0.2376), "+24%"); |
| 28 | tests/version6.test.mjs:104 | NUMERICAL CHECK | assert.equal(colors.formatSignedPercent(-0.18), "-18%"); |
| 29 | tests/version6.test.mjs:107 | SHAPE CHECK | assert.equal(language.uiLabel("Rank"), "الترتيب"); |
| 30 | tests/version6.test.mjs:108 | BUSINESS RULE CHECK | assert.equal(language.uiLabel("Recommendation"), "التوصية"); |
| 31 | tests/version6.test.mjs:109 | SHAPE CHECK | assert.ok(language.financialTerm("ROIC").startsWith("ROIC"), "financial terms keep the English standard"); |
| 32 | tests/version6.test.mjs:111 | SHAPE CHECK | assert.equal(language.uiLabel("Rank"), "Rank"); |
| 33 | tests/version6.test.mjs:112 | SHAPE CHECK | assert.equal(language.financialTerm("ROIC"), "ROIC"); |
| 34 | tests/version6.test.mjs:118 | NUMERICAL CHECK | assert.equal(updated.length, 1, "evaluated companies must not duplicate tickers"); |
| 35 | tests/version6.test.mjs:119 | SHAPE CHECK | assert.equal(updated[0].currentPrice, 12, "latest evaluation replaces the current row"); |
| 36 | tests/version7.test.mjs:51 | SHAPE CHECK | assert.equal(draft.status, "Draft"); |
| 37 | tests/version7.test.mjs:52 | NEGATIVE CHECK | assert.equal(canRunValuation(draft), false); |
| 38 | tests/version7.test.mjs:53 | SHAPE CHECK | assert.equal(draft.report, null); |
| 39 | tests/version7.test.mjs:60 | NUMERICAL CHECK | assert.ok(workspace.pastePreview.candidates.some((item) => item.fieldId === "revenue")); |
| 40 | tests/version7.test.mjs:62 | NUMERICAL CHECK | assert.equal(workspace.inputs.revenue.value, 1_200_000_000); |
| 41 | tests/version7.test.mjs:63 | SHAPE CHECK | assert.equal(workspace.inputs.revenue.mode, "Automatic"); |
| 42 | tests/version7.test.mjs:68 | BUSINESS RULE CHECK | assert.equal(canRunValuation(workspace), true); |
| 43 | tests/version7.test.mjs:71 | SHAPE CHECK | assert.equal(first.error, undefined); |
| 44 | tests/version7.test.mjs:72 | INTEGRATION CHECK | assert.deepEqual(first.report.executiveConclusion, second.report.executiveConclusion); |
| 45 | tests/version7.test.mjs:73 | NUMERICAL CHECK | assert.ok(first.report.assumptionRationale.wacc.value > 0); |
| 46 | tests/version7.test.mjs:74 | BUSINESS RULE CHECK | assert.ok(first.report.valuationModels.some((model) => model.method === "DCF")); |
| 47 | tests/version7.test.mjs:76 | BUSINESS RULE CHECK | assert.equal(probabilityTotal, 1); |
| 48 | tests/version7.test.mjs:86 | SHAPE CHECK | assert.notEqual(base.executiveConclusion.baseFairValue, overridden.executiveConclusion.baseFairValue); |
| 49 | tests/version7.test.mjs:87 | NUMERICAL CHECK | assert.equal(overridden.assumptionRationale.wacc.value, 0.12); |
| 50 | tests/version7.test.mjs:94 | UI/EXPORT CHECK | assert.equal(approved.error, undefined); |
| 51 | tests/version7.test.mjs:95 | UI/EXPORT CHECK | assert.equal(approved.evaluatedCompany.ticker, "TST"); |
| 52 | tests/version7.test.mjs:96 | UI/EXPORT CHECK | assert.ok(approved.evaluatedCompany.valuationVersion.startsWith("VAL-TST-")); |
| 53 | tests/version7.test.mjs:97 | UI/EXPORT CHECK | assert.equal(approved.evaluatedCompany.approvedReport.finalInvestmentDecision.decision, generated.report.finalInvestmentDecision.decision); |
| 54 | tests/version7.test.mjs:108 | NEGATIVE CHECK | assert.equal(invalid.valid, false); |
| 55 | tests/version7.test.mjs:109 | NEGATIVE CHECK | assert.ok(invalid.errors.some((error) => error.includes("Scenario probabilities"))); |
| 56 | tests/version8.test.mjs:11 | UI/EXPORT CHECK | assert.ok(components.includes("function investmentReportExperience")); |
| 57 | tests/version8.test.mjs:12 | UI/EXPORT CHECK | assert.ok(components.includes("quick-summary-card")); |
| 58 | tests/version8.test.mjs:13 | UI/EXPORT CHECK | assert.ok(components.includes("report-detail")); |
| 59 | tests/version8.test.mjs:14 | UI/EXPORT CHECK | assert.ok(components.includes("collapsibleReportDetails")); |
| 60 | tests/version8.test.mjs:15 | UI/EXPORT CHECK | assert.ok(components.includes("Executive Summary")); |
| 61 | tests/version8.test.mjs:16 | UI/EXPORT CHECK | assert.ok(components.includes("What Could Change This Decision")); |
| 62 | tests/version8.test.mjs:45 | SHAPE CHECK | assert.equal(result.error, undefined); |
| 63 | tests/version8.test.mjs:46 | SHAPE CHECK | assert.ok(result.report.executiveConclusion.recommendation); |
| 64 | tests/version8.test.mjs:47 | UI/EXPORT CHECK | assert.ok(Number.isFinite(result.report.executiveConclusion.investmentScore)); |
| 65 | tests/investmentAnalystBrain.test.mjs:19 | SHAPE CHECK | assert.equal(generated.error, undefined, `${ticker} should generate without error`); |
| 66 | tests/investmentAnalystBrain.test.mjs:20 | BUSINESS RULE CHECK | assert.equal(generated.report.methodologyVersion, CANONICAL_METHODOLOGY_VERSION); |
| 67 | tests/investmentAnalystBrain.test.mjs:21 | NEGATIVE CHECK | assert.equal(generated.report.dashboardExport.exported, false); |
| 68 | tests/investmentAnalystBrain.test.mjs:22 | SHAPE CHECK | assert.ok(validateAnalystBrainOutput(generated.report).valid, `${ticker} report should validate`); |
| 69 | tests/investmentAnalystBrain.test.mjs:32 | BUSINESS RULE CHECK | assert.ok(SUPPORTED_MODELS.includes(method), `${method} must be supported`); |
| 70 | tests/investmentAnalystBrain.test.mjs:33 | NEGATIVE CHECK | assert.ok(!UNSUPPORTED_MODELS.includes(method), `${method} must not be selected`); |
| 71 | tests/investmentAnalystBrain.test.mjs:42 | BUSINESS RULE CHECK | assert.ok(models.every((model) => model.weight <= 0.450001), "No selected model may exceed 45% weight"); |
| 72 | tests/investmentAnalystBrain.test.mjs:43 | BUSINESS RULE CHECK | assert.ok(externalWeight <= 0.250001, "External references may not exceed 25% combined weight"); |
| 73 | tests/investmentAnalystBrain.test.mjs:47 | NUMERICAL CHECK | assert.equal(report.forecastAssumptions.yearlyForecast.length, 5); |
| 74 | tests/investmentAnalystBrain.test.mjs:49 | SHAPE CHECK | assert.equal(typeof row.source, "string"); |
| 75 | tests/investmentAnalystBrain.test.mjs:50 | NUMERICAL CHECK | assert.ok(Number.isFinite(row.confidence)); |
| 76 | tests/investmentAnalystBrain.test.mjs:51 | NUMERICAL CHECK | assert.ok(Number.isFinite(row.revenueGrowth)); |
| 77 | tests/investmentAnalystBrain.test.mjs:52 | NUMERICAL CHECK | assert.ok(Number.isFinite(row.operatingMargin)); |
| 78 | tests/investmentAnalystBrain.test.mjs:53 | NUMERICAL CHECK | assert.ok(Number.isFinite(row.freeCashFlow)); |
| 79 | tests/investmentAnalystBrain.test.mjs:81 | BUSINESS RULE CHECK | assert.equal(profitable.report.classification.classification, "High Growth — Profitable"); |
| 80 | tests/investmentAnalystBrain.test.mjs:82 | BUSINESS RULE CHECK | assert.ok(selectedMethods(profitable.report).includes("DCF")); |
| 81 | tests/investmentAnalystBrain.test.mjs:83 | BUSINESS RULE CHECK | assert.ok(selectedMethods(profitable.report).includes("P/E")); |
| 82 | tests/investmentAnalystBrain.test.mjs:84 | BUSINESS RULE CHECK | assert.ok(selectedMethods(profitable.report).includes("PEG")); |
| 83 | tests/investmentAnalystBrain.test.mjs:86 | NUMERICAL CHECK | assert.equal(profitable.report.modelSelection.unsupportedModels.length, 0); |
| 84 | tests/investmentAnalystBrain.test.mjs:87 | NEGATIVE CHECK | assert.ok(!JSON.stringify(profitable.report.companyClassification.excludedModels).includes("P/B")); |
| 85 | tests/investmentAnalystBrain.test.mjs:90 | SHAPE CHECK | assert.equal(profitable.report.scenarios.Exceptional.fairValue, null); |
| 86 | tests/investmentAnalystBrain.test.mjs:91 | NUMERICAL CHECK | assert.ok(profitable.report.modelSelection.selectedModels.some((model) => String(model.source).includes("Methodology default"))); |
| 87 | tests/investmentAnalystBrain.test.mjs:94 | UI/EXPORT CHECK | assert.equal(approved.error, undefined); |
| 88 | tests/investmentAnalystBrain.test.mjs:95 | UI/EXPORT CHECK | assert.equal(approved.workspace.report.dashboardExport.exported, true); |
| 89 | tests/investmentAnalystBrain.test.mjs:96 | UI/EXPORT CHECK | assert.equal(approved.evaluatedCompany.approvedReport.dashboardExport.exported, true); |
| 90 | tests/investmentAnalystBrain.test.mjs:97 | UI/EXPORT CHECK | assert.equal(approved.evaluatedCompany.approvedReport.finalInvestmentDecision.decision, profitable.report.finalDecision.decision); |
| 91 | tests/investmentAnalystBrain.test.mjs:117 | BUSINESS RULE CHECK | assert.equal(transition.report.classification.classification, "High Growth — Transition to Profitability"); |
| 92 | tests/investmentAnalystBrain.test.mjs:118 | BUSINESS RULE CHECK | assert.deepEqual(selectedMethods(transition.report).sort(), ["EV/Sales", "Forward EV/Sales"].sort()); |
| 93 | tests/investmentAnalystBrain.test.mjs:137 | BUSINESS RULE CHECK | assert.equal(cyclical.report.classification.classification, "Cyclical"); |
| 94 | tests/investmentAnalystBrain.test.mjs:138 | BUSINESS RULE CHECK | assert.ok(selectedMethods(cyclical.report).includes("EV/EBITDA")); |
| 95 | tests/investmentAnalystBrain.test.mjs:156 | BUSINESS RULE CHECK | assert.equal(financial.report.classification.classification, "Financial Institution"); |
| 96 | tests/investmentAnalystBrain.test.mjs:157 | NEGATIVE CHECK | assert.ok(!selectedMethods(financial.report).includes("DCF")); |
| 97 | tests/investmentAnalystBrain.test.mjs:158 | NEGATIVE CHECK | assert.ok(!selectedMethods(financial.report).includes("P/B")); |
| 98 | tests/investmentAnalystBrain.test.mjs:175 | BUSINESS RULE CHECK | assert.equal(reit.report.classification.classification, "REIT"); |
| 99 | tests/investmentAnalystBrain.test.mjs:176 | NEGATIVE CHECK | assert.ok(!selectedMethods(reit.report).includes("AFFO")); |
| 100 | tests/investmentAnalystBrain.test.mjs:177 | NEGATIVE CHECK | assert.ok(!selectedMethods(reit.report).includes("NAV")); |
| 101 | tests/investmentAnalystBrain.test.mjs:178 | NEGATIVE CHECK | assert.ok(!selectedMethods(reit.report).includes("DCF")); |
| 102 | tests/investmentAnalystBrain.test.mjs:195 | BUSINESS RULE CHECK | assert.equal(holding.report.classification.classification, "Holding Company"); |
| 103 | tests/investmentAnalystBrain.test.mjs:196 | NEGATIVE CHECK | assert.ok(!selectedMethods(holding.report).includes("Sum of the Parts")); |
| 104 | tests/investmentAnalystBrain.test.mjs:197 | NEGATIVE CHECK | assert.ok(!selectedMethods(holding.report).includes("DCF")); |
| 105 | tests/investmentAnalystBrain.test.mjs:208 | NEGATIVE CHECK | assert.equal(externalOnly.report.finalDecision.decision, "INSUFFICIENT_DATA"); |
| 106 | tests/investmentAnalystBrain.test.mjs:209 | NEGATIVE CHECK | assert.equal(externalOnly.report.finalDecision.policyGates.hasInternalValuation, false); |
| 107 | tests/investmentAnalystBrain.test.mjs:214 | NEGATIVE CHECK | assert.equal(validateAnalystBrainOutput(badWeight).valid, false); |
| 108 | tests/investmentAnalystBrain.test.mjs:220 | NEGATIVE CHECK | assert.equal(validateAnalystBrainOutput(badExternalWeight).valid, false); |
| 109 | tests/investmentAnalystBrain.test.mjs:224 | NEGATIVE CHECK | assert.equal(validateAnalystBrainOutput(badProbabilities).valid, false); |
| 110 | tests/investmentAnalystBrain.test.mjs:228 | NEGATIVE CHECK | assert.equal(validateAnalystBrainOutput(badForecast).valid, false); |
| 111 | tests/investmentAnalystBrain.test.mjs:232 | NEGATIVE CHECK | assert.equal(validateAnalystBrainOutput(badExceptional).valid, false); |

## Shape-Only Assertions

- tests/version6.test.mjs:66 assert.equal(missingScore.rankingComponents.upsideComposite, null, "missing upside must stay missing");
- tests/version6.test.mjs:67 assert.ok(
- tests/version6.test.mjs:76 assert.equal(ranked[0].ticker, "ACT", "actionable companies rank before insufficient data");
- tests/version6.test.mjs:107 assert.equal(language.uiLabel("Rank"), "الترتيب");
- tests/version6.test.mjs:109 assert.ok(language.financialTerm("ROIC").startsWith("ROIC"), "financial terms keep the English standard");
- tests/version6.test.mjs:111 assert.equal(language.uiLabel("Rank"), "Rank");
- tests/version6.test.mjs:112 assert.equal(language.financialTerm("ROIC"), "ROIC");
- tests/version6.test.mjs:119 assert.equal(updated[0].currentPrice, 12, "latest evaluation replaces the current row");
- tests/version7.test.mjs:51 assert.equal(draft.status, "Draft");
- tests/version7.test.mjs:53 assert.equal(draft.report, null);
- tests/version7.test.mjs:63 assert.equal(workspace.inputs.revenue.mode, "Automatic");
- tests/version7.test.mjs:71 assert.equal(first.error, undefined);
- tests/version7.test.mjs:86 assert.notEqual(base.executiveConclusion.baseFairValue, overridden.executiveConclusion.baseFairValue);
- tests/version8.test.mjs:45 assert.equal(result.error, undefined);
- tests/version8.test.mjs:46 assert.ok(result.report.executiveConclusion.recommendation);
- tests/investmentAnalystBrain.test.mjs:19 assert.equal(generated.error, undefined, `${ticker} should generate without error`);
- tests/investmentAnalystBrain.test.mjs:22 assert.ok(validateAnalystBrainOutput(generated.report).valid, `${ticker} report should validate`);
- tests/investmentAnalystBrain.test.mjs:49 assert.equal(typeof row.source, "string");
- tests/investmentAnalystBrain.test.mjs:90 assert.equal(profitable.report.scenarios.Exceptional.fairValue, null);

## Assertions That Verify Financial Calculations

- Direct exact formula assertions are limited. There are checks for probability total, numeric finiteness, WACC override impact, parser unit conversion, and some color/ranking calculations.
- There is **no exact assertion** recomputing DCF fair value from forecast cash flows.
- There is **no exact assertion** recomputing EV/EBITDA or EV/Sales from source inputs.

## Methodology Rules With Zero Or Weak Coverage

- Exact DCF discounting formula: weak coverage; mutation undetected.
- Model suitability as a gate: weak coverage; mutation undetected.
- WACC guardrail validation in JSON schema: no direct negative test.
- Fair value consistency between selected model weights, scenario value, and dashboard export: no recomputation test.
- Balance-sheet gate as a hard BUY condition: no direct test.

## Direct Answers

- Is Recommendation logic actually tested? **Partially.** Insufficient-data gate is tested and mutation was detected. BUY/HOLD/SELL threshold coverage is not comprehensive.
- Is DCF logic actually tested? **Partially and insufficiently.** DCF presence is tested, but DCF arithmetic mutation was not detected.
- Is Model Selection actually tested? **Partially.** Selected methods and unsupported exclusions are tested, but suitability-rule mutation was not detected.
