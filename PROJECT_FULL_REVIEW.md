# PROJECT_FULL_REVIEW

تاريخ الفحص: 2026-08-01  
جذر المشروع: `/Users/abdullahmoshbab/Documents/Codex/2026-07-08/hf/outputs/equity-research-v2`  
نطاق الفحص: الكود الحالي في working tree، وليس README فقط.  
ملاحظة مهمة: يوجد تغييرات غير ملتزمة في Git قبل هذا التقرير، خصوصًا مسار `External ChatGPT Analysis Import`. هذا التقرير يراجع الحالة الفعلية الحالية كما هي، ولا يعدل أي ملف آخر.

## 1. Executive Summary

التطبيق حاليًا هو منصة Vanilla JavaScript باسم `Franklin Research` تجمع بين ثلاثة أشياء:

1. محرك تحليل وتقييم داخلي deterministic للأسهم.
2. Data Platform يلف كل حقل مالي بمصدر وتاريخ وثقة وحالة تحديث.
3. مسار جديد لاستيراد تحليل ChatGPT خارجيًا: `Paste -> Parse -> Preview -> Save -> Report`.

طريقة عمله الحالية ليست متطابقة بالكامل مع الرؤية الجديدة. الرؤية الجديدة تقول إن ChatGPT يحلل خارج التطبيق، والتطبيق لا يحسب ولا يوصي ولا يعيد التقييم. الكود الحالي بدأ يدعم ذلك فعليًا عبر `src/externalAnalysis/*` وواجهة `externalImportPanel()` و`externalAnalysisReportView()`، لكنه لا يزال يحتفظ بمحركات التحليل الداخلية كمسار رئيسي داخل المنتج.

مستوى النضج: متوسط إلى جيد. يوجد اختبارات حقيقية تغطي المحركات، backend API، الإنتاج، UI behavior، ومسار External Import. في المقابل، البنية لا تزال تعتمد على ملف UI ضخم جدًا، تخزين browser-only، نسخ مكررة بين `src/` و`public/` و`docs/`، وعدم وجود Database حقيقي.

أهم نقاط القوة:

- محركات التحليل deterministic ومغطاة باختبارات.
- OpenAI وFMP ينتقلان عبر Backend آمن بدل وضع المفاتيح في الواجهة.
- مسار External ChatGPT Import موجود ومستقل نسبيًا عن محركات التقييم.
- `localStorage` يحفظ التقارير المستوردة بنسخ متعددة لكل ticker.
- الواجهة تدعم العربية RTL وتحافظ على المصطلحات المالية الإنجليزية.

أهم نقاط الضعف:

- التطبيق لا يزال يحمل فلسفة "Financial Analyst Engine" أكثر من "Report Archive".
- لا توجد قاعدة بيانات أو مزامنة سحابية أو backup تلقائي.
- ملف `src/ui/components.js` بحجم 3177 سطرًا وفيه rendering وbusiness wiring وformatting وexport معًا.
- `src/valuationWorkflow/workflow.js` بحجم 1870 سطرًا وفيه parsing وworkflow وvaluation وreport generation.
- توجد نسخ runtime مكررة في `src/` و`public/src/` و`docs/src/`.
- `backend-config.js` قيمته فارغة؛ على GitHub Pages لن تعمل API بدون ضبط backend URL.

أهم المخاطر التقنية:

- فقدان البيانات عند مسح بيانات المتصفح أو امتلاء `localStorage`.
- صعوبة التطوير بسبب coupling عال بين UI وState وEngines.
- مخاطر XSS نظرًا للاعتماد الكبير على `innerHTML`، رغم وجود `escapeHtml()`.
- مخاطر prompt injection في parser لأن المستخدم يلصق نصًا غير موثوق، مع أن validation يحد من الضرر.
- لا يوجد migration/versioning رسمي لـ localStorage schema.

جاهزية الرؤية الجديدة:

- جاهز جزئيًا. المسار الجديد موجود: `External ChatGPT Analysis -> Parser -> Validator -> Preview -> Storage -> External Report`.
- غير جاهز نهائيًا لأن الواجهة ما زالت تعرض وتدفع المستخدم إلى مسار التقييم الداخلي، ومحركات التحليل الداخلية ما زالت جزءًا مركزيًا من Home/Workspace.

Overall Project Score: 7.1/10  
Readiness for External ChatGPT Archive Vision: 7.4/10

## 2. Project Overview

| البند | الحالة الحالية |
| --- | --- |
| اسم المشروع | `ai-equity-research-platform` في `package.json`، و`Franklin Research 10.0.0` في الواجهة |
| الهدف الحالي حسب README | منصة Research وتقييم deterministic تسأل: "Should I buy this stock today?" |
| الهدف الجديد المطلوب | Archive / Structured Data Store / Report Viewer لتحليلات ChatGPT الخارجية |
| Frontend stack | HTML + CSS + Vanilla ES Modules |
| Backend stack | Node.js native `http`، بدون Express |
| Runtime | Node >= 20 في `backend/package.json`، والاختبارات شغلت على Node v24.14.0 |
| Build tool | لا يوجد build tool فعلي، التطبيق static modules |
| State management | Store مخصص في `src/state/store.js` |
| Storage/database | `localStorage` فقط، key: `equityResearchV4State` |
| Database | لا يوجد Database، ولا ORM، ولا migrations |
| External APIs | FMP عبر backend، OpenAI عبر backend |
| OpenAI integration | Parsing فقط عبر `/api/parse-investment-analyst` و`/api/parse-external-analysis` |
| طريقة التشغيل | `node server.mjs` أو `npm start` عند توفر npm |
| طريقة build | لا توجد build step |
| طريقة النشر الحالية | `docs/` لـ GitHub Pages، و`backend/` لـ Render/Railway |
| PWA | موجود عبر `manifest.webmanifest` و`service-worker.js` |

تعارض README مع الكود:

- README يركز على محرك تحليل داخلي يطبع تقريرًا استثماريًا. الكود الحالي أضاف في `CHANGELOG.md` Version 10.3 لمسار External ChatGPT Import، وهو أقرب للرؤية الجديدة.
- `package.json` ما زال version `10.0.0` بينما `CHANGELOG.md` يوثق `10.3`.
- README يذكر API routes الثلاثة القديمة، بينما الكود يحتوي أيضًا على `/api/parse-external-analysis` وbackend split endpoints.

## 3. Full Project Tree

الشجرة التالية تركز على الملفات المهمة الفعلية. تم استبعاد `node_modules` والملفات المضغوطة والصور الكبيرة من التفصيل، لكن تم ذكر مجلدات الأصول والتسليم.

```text
.
├── .env.example
├── package.json
├── render.yaml
├── index.html
├── login.html
├── offline.html
├── styles.css
├── backend-config.js
├── manifest.webmanifest
├── service-worker.js
├── server.mjs
├── assets/
│   ├── app-icon.png
│   ├── apple-touch-icon.png
│   ├── franklin-make-money-coin-icon-1024.png
│   ├── icon-192.png
│   └── icon-512.png
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── render.yaml
│   └── server.mjs
├── src/
│   ├── main.js
│   ├── login.js
│   ├── pwa.js
│   ├── analystBrain/
│   │   ├── engine.js
│   │   ├── methodology.js
│   │   └── schemaValidator.js
│   ├── data/
│   │   ├── demoFlow.js
│   │   └── sampleData.js
│   ├── dataPlatform/
│   │   ├── dataPlatform.js
│   │   ├── fields.js
│   │   └── providerContracts.js
│   ├── domain/
│   │   ├── evaluatedCompanies.js
│   │   ├── financialMetrics.js
│   │   └── marketColorSystem.js
│   ├── engines/
│   │   ├── dataCompletenessEngine.js
│   │   ├── decisionEngine.js
│   │   ├── engineUtils.js
│   │   ├── explainabilityEngine.js
│   │   ├── rankingEngine.js
│   │   ├── researchEngine.js
│   │   ├── scoringEngines.js
│   │   └── valuationEngine.js
│   ├── externalAnalysis/
│   │   ├── externalAnalysisSchemaValidator.js
│   │   ├── parser.js
│   │   ├── reportAdapter.js
│   │   ├── schema.js
│   │   └── storage.js
│   ├── i18n/
│   │   └── language.js
│   ├── providers/
│   │   ├── apiClient.js
│   │   └── backendEndpoint.js
│   ├── research/
│   │   └── institutionalResearch.js
│   ├── state/
│   │   └── store.js
│   ├── ui/
│   │   └── components.js
│   └── valuationWorkflow/
│       └── workflow.js
├── public/
│   ├── index.html
│   ├── login.html
│   ├── offline.html
│   ├── styles.css
│   ├── backend-config.js
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   ├── src/              # نسخة runtime من src
│   └── investment_analyst_brain_v1/
├── docs/
│   ├── index.html
│   ├── login.html
│   ├── offline.html
│   ├── styles.css
│   ├── backend-config.js
│   ├── manifest.webmanifest
│   ├── service-worker.js
│   ├── src/              # نسخة GitHub Pages من src
│   └── investment_analyst_brain_v1/
├── investment_analyst_brain_v1/
│   ├── 00_METHODOLOGY_CONTRACT.md
│   ├── 00_METHODOLOGY_CONTRACT.json
│   ├── 01_COMPANY_CLASSIFICATION.md
│   ├── 02_BUSINESS_QUALITY.md
│   ├── 03_VALUATION_MODEL_SELECTION.md
│   ├── 04_FORECAST_POLICY.md
│   ├── 05_WACC_POLICY.md
│   ├── 06_SCENARIO_POLICY.md
│   ├── 07_FAIR_VALUE_POLICY.md
│   ├── 08_RECOMMENDATION_POLICY.md
│   ├── 09_MONITORING_POLICY.md
│   ├── 10_REPORT_TEMPLATE.md
│   ├── 11_OUTPUT_SCHEMA.json
│   ├── 12_MASTER_ANALYST_PROMPT.md
│   └── README.md
├── tests/
│   ├── backendApi.test.mjs
│   ├── externalAnalysisImport.test.mjs
│   ├── investmentAnalystBrain.test.mjs
│   ├── productionDeployment.test.mjs
│   ├── version6.test.mjs
│   ├── version7.test.mjs
│   ├── version8.test.mjs
│   ├── version9_1AnalyticalEngine.test.mjs
│   └── version9_2UIUX.test.mjs
├── golden-cases/
│   ├── bank/
│   ├── capital-intensive/
│   ├── cyclical/
│   ├── holding-company/
│   ├── insufficient-data/
│   ├── pre-profit/
│   ├── profitable-growth/
│   ├── reit/
│   └── INDEX.md
├── raw-test-output/
├── screenshots-v9.2-ui/
├── screenshots-v9.3-ui-polish/
├── screenshots-v10-product-design/
├── version_9_evidence/
└── documentation files:
    ├── README.md
    ├── CHANGELOG.md
    ├── ARCHITECTURE.md
    ├── DATA_PLATFORM.md
    ├── INVESTMENT_ENGINE.md
    ├── INVESTMENT_REPORT_EXPERIENCE.md
    ├── LANGUAGE_SYSTEM.md
    ├── RANKING_ENGINE.md
    ├── SECURE_BACKEND_API.md
    ├── PRODUCTION_DEPLOYMENT.md
    ├── PRODUCTION_SECURITY_REVIEW.md
    ├── SUPPORTED_VALUATION_MODELS.md
    ├── METHODOLOGY_VERSION_CONTRACT.md
    ├── VALUATION_CALCULATION_AUDIT.md
    ├── VALUATION_OUTPUT_SCHEMA.json
    ├── VALUATION_POLICY.json
    └── many audit/result/change reports
```

مجلدا `investment-analyst-platform-v10-product-design/` و`investment-analyst-platform-v10-product-design 2/` موجودان كمجلدات تسليم/نسخ سابقة وليسا source of truth للتشغيل الحالي. وجودهما يزيد الحجم والالتباس.

## 4. Application Architecture

Entry point:

- `index.html` يحمل `backend-config.js` ثم `styles.css` ثم `src/main.js`.
- `src/main.js` ينشئ store عبر `createStore()` ثم يركب الواجهة عبر `mountApp(root, store)`.

Routing:

- لا يوجد URL routing.
- التنقل يتم عبر `state.activePanel` داخل `src/state/store.js`.
- `panelContent(state)` في `src/ui/components.js` يختار الشاشة حسب `activePanel`.

Current internal analysis flow:

```text
Home search
-> searchCompanies()
-> providerContracts.createFmpProvider().search()
-> backend /api/search
-> user selects ticker
-> fetchResearchData()
-> buildUnifiedDataCompany()
-> openValuationWorkspace()
-> paste input or manual fields
-> parseInvestmentAnalystBlock() via backend OpenAI parser
-> runInvestmentAnalystBrainValuation()
-> runAnalystBrainEngine()
-> validateAnalystBrainOutput()
-> investmentReportExperience()
-> approveWorkspaceValuation()
-> upsertEvaluatedCompany()
-> Home dashboard
```

Current external ChatGPT import flow:

```text
Home
-> openExternalImport()
-> externalImportPanel()
-> user pastes ChatGPT analysis or JSON
-> parseExternalAnalysisInput()
   -> local JSON parser if JSON
   -> /api/parse-external-analysis if unstructured text
-> normalizeExternalAnalysisReport()
-> validateExternalAnalysisReport()
-> externalPreviewPanel()
-> saveExternalAnalysis()
-> state.externalAnalyses
-> externalAnalysisReportView()
-> Home external cards
```

Backend architecture:

- Root server: `server.mjs`
  - Serves static frontend from `public/`.
  - Optional private auth via `APP_ACCESS_PASSWORD`.
  - API proxy to FMP/OpenAI.
- Separate API backend: `backend/server.mjs`
  - Designed for GitHub Pages frontend.
  - CORS restricted to `https://aoodycom-cmyk.github.io`.
  - Provides `/api/health`, `/api/search`, `/api/company/:symbol`, parsers.

## 5. Current User Workflow

### فتح التطبيق

- `src/main.js` calls `createStore()`.
- Store reads `localStorage.getItem("equityResearchV4State")`.
- UI renders `homeDashboard(state)`.

### إضافة شركة بالطريقة الداخلية القديمة/الحالية

- المستخدم يبحث في `homePolishedSearch()` أو `searchBlock()`.
- `createActions().search()` calls `searchCompanies(query)`.
- النتائج تعرض عبر `searchResult(company)`.
- عند الاختيار: `createActions().loadCompany(ticker)` calls `fetchResearchData()`.
- `openValuationWorkspace(company)` يفتح `activePanel = "workspace"`.

### إدخال البيانات وPaste

- صندوق paste الرئيسي في `analystBrainPastePanel()`.
- أثناء الكتابة، handler يغير `store.state.valuationWorkspace.analystBrainPaste` مباشرة لتفادي إغلاق keyboard.
- عند الضغط على تحليل: `runAnalystBrainValuation(text)`.

### Parsing داخلي

- `parseInvestmentAnalystBlock()` يرسل النص إلى `/api/parse-investment-analyst`.
- عند تعذر AI parser يرجع `{ unavailable: true, parsedFields: [] }`.
- `runInvestmentAnalystBrainValuation()` يدمج parser المحلي `parseOneBlockFields()` مع parsedFields القادمة من AI.

### Review

- `buildDataReview()` يحسب completeness، missing، conflicting، unconfirmedParsed.
- الحقول الحرجة تأتي من `VALUATION_POLICY.criticalFields`.

### Analysis / Valuation

- `runAnalystBrainEngine()` في `src/analystBrain/engine.js`.
- يحسب classification، quality، forecast، scenarios، valuation models، recommendation، monitoring.

### Save / Export

- `approveAndExportWorkspace()` calls `approveWorkspaceValuation()`.
- إذا نجح validation، ينشئ `evaluatedCompany` ويضيفه عبر `upsertEvaluatedCompany()`.
- يظهر في Home table/cards.

### External ChatGPT Import

- `openExternalImport()` يفتح شاشة paste.
- `parseExternalImport(text)` لا يعيد التقييم، فقط parse/normalize/validate.
- `saveExternalDraft()` يحفظ في `externalAnalyses`.
- `openExternalReport()` يعرض التقرير المستورد.
- `editExternalReport()` يرجع المستخدم إلى Preview مع JSON editor.
- `removeExternalReport()` يحذف نسخة.
- `removeAllExternalReports()` يحذف كل تحليلات ticker.

## 6. All Screens / Pages

| Screen | File | Purpose | Reads | Writes | Actions | Navigation |
| --- | --- | --- | --- | --- | --- | --- |
| Home Dashboard | `src/ui/components.js` `homeDashboard()` | البحث، أحدث التحليلات، الشركات المقيمة، external cards | `evaluatedCompanies`, `externalAnalyses`, `query` | `query`, `activePanel` | search, new analysis, import external, open report | default |
| Search Results | `searchBlock()`, `searchResult()` | عرض نتائج FMP/local search | `searchResults` | `valuationWorkspace` | select ticker | Home -> Workspace |
| Valuation Workspace | `valuationWorkspacePanel()` | مسار التحليل الداخلي | `valuationWorkspace` | inputs, paste, overrides | analyze, review, approve | `activePanel="workspace"` |
| Paste Input | `analystBrainPastePanel()` | صندوق واحد للصق بيانات الشركة | `analystBrainPaste` | `analystBrainPaste` | analyze, clear, demo | Workspace |
| Data Review | `dataReviewPanel()` | عرض confirmed/missing/conflicting | `workspace.dataReview` | field confirmations | confirm/reject/not available | Workspace |
| Investment Report | `investmentReportExperience()` | التقرير الداخلي report-first | `workspace.report` | approval notes/status | approve/export, edit | Workspace |
| External Import | `externalImportPanel()` | لصق تحليل ChatGPT الخارجي | `externalImport.rawText` | `externalImport` | parse, clear, cancel | Home -> external-import |
| External Preview | `externalPreviewPanel()` | مراجعة JSON المستخرج | `draftReport`, `validation` | draft fields/json | save, duplicate save | external-import |
| External Report | `externalAnalysisReportView()` | عرض تقرير ChatGPT محفوظ | `externalAnalyses`, selection | selection/delete/edit | copy/export/print/edit/delete | external-report |
| Evaluated Companies Table | `evaluatedCompaniesTable()` | ترتيب ومقارنة الشركات الداخلية | `evaluatedCompanies` | sort/filter/compare | row open, sort, filter | Home |
| Comparison | `comparisonPanel()` | مقارنة 2-5 شركات | selected tickers | comparison state | close/open | Home |
| Institutional Research | `institutionalResearchPanel()` | بحث مؤسسي مشتق من internal research | `institutionalResearch` | none | panels | research |
| Watch List | `watchListPanel()` | حفظ أطروحة وسعر مستهدف وملاحظات | `watchList`, `watchDraft` | watchList | save/remove | watchlist |
| Settings | `settingsPanel()` | اللغة/الثيم ومسح البيانات | state | localStorage clear/theme/language | clear data | settings |
| History | `historyPanel()` | سجل runs داخلي | `history` | none | display | history |
| Legacy Summary/Valuation/Engine Panels | `summaryPanel()`, `valuationPanel()`, `enginePanel()` | عرض نتائج engine legacy | `research` | none | display | summary/valuation/quality/growth/risk |

## 7. Components

التطبيق لا يستخدم React Components. كل "component" عبارة عن دالة template string داخل `src/ui/components.js`.

| Component/function | المسار | الوظيفة | props/state | Business logic? | Reusable? | Duplication |
| --- | --- | --- | --- | --- | --- | --- |
| `mountApp(root, store)` | `src/ui/components.js` | تركيب render والاشتراك في store | root/store | منخفض | لا | لا |
| `render(root, store, actions)` | same | يرسم الصفحة كاملة بـ `innerHTML` | كامل state | متوسط | لا | مركزي جدًا |
| `homeDashboard(state)` | same | الصفحة الرئيسية | state | متوسط | جزئي | نعم مع table/cards |
| `evaluatedCompaniesTable(state)` | same | جدول الشركات المقيمة | evaluated/sort/filter | عالي في sorting display | لا | بعضه يتكرر مع cards |
| `externalImportPanel(state)` | same | شاشة import | externalImport/loading | منخفض | متوسط | جديد ومستقل |
| `externalPreviewPanel(report,state)` | same | Preview/Edit | draftReport | منخفض | متوسط | JSON editor خاص |
| `externalAnalysisReportView(state)` | same | report viewer خارجي | externalAnalyses | منخفض إلى متوسط | متوسط | أفضل فصلًا من internal report |
| `valuationWorkspacePanel(state)` | same | workspace داخلي | valuationWorkspace | عالي | لا | ضخم |
| `investmentReportExperience(workspace,state)` | same | report-first داخلي | report/workspace | متوسط | لا | يرتبط بـ legacy report shape |
| `scenarioCards(report)` | same | عرض السيناريوهات | report | منخفض | جزئي | داخلي فقط |
| `fairValueVisual(report)` | same | Fair Value range | report | formatting | جزئي | داخلي فقط |
| `bind(root,store,actions)` | same | event handlers | DOM/store | عالي | لا | شديد coupling |

أكبر مشكلة components: `src/ui/components.js` يجمع UI وformatting وnavigation وexports وclipboard وdelete confirmation وbusiness conditions. هذا يجعل أي تعديل UX صغير خطرًا.

## 8. Complete Data Model

### Company model

مصدره `src/data/sampleData.js`, `src/dataPlatform/dataPlatform.js`, وFMP normalization في server.

```json
{
  "ticker": "AAPL",
  "name": "Apple Inc.",
  "sector": "Technology",
  "industry": "Consumer Electronics",
  "currency": "USD",
  "quote": {
    "price": { "value": 202.0, "source": "Financial Modeling Prep", "timestamp": "...", "confidence": 98, "updateStatus": "fresh" },
    "marketCap": { "value": 3000000000000, "source": "Financial Modeling Prep", "timestamp": "...", "confidence": 98, "updateStatus": "fresh" }
  },
  "financials": [],
  "consensus": {},
  "dataPlatform": {
    "version": "4.0",
    "providerFallbackOrder": ["Morningstar", "Financial Modeling Prep", "Manual Input", "Missing"],
    "fields": {},
    "timeline": {},
    "health": {}
  }
}
```

### Data Field model

من `src/dataPlatform/fields.js`:

```json
{
  "value": null,
  "source": "Missing",
  "timestamp": null,
  "confidence": 0,
  "updateStatus": "missing",
  "providerType": "FinancialProvider",
  "field": "financials.latest.revenue",
  "statement": "",
  "period": "",
  "fiscalPeriod": "",
  "conflicts": []
}
```

### Internal valuation workspace

من `createValuationWorkspace()`:

```json
{
  "id": "workspace-AAPL",
  "ticker": "AAPL",
  "companyName": "Apple Inc.",
  "status": "Draft",
  "researchStatus": "Draft",
  "methodologyVersion": "fixed-methodology-2026.07",
  "inputs": {},
  "sectionSources": {},
  "pasteDrafts": {},
  "analystBrainPaste": "",
  "aiParseNotes": [],
  "pastePreview": null,
  "dataReview": null,
  "report": null,
  "renderedReport": "",
  "investorNotes": "",
  "overrides": {},
  "versions": []
}
```

### Internal Analyst Brain report

من `src/analystBrain/engine.js`:

- `schemaVersion`: `analyst-brain-output-schema-1.1.0`
- `methodologyVersion`: `investment-analyst-brain-v1.1-canonical`
- يحتوي company, classification, businessQuality, forecastAssumptions, scenarios, valuationModels, dataQuality, finalInvestmentDecision, monitoringChecklist, dashboardExport.

### ExternalAnalysisReport

من `src/externalAnalysis/schema.js`:

```json
{
  "schemaVersion": "external-analysis-report/v1",
  "analysisOrigin": "external_chatgpt",
  "source": "ChatGPT",
  "sourceModel": null,
  "sourceConversation": null,
  "analysisDate": null,
  "reportPeriod": null,
  "company": {
    "ticker": null,
    "name": null,
    "sector": null,
    "industry": null,
    "currency": "USD"
  },
  "market": {
    "priceAtAnalysis": null,
    "userAverageCost": null
  },
  "scores": {
    "quality": null,
    "growth": null,
    "valuation": null,
    "risk": null,
    "overall": null,
    "moat": null,
    "management": null
  },
  "fairValue": {
    "bear": null,
    "base": null,
    "bull": null,
    "weightedFairValue": null,
    "analystFairValue": null,
    "upsideToBasePct": null,
    "downsideToBearPct": null,
    "upsideToBullPct": null
  },
  "valuationMethods": {
    "dcf": null,
    "pe": null,
    "evEbitda": null,
    "ps": null,
    "peg": null,
    "sotp": null,
    "other": null
  },
  "financialHighlights": {
    "revenue": null,
    "revenueGrowthPct": null,
    "operatingIncome": null,
    "operatingIncomeGrowthPct": null,
    "operatingMarginPct": null,
    "epsReported": null,
    "epsNormalized": null,
    "operatingCashFlow": null,
    "freeCashFlow": null,
    "capex": null,
    "cash": null,
    "debt": null
  },
  "growthHighlights": {},
  "quality": {},
  "risks": [],
  "catalysts": [],
  "thesis": {
    "shortSummary": null,
    "fullSummary": null
  },
  "earningsQuality": {
    "status": null,
    "reportedVsNormalizedExplanation": null,
    "oneOffItems": []
  },
  "watchItems": [],
  "decision": {
    "verdict": null,
    "rationale": null,
    "buyZone": null,
    "fairZone": null,
    "expensiveZone": null
  },
  "sources": [],
  "rawAnalysis": "",
  "rawAnalysisOriginal": "",
  "userEditedFields": {},
  "metadata": {
    "importedAt": "...",
    "updatedAt": "...",
    "importMethod": null,
    "parserVersion": "external-parser-v1",
    "rawHash": null
  }
}
```

### Saved state

يحفظ في `localStorage`:

```json
{
  "company": {},
  "language": "ar",
  "theme": "dark",
  "activePanel": "home",
  "evaluatedCompanies": [],
  "externalAnalyses": {
    "AAPL": []
  },
  "externalReportSelection": null,
  "history": [],
  "watchList": []
}
```

## 9. State Management

الملف الرئيسي: `src/state/store.js`.

Initialization:

- `load()` يقرأ JSON من `localStorage`.
- `initialLanguage` من saved state أو `localStorage.equityResearchLanguage`.
- `initialExternalAnalyses` عبر `normalizeExternalAnalysesCollection()`.
- `initialCompany` عبر `buildUnifiedDataCompany()`.
- `research` يحسب مباشرة عند الإنشاء باستخدام `runEquityResearch()`.

Updates:

- `set(patch)` يدمج patch في state ثم يشغل `persist(state)` ثم listeners.
- بعض handlers تعدل state مباشرة قبل set لتثبيت keyboard مثل search input وpaste input.

Persistence:

- `persist()` يحفظ فقط حقول محددة.
- `manualInputs`, `valuationWorkspace`, `externalImport`, `watchDraft` لا تحفظ في `persist()` رغم أن `createStore()` يحاول قراءة بعضها من saved state. هذا inconsistency.

Derived values:

- `research` مشتق من `company + manualInputs`.
- `institutionalResearch` مشتق من `research`.
- ranking مشتق عبر `rankEvaluatedCompanies()`.
- external reports لا تعاد حساباتها؛ تعرض كما حُفظت.

Migrations/versioning:

- لا يوجد migration رسمي.
- key قديم باسم `equityResearchV4State` لا يعكس V10.3.

Stale state risks:

- إذا تغير schema، load يحاول normalize بعض الأجزاء فقط.
- external reports القديمة التي لا تحمل `analysisOrigin = external_chatgpt` ستُستبعد.
- أخطاء `localStorage.setItem()` مثل quota exceeded غير ممسوكة.

## 10. Storage

أين تحفظ البيانات:

- كل بيانات المستخدم داخل browser `localStorage`.
- key الرئيسي: `equityResearchV4State`.
- لغة الواجهة تحفظ أيضًا في `equityResearchLanguage`.
- لا توجد IndexedDB.
- لا توجد Database.
- لا توجد Supabase/Firebase/ORM/migrations.

Overwrite behavior:

- `evaluatedCompanies` يستخدم `upsertEvaluatedCompany()` ويحفظ آخر نسخة لكل ticker مع history داخلي محدود.
- `externalAnalyses` يحفظ array لكل ticker، ولا يكتب فوق القديم تلقائيًا.
- duplicate detection للـ external يعتمد على `ticker + rawHash`.

Backup/export:

- External report يدعم Copy JSON وExport JSON عبر `exportSelectedExternalReport()`.
- لا يوجد export كامل لكل `localStorage`.
- لا يوجد import كامل للحالة.

Recovery:

- إذا مسح المستخدم بيانات المتصفح تختفي التحليلات.
- إذا تغير جهاز المستخدم، لا يوجد sync.
- إذا فشل `localStorage` لا توجد رسالة save failure مخصصة.

مخاطر فقد البيانات:

- عالية للرؤية الجديدة إذا كان التطبيق سيصبح أرشيف تحليلات طويل الأمد.
- يجب نقل التخزين لاحقًا إلى Database أو IndexedDB مع export/backup واضح.

## 11. Current Financial Analysis Engine

| Engine | File/function | Inputs | Outputs | Logic | Deterministic/AI | مستخدم فعليًا | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Orchestrator | `src/engines/researchEngine.js` `runEquityResearch()` | company/manualInputs | valuation, quality, growth, management, moat, risk, scenarios, decision | يشغل كل engines | Deterministic | نعم في startup وlegacy panels | version6/legacy coverage |
| Quality | `src/engines/scoringEngines.js` `scoreQuality()` | ROIC, margins, FCF margin, leverage | score/confidence/factors | factor impacts من base 50 | Deterministic | نعم | ضمن analytical tests |
| Growth | `scoreGrowth()` | revenue/EPS/FCF growth, margins | score | factor impacts | Deterministic | نعم | موجود |
| Management | `scoreManagement()` | FCF, buybacks, dilution, leverage | score/grade | factor impacts | Deterministic | نعم | موجود |
| Moat | `scoreMoat()` | qualitative.moatSignals | score/rating | عدد إشارات moat | Deterministic | نعم | موجود |
| Risk | `scoreRisk()` | riskSignals, debt | score/rating | higher score = lower risk | Deterministic | نعم | موجود |
| Data Completeness | `src/engines/dataCompletenessEngine.js` `runDataCompleteness()` | company/manualInputs | score/missing | checks required fields | Deterministic | نعم | موجود |
| Decision | `src/engines/decisionEngine.js` `runDecision()` | valuation/scores/data | BUY/HOLD/SELL | weighted sum + thresholds | Deterministic | نعم | موجود |
| Explainability | `src/engines/explainabilityEngine.js` `runExplainability()` | engines | summary/factors | يجمع عوامل | Deterministic text | نعم | محدود |
| Ranking | `src/engines/rankingEngine.js` `rankEvaluatedCompanies()` | evaluated companies | rankingScore/position | normalized weighted score | Deterministic | نعم في Home | `version6.test.mjs` |
| Canonical Analyst Brain | `src/analystBrain/engine.js` `runAnalystBrainEngine()` | workspace evidence | canonical report | classification/forecast/model/recommendation | Deterministic | نعم في workspace | `investmentAnalystBrain`, `version9_1` |

بالنسبة للرؤية الجديدة، كل هذه المحركات يجب ألا تعمل على External ChatGPT reports. الكود الحالي يلتزم بذلك في `externalAnalysisReportView()` و`externalHomeCard()` حسب `CHANGELOG.md` واختبار `externalAnalysisImport.test.mjs`.

## 12. Current Valuation Engine

### Legacy valuation engine

المسار: `src/engines/valuationEngine.js`.

Assumptions hard-coded:

```js
dcfYears: 5
discountRate: 0.095
terminalGrowth: 0.03
taxRate: 0.18
minGrowth: -0.05
maxGrowth: 0.24
reverseDcfMinGrowth: -0.1
reverseDcfMaxGrowth: 0.35
```

| Method | Function | Inputs | Logic | Missing behavior |
| --- | --- | --- | --- | --- |
| DCF | `buildDcfMethod()` | FCF, shares, netCash, growth | 5-year FCF projection + terminal value | skipped |
| P/E | `buildPeMethod()` | EPS, growth, ROIC | EPS * target P/E adjusted by growth/quality | skipped |
| PEG | `buildPegMethod()` | EPS, growth | EPS * PEG multiple | skipped |
| EV/EBITDA | `buildEvEbitdaMethod()` | EBITDA, shares, netCash, growth | EV multiple then equity per share | skipped |
| EV/Sales | `buildEvSalesMethod()` | revenue, shares, netCash, growth | sales multiple adjusted by growth/FCF margin | skipped |
| Morningstar | inline method | manual input | external reference fair value | skipped if missing |
| Analyst Consensus | inline method | consensus target | external reference target | skipped if missing |
| Reverse DCF | `buildReverseDcf()` | price, FCF, netCash, shares | binary search implied growth | output informational |

Composite:

- `runValuation()` uses `weightedAverage(method.fairValue, method.weight * method.confidence)`.
- Missing methods are removed, not set to zero.

Scenarios:

- `buildScenarios(valuation, quality, growth, risk)`:
  - Bear probability 25%.
  - Base probability 50%.
  - Bull probability 25%.
  - Base = composite fair value.
  - Bear/Bull adjusted by quality/growth/risk modifiers.

### Canonical Analyst Brain valuation

المسار: `src/analystBrain/engine.js`.

Supported models:

```js
["DCF", "P/E", "PEG", "EV/EBITDA", "EV/Sales", "Forward EV/Sales", "Price/FCF", "Morningstar Fair Value", "Analyst Consensus"]
```

Unsupported:

```js
["P/B", "Residual Income", "DDM", "AFFO", "NAV", "Dividend Yield", "Cap Rate", "Sum of the Parts"]
```

Model selection:

- `classifyCompany()` يحدد classification.
- `suitableModelsFor()` يختار models بناءً على FCF/EPS/EBITDA/revenue/shares.
- `NO_SUPPORTED_MODEL_CLASSES` يمنع اختيار models لـ `Financial Institution`, `REIT`, `Holding Company`.
- `applyModelWeights()` يطبق cap وزن النموذج.

Fair Value:

- `scenarioExpectedValue()` يجمع السيناريوهات.
- `buildRecommendation()` يمزج model fair value مع range fair value عندما يتوفران.

احتمالات الخطأ:

- افتراضات WACC/Multiples لا تزال hard-coded داخل code.
- duplicated defaults موجودة في `VALUATION_POLICY.defaultForecasts` داخل `src/valuationWorkflow/workflow.js`.
- بعض model names في الوثائق/الواجهة قد تختلف عن engine internals.

## 13. Earnings Quality

الحالة الحالية:

- مسار External schema لديه `earningsQuality.status`, `reportedVsNormalizedExplanation`, `oneOffItems`.
- internal workspace لديه حقول مثل `stockBasedCompensation`, `eps`, `freeCashFlow`, `netIncome`, لكن لا يوجد normalization كامل لـ EPS/FCF.
- `src/analystBrain/engine.js` يحتوي scoring وconflict detection لكنه لا يعالج كل البنود المحاسبية يدويًا.

| بند | موجود؟ | أين؟ | ملاحظات |
| --- | --- | --- | --- |
| one-off gains | جزئي | `externalAnalysis.earningsQuality.oneOffItems` | محفوظ إذا جاء من ChatGPT |
| investment gains | لا/جزئي | لا يوجد model مستقل | يعتمد على النص الخارجي |
| tax benefits | لا/جزئي | forecast taxRate فقط | لا يطبع adjusted EPS |
| asset sales | لا | لا يوجد field محدد | يمكن ذكرها في risks/thesis |
| restructuring | لا | لا يوجد field محدد | يمكن ذكرها كـ oneOffItems خارجيًا |
| SBC | جزئي | `stockBasedCompensation` في workflow fields | لا يوجد normalization كامل |
| acquisition accounting | لا | لا يوجد |
| normalized EPS | جزئي | external `epsNormalized` | لا يحسب داخليًا |
| normalized FCF | لا/جزئي | `freeCashFlow` فقط | لا يوجد adjusted FCF واضح |

للرؤية الجديدة، الأفضل أن يخرج ChatGPT هذه البنود ضمن schema، والتطبيق يحفظها فقط ولا يحسبها.

## 14. AI / OpenAI Integration

Endpoints:

- `server.mjs`:
  - `POST /api/parse-investment-analyst`
  - `POST /api/parse-external-analysis`
- `backend/server.mjs`:
  - `POST /api/parse-investment-analyst`
  - `POST /api/parse-external-analysis`

Client callers:

- `src/providers/apiClient.js`:
  - `parseInvestmentAnalystBlock()`
  - `parseExternalAnalysisBlock()`

AI responsibilities:

| Use case | AI role | Calculates numbers? | File |
| --- | --- | --- | --- |
| Internal analyst paste | Extract parsed fields from unstructured company data | No final valuation/recommendation | `parseInvestmentAnalystBlock()` |
| External ChatGPT analysis import | Convert completed analysis text into schema | No recalculation | `parseExternalAnalysisBlock()` |

Prompt policy:

- `openAiParserRequest()` says: do not calculate final fair value, recommendation, or investment score.
- External parser prompt shape is built server-side via `openAiExternalAnalysisParserRequest()`.

Structured output:

- Uses JSON object response shape.
- Client normalizes returned object.
- Validation is custom JS, not a formal JSON Schema validator package.

Retries:

- لا توجد retries واضحة.

Error handling:

- Client catches parser errors and returns unavailable/draft validation errors.
- Backend `sendApiError()` hides stack traces and returns safe messages.

Model:

- Env `OPENAI_MODEL` supported.
- Fallback/default appears in request builders as `gpt-4.1-mini`.

No secrets printed in this report.

## 15. Input / Import System

طرق الإدخال الحالية:

| Method | Path | Description |
| --- | --- | --- |
| Ticker search | `searchCompanies()` | عبر backend/FMP أو local fallback |
| Manual fields | `workflowField()` / `setWorkspaceField()` | حقول workspace |
| Section paste | `parseWorkspacePaste()` | parsing محلي للحقول حسب section |
| One block internal paste | `runAnalystBrainValuation()` | AI parser + deterministic engine |
| External JSON paste | `parseExternalAnalysisInput()` | JSON local parser |
| External text paste | `parseExternalAnalysisInput()` + backend parser | OpenAI parser يحول النص إلى ExternalAnalysisReport |
| Demo data | `loadDemoAnalysis()` | fixture داخلي |
| API | FMP/OpenAI via backend | لا مفاتيح في frontend |
| Files | لا يوجد رفع ملفات حقيقي | فقط paste/export JSON |

External paste flow:

```text
Paste text
-> parseExternalImport()
-> parseExternalAnalysisInput()
-> parseJsonCandidate()
-> if JSON: normalizeExternalAnalysisReport()
-> else: parseExternalAnalysisBlock() /api/parse-external-analysis
-> validateExternalAnalysisReport()
-> findDuplicateExternalAnalysis()
-> Preview
-> saveExternalDraft()
-> saveExternalAnalysis()
-> localStorage externalAnalyses
-> externalAnalysisReportView()
```

## 16. Parsing

Parsers:

- `src/externalAnalysis/parser.js`
  - `parseExternalAnalysisInput()`
  - `parseJsonCandidate()`
  - `extractFirstJsonObject()`
- `src/externalAnalysis/schema.js`
  - `normalizeExternalAnalysisReport()`
  - `toNullableNumber()`
  - `normalizeDate()`
  - `normalizeTicker()`
- `src/valuationWorkflow/workflow.js`
  - `parseWorkspacePaste()`
  - `parseOneBlockFields()`
  - `parseRows()`
  - `parseValue()`
  - number/currency/percentage helpers
- `server.mjs` / `backend/server.mjs`
  - OpenAI parser request builders

Null handling:

- External schema يستخدم `null` عند missing.
- `preserveNulls()` يحول undefined إلى null.
- لا يستخدم 0 كبديل missing في External schema.

Number parsing:

- External `toNullableNumber()` يمسح `%,$,space,comma`.
- Workflow parser يتعامل مع units/percent/currency بشكل أوسع.

Arabic/English:

- UI labels عبر `src/i18n/language.js`.
- Financial terms محفوظة غالبًا بالإنجليزية.
- Parser لا يعتمد على اللغة وحدها؛ prompt يأخذ `language`.

Malformed JSON:

- `parseJsonCandidate()` يجرب النص كاملًا ثم أول object.
- إذا فشل JSON ولم يوجد parser backend، يرمي خطأ.
- JSON editor في Preview يعيد validation عند blur.

## 17. Validation

External validation في `validateExternalAnalysisReport()`:

- `company.ticker`: مطلوب ورمز صحيح.
- `analysisDate`: مطلوب وتاريخ قابل للقراءة.
- `market.priceAtAnalysis`: مطلوب > 0.
- scores المطلوبة: `quality`, `growth`, `valuation`, `risk` بين 0 و10.
- scores الاختيارية: `overall`, `moat`, `management` بين 0 و10 إذا وجدت.
- fair values: `bear`, `base`, `bull` مطلوبة > 0.
- thesis: مطلوب `shortSummary` أو `fullSummary`.
- risks: مطلوب risk واحد على الأقل.
- `decision.verdict`: مطلوب.
- arrays يجب أن تكون arrays إذا وجدت.
- numbers لا تقبل `NaN` أو `Infinity`.
- `analysisOrigin` يجب أن يبقى `external_chatgpt`.
- source غير ChatGPT ينتج warning لا error.

Internal validation:

- `buildDataReview()` يحدد completeness وcritical conflicts.
- `canRunValuation()` يتطلب completeness >= 68 ولا توجد critical conflicts.
- `validateValuationReport()` يتحقق من sections والسيناريوهات والassumption rationale.
- `validateAnalystBrainOutput()` يتحقق من canonical report.

Duplicate validation:

- `findDuplicateExternalAnalysis()` يعتمد على ticker و`metadata.rawHash`.
- `saveExternalAnalysis()` يرفض duplicate إلا إذا `allowDuplicate=true`.

نواقص:

- لا توجد validation رسمية لحجم localStorage.
- لا يوجد strict enum للـ verdict الخارجي.
- لا يوجد validation ordering لـ Bear <= Base <= Bull في External report.
- لا يوجد validation أن `weightedFairValue` يساوي weighted scenarios.

## 18. Report System

### Internal report

Main function:

- `investmentReportExperience(workspace,state)`

Sections:

- Header/company.
- Decision center.
- Takeaways.
- Scenario cards.
- Fair Value visual.
- Business quality.
- Risk snapshot.
- Valuation models.
- Forecast.
- Monitoring.
- What could change decision.
- Collapsible details.

Source of values:

- Quality/Growth/Risk/Valuation/Decision تأتي من `runAnalystBrainEngine()`.
- Bear/Base/Bull من scenarios.
- Recommendation من `buildRecommendation()`.
- Sources من workspace inputs/source snapshots.

### External report

Main function:

- `externalAnalysisReportView(state)`

Sections:

- Hero: ticker/company/thesis/verdict.
- Quick summary: ticker/date/period/current price/base.
- Score cards.
- Bear/Base/Bull summary.
- Collapsible sections:
  - Valuation Methods
  - Investment Thesis
  - Growth
  - Business Quality
  - Earnings Quality
  - Risks
  - Catalysts
  - Watch Items
  - Decision/Verdict
  - Sources
  - Version History
  - Raw ChatGPT Analysis

External source of values:

- كل القيم تأتي من `ExternalAnalysisReport` المحفوظ.
- لا يوجد call إلى valuation/scoring/recommendation engines.

## 19. Home / Dashboard

Home تعرض:

- Search.
- Quick actions مثل New Analysis وImport ChatGPT Analysis.
- External analyses section via `externalAnalysesHomeSection()`.
- Internal evaluated companies via cards/table.
- Filters/sort/comparison.

Stored vs calculated:

| Field | Source |
| --- | --- |
| External cards | stored in `state.externalAnalyses` |
| Internal evaluated companies | stored in `state.evaluatedCompanies` |
| Ranking position | recalculated by `rankEvaluatedCompanies()` |
| Range FV internal | calculated by `calculateRangeFairValue()` during export/build |
| External fair values | stored from pasted ChatGPT report |
| Current price external | stored as `market.priceAtAnalysis` |
| Analysis date external | stored as `analysisDate` |

قابلية الاستخدام لمستثمر لديه عشرات الأسهم: جيدة جزئيًا. الجدول والترتيب مفيدان، لكن Home مزدحم لأن فيه مسارين: analysis engine وexternal archive. للرؤية الجديدة يجب جعل external imported reports هي الواجهة الأساسية.

## 20. Historical Analyses

هل يدعم أكثر من تحليل لنفس ticker؟

- نعم في المسار الخارجي: `externalAnalyses[ticker] = [report1, report2, ...]`.
- `listLatestExternalAnalyses()` يعرض أحدث report لكل ticker.
- `getExternalAnalysis(collection,ticker,"latest")` يختار الأول بعد sort desc.
- `externalVersionHistory()` يعرض نسخ ticker.

المسار الداخلي:

- `evaluatedCompanies` لا يسمح بتكرار ticker في القائمة الرئيسية.
- يحتفظ بـ `history` و`valuationVersions` حتى 40 نسخة عند approval، لكنه يعرض latest كأساس.

Overwrite:

- External لا overwrite إلا عند edit لنفس report id.
- Internal upsert يستبدل ticker في القائمة مع تاريخ.

## 21. Source Tracking / Audit Trail

| Audit field | Internal | External | Notes |
| --- | --- | --- | --- |
| source URL | جزئي | `sources[].url` | حسب الإدخال |
| report period | جزئي | `reportPeriod` | external واضح |
| analysis date | موجود | `analysisDate` | external مطلوب |
| source name | موجود | `source` | external default ChatGPT |
| raw pasted text | internal paste محفوظ في workspace، لكن workspace لا persist | `rawAnalysisOriginal` محفوظ | external أفضل |
| original data | source snapshots جزئيًا | raw + normalized report | جيد |
| AI response | parser notes جزئي | لا يحفظ raw AI parser response منفصلًا | نواقص |
| parser version | جزئي | `metadata.parserVersion` | external جيد |
| model version | internal analyst version | `sourceModel` اختياري | external يعتمد على المستخدم |
| user edits | لا/جزئي | `userEditedFields` | external جيد |
| valuation assumptions | internal موجود | external حسب ChatGPT في valuationMethods/notes | external لا يحسب |
| report version | internal versions | external id + importedAt/updatedAt | جيد |

## 22. Editing

External:

- يمكن تعديل fields الأساسية في Preview.
- يمكن تعديل JSON بالكامل.
- `updateExternalAnalysisField()` يسجل `userEditedFields[path] = true`.
- `updateSavedExternalAnalysis()` يحفظ التعديل ويحافظ على `rawAnalysisOriginal`.
- لا يعاد التحليل ولا التقييم.
- لا يوجد undo.
- لا يوجد diff history للتعديلات داخل نفس report، فقط updatedAt.

Internal:

- يمكن تعديل workspace fields.
- بعد edit، الحالة تصبح `Collecting Data` وقد يعاد تشغيل valuation.
- يمكن approval/export بعد validation.
- audit أفضل للنسخ المعتمدة لكنه معقد.

## 23. Duplicate Handling

External:

- Same ticker + same rawHash يعتبر duplicate.
- يعرض warning ويمكن `Save duplicate anyway`.
- نفس ticker بتحليل جديد يحفظ نسخة جديدة.
- إذا غير المستخدم النص قليلًا يتغير hash وقد لا يكتشف duplicate معنويًا.

Internal:

- `upsertEvaluatedCompany()` يمنع duplicate ticker في dashboard.
- التاريخ الداخلي يحفظ previous في `history`.

## 24. Error Handling

Frontend:

- parser failures تعرض notice وvalidation error.
- API failures في search/load تعرض `notice`.
- malformed JSON في editor يضيف error على field `json`.
- duplicate يعرض warning.

Backend:

- `sendApiError()` يعطي رسائل آمنة.
- لا يرجع stack traces.
- `assertConfigured()` يمنع call عند missing env.
- rate limits موجودة.
- body limits موجودة.
- timeouts موجودة.

Storage failures:

- غير ممسوكة في `persist()`.
- إذا فشل `localStorage.setItem()` قد يتعطل update بدون رسالة واضحة.

Network timeout:

- backend يملك timeouts لـ FMP/OpenAI.
- frontend يعرض رسالة عامة.

ما يراه المستخدم:

- غالبًا `notice` أعلى الصفحة.
- لا توجد toast queue أو error recovery guided.

## 25. Tests

`npm` غير متوفر في البيئة الحالية، لذلك `npm test` فشل كأمر shell:

```text
zsh:1: command not found: npm
```

تم تشغيل نفس ملفات الاختبار المعرفة في `package.json` باستخدام Node المرفق:

```text
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version6.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version7.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version8.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/investmentAnalystBrain.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_1AnalyticalEngine.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/version9_2UIUX.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/productionDeployment.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/backendApi.test.mjs &&
/Users/abdullahmoshbab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --experimental-vm-modules tests/externalAnalysisImport.test.mjs
```

Terminal output الفعلي:

```text
(node:21491) ExperimentalWarning: VM Modules is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
Version 6 ranking and color tests passed.
Version 7 valuation workflow tests passed.
Version 8 investment report experience tests passed.
Investment Analyst Brain v1.1 canonical tests passed.
Version 9.1 analytical engine tests passed.
Version 9.2 UI/UX tests passed.
Version 10 production deployment tests passed.
Secure backend API tests passed.
External ChatGPT analysis import tests passed.
```

| Test Suite | File | Purpose | Status | Approx assertion tokens |
| --- | --- | --- | --- | --- |
| Version 6 | `tests/version6.test.mjs` | ranking/color/evaluated companies | PASS | 37 |
| Version 7 | `tests/version7.test.mjs` | valuation workflow | PASS | 25 |
| Version 8 | `tests/version8.test.mjs` | report-first experience | PASS | 17 |
| Analyst Brain | `tests/investmentAnalystBrain.test.mjs` | canonical engine | PASS | 69 |
| Version 9.1 | `tests/version9_1AnalyticalEngine.test.mjs` | analytical protections | PASS | 96 |
| Version 9.2 | `tests/version9_2UIUX.test.mjs` | UI/UX behavior checks | PASS | 74 |
| Production | `tests/productionDeployment.test.mjs` | production server/security | PASS | 56 |
| Backend API | `tests/backendApi.test.mjs` | secure backend API | PASS | 33 |
| External Import | `tests/externalAnalysisImport.test.mjs` | external parser/schema/storage/UI hooks | PASS | 35 |

ملاحظة: العدد تقريبي بناءً على عدد assert patterns لأن الاختبارات لا تستخدم runner يعرض عدادًا رسميًا.

أجزاء غير مغطاة جيدًا:

- فحص browser حقيقي للواجهة الحالية.
- Quota/storage failure.
- Accessibility keyboard/focus.
- XSS fuzzing.
- Real backend deployed URL integration.
- مقارنة visual regression للشاشات الحالية.

محاولة تشغيل التطبيق محليًا:

```text
HOST=127.0.0.1 PORT=4399 node server.mjs

Error: listen EPERM: operation not permitted 127.0.0.1:4399
```

بسبب قيود البيئة، لم يمكن تشغيل local server لفحص UI بصريًا.

## 26. Duplicate / Legacy / Dead Code

Duplicate files:

- `src/`, `public/src/`, `docs/src/` تحتوي نسخًا من نفس المنطق.
- `styles.css`, `public/styles.css`, `docs/styles.css`.
- `service-worker.js`, `public/service-worker.js`, `docs/service-worker.js`.
- `investment_analyst_brain_v1/`, `public/investment_analyst_brain_v1/`, `docs/investment_analyst_brain_v1/`.
- مجلدات تسليم كاملة: `investment-analyst-platform-v10-product-design/` ونسخة ` 2`.

Legacy code:

- `src/engines/*` legacy deterministic engines ما زالت مستخدمة في startup/legacy panels.
- `src/valuationWorkflow/workflow.js` يحتوي workflow داخلي كبير يناقض الرؤية الجديدة إذا بقي ظاهرًا كمسار أساسي.
- `openAiParserRequest()` و`normalizeOpenAiParserResponse()` في `src/providers/apiClient.js` يظهران كـ legacy/browser-side helper exports، رغم أن الاستدعاء الفعلي صار backend.

Potential dead code:

- Normalizers كثيرة في `src/dataPlatform/providerContracts.js` بعد نقل normalization إلى backend تبدو غير مستخدمة حاليًا.
- Documentation/audit folders كثيرة قد تربك reviewer إذا لم يفهم source of truth.

Multiple sources of truth:

- منهجية في `investment_analyst_brain_v1`.
- Canonical logic في `src/analystBrain/engine.js`.
- Policy قديم في `src/valuationWorkflow/workflow.js`.
- Docs كثيرة بأرقام إصدارات مختلفة.

## 27. Security Review

API keys:

- فحص سريع لم يجد مفاتيح حقيقية ظاهرة.
- النتائج كانت placeholders فقط:

```text
./.env.example:4:FMP_API_KEY=replace_on_hosting_platform
./backend/.env.example:4:FMP_API_KEY=replace_on_render_or_railway
```

Backend env:

- يستخدم `FMP_API_KEY`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `FRONTEND_ORIGIN`.
- root server يستخدم أيضًا `APP_ACCESS_PASSWORD`, `APP_SESSION_SECRET`, `APP_ORIGIN`.

CORS:

- `backend/server.mjs` يقيد origin بـ `https://aoodycom-cmyk.github.io` أو env.

XSS:

- UI يستخدم `innerHTML` بكثافة.
- `escapeHtml()` موجود ويستخدم في كثير من المواضع.
- الخطر: أي موضع formatting لا يستخدم escape قد يسمح بحقن HTML من تقرير خارجي.

Untrusted JSON:

- External JSON يتم parse/normalize/validate.
- لا يوجد schema validator package، لكن custom validator جيد كبداية.

Prompt injection:

- سطح الخطر: pasted external analysis.
- AI parser قد يتأثر بالتعليمات داخل النص.
- validation تمنع بعض التلف لكنها لا تثبت "صحة" التحليل.

localStorage sensitivity:

- يخزن raw ChatGPT analysis وربما معلومات استثمارية خاصة.
- لا يوجد encryption أو password على بيانات browser.

Logs:

- لا يظهر أن backend يطبع secrets.

Rate limits/body limits:

- موجودة في `server.mjs` و`backend/server.mjs`.

## 28. Performance Review

نقاط جيدة:

- لا يوجد framework ثقيل.
- Static modules بسيطة.
- API calls تمر عبر backend.
- Service worker لا يخزن API responses.

مشاكل:

- `render()` يعيد بناء `root.innerHTML` بالكامل عند كل `set`.
- `src/ui/components.js` ضخم.
- `styles.css` 5670 سطرًا.
- localStorage يكتب snapshot كبير عند كل set.
- تكرار ملفات `src/public/docs` يزيد مخاطر drift.
- Home مع عشرات التقارير قد يصير بطيئًا بسبب sorting/render الكامل.
- لا يوجد virtualization للجداول.
- لا يوجد lazy loading فعلي للـ panels.

## 29. Maintainability

تقييم:

- Separation of concerns: متوسط. engines مفصولة، لكن UI/store/workflow متشابكة.
- Naming: جيد عمومًا.
- Modularity: جيد في engines/dataPlatform/externalAnalysis، ضعيف في UI/workflow.
- Duplication: عالي بسبب public/docs/src copies.
- Coupling: عالي بين `store.js` و`components.js` و`workflow.js`.
- Testability: جيدة للمحركات، أقل للواجهة.
- Ease of adding features: متوسط، سهل إضافة function، صعب ضمان عدم كسر UX.

أكبر ملفات مخاطرة:

- `src/ui/components.js` 3177 سطر.
- `styles.css` 5670 سطر.
- `src/valuationWorkflow/workflow.js` 1870 سطر.
- `src/analystBrain/engine.js` 1634 سطر.

## 30. UI / UX Full Review

Design system:

- الثيم الحالي مستلهم من شعار coin الجديد، ألوان navy/steel/graphite.
- جيد مؤسسيًا، ولا يعتمد على gold في النص الحالي من التعليمات السابقة.

Typography:

- هناك تحسينات V10، لكن بعض الشاشات يمكن أن تظهر بخط كبير خاصة cards الداخلية كما ظهر في ملاحظات المستخدم.

Spacing/cards:

- البنية premium card-based.
- في بعض الأماكن توجد cards داخل cards، خاصة تفاصيل report/research.

Buttons/inputs:

- أزرار primary/secondary موجودة.
- mobile يحتاج مزيدًا من تقليل الارتفاع والكتلة النصية.

Tables:

- مفيدة Desktop.
- Mobile يعتمد على horizontal scrolling، وهذا عملي لكن أقل راحة.

Navigation:

- `activePanel` جيد للتطبيق الصغير.
- لا توجد URLs عميقة لكل report.

Professional feel:

- الواجهة قريبة من research software، لكن وجود مسارين يشتت المستخدم الجديد.

## 31. Dashboard UX

هل يستطيع المستثمر معرفة بسرعة؟

| معلومة | تظهر؟ | ملاحظات |
| --- | --- | --- |
| اسم السهم | نعم | cards/table |
| السعر | نعم | internal/external |
| Fair Value | نعم | Range/Base حسب المسار |
| Upside | نعم داخليًا، جزئي خارجيًا | external schema فيه upside fields |
| Quality | نعم | score cards |
| Growth | نعم | score cards |
| Valuation | نعم | score cards |
| Risk | نعم | score cards |
| Verdict | نعم | recommendation/verdict |
| آخر تاريخ تحليل | نعم | analysisDate/evaluationDate |

ما يجب أن يظهر في Home للرؤية الجديدة:

- ticker/company.
- verdict.
- analysis date/report period.
- price at analysis.
- final fair value/base.
- upside/downside.
- overall/quality/growth/valuation/risk.
- latest only by default.

ما يجب أن يكون داخل التفاصيل:

- raw analysis.
- valuation methods details.
- full risks/catalysts/watch items.
- version history.
- sources.

## 32. Company Report UX

External report:

- أهم شيء يظهر فوق: ticker/company/verdict/thesis.
- يحتاج أن يعرض `Final Fair Value` و`Upside` أعلى بوضوح أكثر، وليس Base فقط.
- Bear/Base/Bull واضح كـ valuation summary.
- المخاطر والأطروحة موجودة collapsed.
- مناسب كمختصر، لكنه يحتاج one-page information hierarchy أقوى.

Internal report:

- report-first جيد.
- الصفحة طويلة، لكن collapsible details تخفف.
- يمكن فهم decision سريعًا من `decisionCenterCard()`.
- فيه تكرار بين hero, quick summary, valuation visual, scenario cards.

## 33. One-Page Investment Summary

التصميم المقترح للرؤية الجديدة، بدون تغيير الآن:

ظاهر دائمًا:

- Header:
  - Company
  - Ticker
  - Analysis Date
  - Report Period
  - Price at Analysis
  - Current Price إذا توفر لاحقًا
- Decision strip:
  - Verdict
  - Overall score
  - Confidence إذا أضيفت للـ external schema
- Scores:
  - Quality
  - Growth
  - Valuation
  - Risk
  - Overall
- Fair Value:
  - Bear
  - Base
  - Bull
  - Final Fair Value / weightedFairValue
  - Upside/Downside
- Thesis short.
- Top 3 risks.
- Top 3 catalysts/watch items.

Collapsed:

- Full thesis.
- Valuation methods.
- Financial highlights.
- Earnings Quality.
- Sources.
- Raw ChatGPT Analysis.
- Version History.

## 34. Mobile UX

الحالة:

- Mobile-first مدعوم في CSS.
- هناك اختبارات overflow في إصدارات سابقة.
- search keyboard bug تم التعامل معه بتعديل state مباشرة بدل re-render عند كل حرف.

المشاكل:

- الجداول تحتاج horizontal scroll.
- بعض cards النصية كبيرة وتدخل باتجاه خاطئ في RTL حسب ملاحظة المستخدم.
- JSON editor على الجوال صعب.
- الأزرار الكثيرة في External Report actions قد تكون مزعجة على iPhone.

التوصية:

- External report mobile يجب أن يكون صفحة واحدة card stack.
- نقل JSON editor إلى Advanced collapsed.
- جعل delete/export/copy في action sheet أو details.

## 35. Desktop UX

الحالة:

- Desktop يستفيد من الجداول والcolumns.
- max-width والفراغات جيدة نسبيًا.

المشاكل:

- Home يمكن أن يبدو كأنه dashboard ثقيل.
- لا يوجد side panel ثابت لتاريخ الشركة.
- report layout يعتمد على stacked cards أكثر من institutional memo.

التوصية:

- Desktop report: عمود رئيسي للمذكرة، وrail جانبي للأرقام.
- Dashboard: table dense لكن readable.

## 36. Accessibility

إيجابيات:

- contrast palette قوي غالبًا.
- buttons لديها نص.
- بعض form labels موجودة.

نواقص:

- لا توجد ARIA واضحة للتنقل/tab panels.
- `innerHTML` rendering الكامل قد يفقد focus.
- لا توجد focus management للـ modals/advanced panels.
- الاعتماد على اللون موجود في بعض badges، وإن كان النص موجودًا غالبًا.
- keyboard navigation غير مثبت باختبار.
- click targets على mobile تحتاج فحص بصري.

## 37. Loading / Empty / Error States

موجود:

- no companies empty state في Home.
- loading/processing notices.
- invalid paste validation.
- duplicate analysis warning.
- API failure notice.
- offline notice في `src/pwa.js`.

ناقص:

- save failure بسبب storage quota.
- backend not configured state على GitHub Pages بشكل واضح جدًا.
- success state بعد export/copy أفضل.
- retry action للـ OpenAI parser.

## 38. Forms UX

الحالة:

- الحقول لها labels.
- inputs وtextarea موجودة.
- validation تظهر كقائمة errors.

المشاكل:

- internal workflow فيه حقول كثيرة جدًا للرؤية الجديدة.
- External Preview جيد لكنه لا يزال technical بسبب JSON editor.
- number formatting في الإدخال محدود.
- destructive actions تعتمد على `window.confirm`.

التوصية:

- للرؤية الجديدة: paste box واحد، preview بسيط، advanced JSON editor collapsed.
- destructive actions في confirm panel مصمم بدل confirm browser.

## 39. Data Visualization

الموجود:

- scenario cards.
- fair value visual.
- mini charts في institutional research.
- score cards.
- comparison table.

الفائدة:

- Fair Value range مفيد جدًا.
- Scenario cards مفيدة.
- mini charts مفيدة إذا كانت البيانات موثقة.

لا تضف:

- charts decorative.
- rainbow charts.
- visualizations بدون قرار استثماري.

المقترح للرؤية الجديدة:

- Fair Value range.
- Score trend بين تحليلات ticker.
- Historical fair value vs price at analysis.
- Verdict history.

## 40. Design System Recommendation

اعتمادًا على هوية logo الحالية:

| Token | Recommendation |
| --- | --- |
| Background | `#08131F` |
| Secondary background | `#102030` |
| Cards | `#1A232E` |
| Borders | `#303A46` |
| Primary text | `#E8ECEF` |
| Secondary text | `#AAB5C2` |
| Positive | `#3FBF7F` |
| Negative | `#C95757` |
| Warning | `#D58A3B` |
| Link/highlight | `#5E88B8` |
| Typography | 14-16 body, 20-28 section headers, لا تستخدم hero scale داخل cards |
| Spacing | 8px base grid، mobile cards compact |
| Cards | subtle border + soft shadow، radius 8-14 حسب السياق |
| Tables | sticky ticker/rank، numbers aligned LTR |
| Badges | text + color، لا تعتمد على اللون فقط |
| Numbers | USD with decimals only when needed |
| Dates | ISO or localized short, ثابت |

## 41. UI/UX Scores

| Area | Score /10 |
| --- | --- |
| Visual Design | 7.8 |
| Consistency | 7.0 |
| Information Hierarchy | 7.2 |
| Dashboard UX | 7.0 |
| Company Report UX | 7.4 |
| Mobile UX | 6.8 |
| Desktop UX | 7.3 |
| Accessibility | 5.8 |
| Navigation | 6.7 |
| Forms | 6.5 |
| Error States | 6.6 |
| Professional Investment Feel | 7.6 |

Overall UI/UX Score: 7.0/10

## 42. Current Strengths

- `src/externalAnalysis/*` فصل جيد لمسار الرؤية الجديدة.
- validation يمنع حفظ External report ناقص بشكل خطير.
- raw pasted text محفوظ.
- duplicate handling موجود.
- version history لكل ticker في external path.
- backend آمن نسبيًا ولا يكشف مفاتيح.
- test suite واسع نسبيًا.
- data platform يحتفظ source/timestamp/confidence/update status.
- deterministic engines موثقة ومختبرة.
- PWA basics موجودة.
- اللغة العربية RTL موجودة.

## 43. Current Weaknesses

Critical:

- لا توجد Database أو backup، وهذا خطر كبير إذا أصبح التطبيق أرشيفًا.
- GitHub Pages يحتاج `FRANKLIN_BACKEND_URL` مضبوطًا وإلا تفشل API.

High:

- المحرك المالي الداخلي لا يزال ظاهرًا ومركزيًا رغم الرؤية الجديدة.
- `components.js` و`workflow.js` ضخمان وصعبان.
- duplication بين `src`, `public`, `docs`.
- no localStorage migration.

Medium:

- External schema لا يحتوي confidence صريح للتقرير كاملًا.
- External validation لا يتحقق من scenario ordering أو final fair value consistency.
- JSON editor ظاهر داخل preview وقد يربك المستخدم.
- لا توجد visual browser tests حالية في هذه البيئة.

Low:

- version numbers غير متسقة.
- docs كثيرة وقديمة بجانب source.
- بعض helper functions تبدو legacy.

## 44. Important Files

| File | Purpose | Importance | Should Modify Later? | Notes |
| --- | --- | --- | --- | --- |
| `src/main.js` | app entry | High | Low | بسيط |
| `src/state/store.js` | state/actions/persistence | Critical | High | يحتاج فصل external/internal |
| `src/ui/components.js` | كل UI تقريبًا | Critical | High | أكبر technical debt |
| `src/externalAnalysis/schema.js` | External report schema | Critical للرؤية الجديدة | High | جيد كبداية |
| `src/externalAnalysis/parser.js` | JSON/text parsing orchestrator | Critical | Medium | واضح |
| `src/externalAnalysis/externalAnalysisSchemaValidator.js` | validation | Critical | High | يحتاج قواعد إضافية |
| `src/externalAnalysis/storage.js` | history/duplicate/delete | Critical | High | يحتاج DB لاحقًا |
| `src/externalAnalysis/reportAdapter.js` | home/export adapter | High | Medium | يفصل العرض عن schema |
| `src/providers/apiClient.js` | frontend API calls | High | Medium | فيه legacy helper |
| `src/providers/backendEndpoint.js` | backend URL resolution | High | Medium | مهم لـ GitHub Pages |
| `backend/server.mjs` | secure API backend | Critical | Medium | جيد ومختبر |
| `server.mjs` | full app server | High | Medium | production/private hosting |
| `src/dataPlatform/dataPlatform.js` | source-aware fields | High | Medium | مفيد حتى للرؤية الجديدة جزئيًا |
| `src/analystBrain/engine.js` | internal analyst engine | High legacy | Low/Hide | لا يجب استخدامه في external path |
| `src/valuationWorkflow/workflow.js` | internal workflow | High legacy | Low/Hide | كبير |
| `tests/externalAnalysisImport.test.mjs` | external path tests | Critical | High | مهم للرؤية الجديدة |
| `styles.css` | design system/UI | High | Medium | ضخم |
| `CHANGELOG.md` | version history | Medium | Medium | أحدث من README |

## 45. Readiness for New Vision

الرؤية الجديدة:

```text
ChatGPT analyzes outside the app
-> user pastes output
-> app parses
-> validates
-> previews
-> saves
-> displays
-> keeps history
```

موجود ويمكن إعادة استخدامه:

- `externalAnalysis/schema.js`
- `externalAnalysis/parser.js`
- `externalAnalysis/externalAnalysisSchemaValidator.js`
- `externalAnalysis/storage.js`
- `externalAnalysis/reportAdapter.js`
- `externalImportPanel()`
- `externalPreviewPanel()`
- `externalAnalysisReportView()`
- `externalAnalyses` في state/localStorage
- `/api/parse-external-analysis`

يحتاج تعديلًا:

- جعل Home يركز على External imported reports.
- تقليل أو إخفاء New Analysis الداخلي.
- توسيع External schema ليتضمن `confidence`, `finalFairValue`, `currentPriceSnapshot`, `model`, `reportVersion`.
- تحسين validation.
- إضافة export/import كامل.
- إضافة Database/IndexedDB.

يجب تجاوزه في هذا المسار:

- `runEquityResearch()`.
- `runValuation()`.
- `runDecision()`.
- `runAnalystBrainEngine()`.
- `runFixedMethodologyValuation()`.
- ranking الداخلي إذا كان يعيد حساب investment score. يمكن استخدام sort/filter فقط على القيم المخزنة.

هل يمكن الاحتفاظ بالمحرك المالي القديم؟

- نعم، لكن كـ "Advanced/Internal Legacy Analyst" مخفي أو اختياري.
- لا يجب أن يتداخل مع External reports.

إخفاء أم حذف؟

- الآن: إخفاء من UI الأساسي.
- لاحقًا: حذف بعد استقرار external archive وتصدير/ترحيل بيانات المستخدم.

## 46. Recommended External Analysis Architecture

المعمارية المقترحة:

```text
External ChatGPT Analysis
-> Paste Input
-> Parser
   -> Local JSON Parser
   -> Backend OpenAI Parser for unstructured text
-> Normalizer
-> Schema Validator
-> Preview/Edit
-> Storage Adapter
   -> localStorage now
   -> IndexedDB/Cloud DB later
-> Report Renderer
-> History per ticker
-> Dashboard latest view
```

فصل كامل عن:

- `src/analystBrain/engine.js`
- `src/valuationWorkflow/workflow.js`
- `src/engines/valuationEngine.js`
- `src/engines/decisionEngine.js`
- `src/engines/scoringEngines.js`

يمكن مشاركة:

- i18n labels.
- formatting helpers.
- market color system بشرط ألا يعيد حساب verdict.
- backend OpenAI parser.
- export utilities.

## 47. Recommended External Analysis Schema

Schema مقترح للرؤية النهائية، مبني على الموجود:

```json
{
  "schemaVersion": "external-analysis-report/v2",
  "analysisOrigin": "external_chatgpt",
  "company": {
    "name": null,
    "ticker": null,
    "sector": null,
    "industry": null,
    "currency": "USD"
  },
  "metadata": {
    "analysisDate": null,
    "reportPeriod": null,
    "priceAtAnalysis": null,
    "currentPrice": null,
    "source": "ChatGPT",
    "model": null,
    "parserVersion": null,
    "reportVersion": null,
    "confidence": null,
    "importedAt": null,
    "updatedAt": null,
    "rawHash": null
  },
  "scores": {
    "quality": null,
    "growth": null,
    "valuation": null,
    "risk": null,
    "overall": null
  },
  "fairValue": {
    "bear": null,
    "base": null,
    "bull": null,
    "finalFairValue": null,
    "upsideDownsidePct": null
  },
  "valuationMethods": {
    "DCF": null,
    "P/E": null,
    "EV/EBITDA": null,
    "P/S": null,
    "PEG": null,
    "SOTP": null,
    "other": null
  },
  "financialHighlights": {
    "revenue": null,
    "revenueGrowth": null,
    "operatingIncome": null,
    "operatingMargin": null,
    "epsReported": null,
    "epsNormalized": null,
    "ocf": null,
    "fcf": null,
    "capex": null,
    "cash": null,
    "debt": null
  },
  "analysis": {
    "thesis": null,
    "qualitySummary": null,
    "growthSummary": null,
    "valuationSummary": null,
    "riskSummary": null,
    "earningsQuality": null,
    "strengths": [],
    "weaknesses": [],
    "risks": [],
    "catalysts": [],
    "watchItems": [],
    "verdict": null
  },
  "sources": [],
  "rawOriginalChatGPTAnalysis": "",
  "userEditedFields": {},
  "historyMetadata": {
    "previousReportId": null,
    "revision": 1
  }
}
```

قاعدة مهمة: missing = `null`، وليس `0`.

## 48. Import UX Recommendation

المسار الأفضل:

```text
Home
-> زر واضح: Import ChatGPT Analysis
-> صفحة/Sheet كاملة على الجوال
-> Paste textarea كبير
-> Parse
-> Preview مختصر
-> Edit only important fields
-> Advanced JSON collapsed
-> Save
-> Open Company Report
```

أفضل مكان للزر:

- أعلى Home بجانب search، لكن بلغة واضحة: "استيراد تحليل ChatGPT".

Modal أم صفحة:

- iPhone: صفحة كاملة أفضل.
- Desktop: يمكن panel أو centered modal واسع.

Errors:

- Validation errors قرب field.
- Summary أعلى preview.

Warnings:

- duplicate.
- missing optional fields.
- source/model missing.

Duplicate:

- افتراضيًا لا تحفظ duplicate.
- أظهر "فتح النسخة الموجودة" و"حفظ كنسخة جديدة".

Save success:

- بعد save افتح التقرير مباشرة.
- أظهر "تم حفظ التحليل".

Mobile:

- textarea لا يقل عن 45vh.
- actions sticky bottom.
- JSON editor collapsed.

## 49. Historical Analysis Architecture

الهدف:

```text
AMZN
├── Q2 2026
├── Q3 2026
└── Q4 2026
```

النموذج:

```json
{
  "externalAnalyses": {
    "AMZN": [
      {
        "id": "AMZN-2026-Q4-...",
        "analysisDate": "2026-10-25",
        "reportPeriod": "Q3 2026",
        "metadata": { "revision": 1 }
      }
    ]
  }
}
```

Latest default:

- أعلى `analysisDate`.
- عند التعادل، أعلى `metadata.updatedAt`.

Previous reports:

- Timeline في report.
- Compare previous/latest:
  - Fair Value change.
  - Score changes.
  - Verdict change.
  - New risks/catalysts.

ملاحظة: التخزين الحالي يدعم الأساس، لكنه يحتاج UI أقوى للمقارنة التاريخية.

## 50. Gap Analysis

| Requirement | Exists | Partial | Missing | Files Affected | Recommended Change |
| --- | --- | --- | --- | --- | --- |
| Paste external ChatGPT output | نعم | | | `components.js`, `store.js` | اجعله CTA الرئيسي |
| Parse JSON | نعم | | | `externalAnalysis/parser.js` | جيد |
| Parse unstructured text | نعم | | | backend + apiClient | يحتاج retry/status |
| Validate schema | نعم | | | validator | أضف rules أكثر |
| Preview before save | نعم | | | `externalPreviewPanel()` | بسط الواجهة |
| Save without recalculation | نعم | | | `externalAnalysis/storage.js` | حافظ عليه |
| History per ticker | نعم | | | storage/UI | أضف comparison |
| Raw original محفوظ | نعم | | | schema | جيد |
| User edits audit | جزئي | نعم | | schema | أضف edit timestamps/diff |
| Database | | | نعم | new | مطلوب للإنتاج |
| Backup/export all | | جزئي | | store/export | أضف full backup |
| Home focuses on archive | | نعم | | UI | إخفاء internal engine |
| No internal financial analysis in new path | نعم | | | external UI/storage | اختبر أكثر |
| Mobile-first import | | جزئي | | CSS/UI | يحتاج polish |
| Accessibility | | جزئي | | UI/CSS | أضف ARIA/focus tests |

## 51. Recommended Implementation Plan

Phase 1: Freeze external schema/storage

- Goal: تثبيت `ExternalAnalysisReport v2`.
- Files: `src/externalAnalysis/schema.js`, validator, tests.
- Tests: JSON parse, missing null, validation rules.
- Risk: ترحيل v1.

Phase 2: Import UX primary path

- Goal: Home يوجه إلى import لا internal valuation.
- Files: `src/ui/components.js`, `styles.css`, `i18n/language.js`.
- Tests: UI text, mobile overflow.
- Risk: إرباك مستخدمين يعتمدون على internal workflow.

Phase 3: Report viewer redesign by data only

- Goal: report page تقرأ external schema فقط.
- Files: `externalAnalysis/reportAdapter.js`, `components.js`.
- Tests: no engine calls.
- Risk: نقص حقول في التقارير القديمة.

Phase 4: Historical comparison

- Goal: مقارنة تحليلات نفس ticker.
- Files: `storage.js`, UI.
- Tests: latest selection, version ordering.
- Risk: schema drift.

Phase 5: Storage hardening

- Goal: backup/export/import all، quota handling.
- Files: `store.js`, storage adapters.
- Tests: quota mock, malformed state.
- Risk: localStorage limits.

Phase 6: Optional cloud database

- Goal: persistent archive multi-device.
- Files: new storage service/backend routes.
- Tests: CRUD, auth.
- Risk: security/auth.

Phase 7: Hide legacy analyst path

- Goal: لا يظهر المحرك الداخلي للمستخدم العادي.
- Files: UI/navigation only.
- Tests: external path unaffected.
- Risk: كسر demo/internal tests.

## 52. Backward Compatibility

كيف نضيف النظام الجديد بدون كسر القديم:

- احتفظ بـ `equityResearchV4State` كما هو.
- أضف `externalAnalysesV2` أو `schemaVersion` داخل `externalAnalyses`.
- عند load:
  - normalize v1 reports.
  - لا تحذف invalid reports، اعرضها كـ needs review.
- لا تلمس `evaluatedCompanies` القديمة.
- اجعل Home يعرض external first وinternal in advanced tab.
- حافظ على tests الحالية.
- أضف migration pure function لا تعمل destructive.

## 53. What Should Eventually Be Removed or Hidden?

مفيد ويجب الاحتفاظ به:

- `externalAnalysis/*`.
- backend parser.
- i18n.
- design system.
- export/copy/print.
- data formatting utilities.

احتفظ به مؤقتًا:

- `src/analystBrain/engine.js`.
- `src/valuationWorkflow/workflow.js`.
- `src/engines/*`.
- `golden-cases`.

يجب إخفاؤه من UI الأساسي:

- New internal valuation analysis.
- manual financial forms.
- methodology override panels.
- legacy summary/valuation/quality/growth/risk panels.

يمكن حذفه لاحقًا بعد استقرار النظام:

- legacy internal workflow من الواجهة.
- unused provider normalizers.
- duplicated delivery folders.
- duplicate docs/copies بعد اعتماد build/deploy process.

لا تحذف أي شيء الآن.

## 54. Final Technical Assessment

| Area | Score /10 |
| --- | --- |
| Architecture | 7.0 |
| Data Model | 7.2 |
| Storage | 4.8 |
| Parsing | 7.4 |
| Validation | 7.0 |
| AI Integration | 7.1 |
| Financial Engine | 8.0 |
| Valuation Engine | 7.6 |
| Testing | 8.0 |
| Maintainability | 5.8 |
| Security | 7.3 |
| Performance | 6.4 |
| UI Design | 7.5 |
| UX | 6.9 |
| Mobile | 6.8 |
| Report Quality | 7.4 |
| Readiness for External ChatGPT Import | 7.4 |

Overall Technical Score: 7.0/10

## 55. Top Priorities

| Priority | المشكلة | الحل | الملفات المتأثرة | Difficulty | Impact | ضروري للرؤية الجديدة؟ |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | لا توجد Database/backup | إضافة storage adapter مع export/import كامل أولًا | `store.js`, `externalAnalysis/storage.js` | Medium | High | نعم |
| 2 | Home لا يزال يمزج external/internal | جعل Import ChatGPT هو المسار الأساسي | `components.js`, `styles.css` | Medium | High | نعم |
| 3 | Backend URL فارغ على GitHub Pages | ضبط `backend-config.js` أو UI warning | `docs/backend-config.js` | Low | High | نعم |
| 4 | External schema ناقص confidence/finalFairValue واضح | إصدار `external-analysis-report/v2` | `schema.js`, validator, tests | Medium | High | نعم |
| 5 | validation لا تتحقق من scenario consistency | Bear/Base/Bull ordering وweighted checks | validator | Low | High | نعم |
| 6 | localStorage failures غير ممسوكة | try/catch وuser recovery/export | `store.js` | Medium | High | نعم |
| 7 | UI ضخم وصعب | فصل external UI إلى module | `components.js` -> new files | High | High | نعم |
| 8 | JSON editor مخيف للمستخدم | جعله Advanced collapsed | `components.js`, CSS | Low | Medium | نعم |
| 9 | لا يوجد full archive export | Export all reports JSON | `store.js`, UI | Low | High | نعم |
| 10 | لا يوجد import backup | Import archive JSON مع validation | storage/UI | Medium | High | نعم |
| 11 | تكرار `src/public/docs` | إنشاء script sync أو build process | project scripts | Medium | Medium | تحسين قوي |
| 12 | Accessibility غير مثبت | إضافة keyboard/focus/ARIA checks | UI/tests | Medium | Medium | نعم للجودة |
| 13 | legacy engine يتداخل ذهنيًا | إخفاؤه في Advanced | UI/navigation | Low | High | نعم |
| 14 | لا يوجد visual QA حالي | Playwright mobile screenshots | tests/scripts | Medium | Medium | تحسين |
| 15 | docs كثيرة ومتناقضة | وثيقة source-of-truth مختصرة | README/ARCHITECTURE لاحقًا | Low | Medium | تحسين |

## Final Notes

تم إنشاء هذا التقرير فقط. لم يتم تعديل الكود أو حذف ملفات أو إضافة ميزات.

الخلاصة العملية: المشروع قريب من الرؤية الجديدة لأنه يملك مسار External ChatGPT Import مستقلًا، لكن يحتاج إعادة ترتيب المنتج حول هذا المسار، وتقوية التخزين، وفصل الواجهة الكبيرة، وإخفاء المحرك المالي الداخلي من التجربة الأساسية.
