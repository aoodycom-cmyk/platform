import { createCompanyShell } from "../data/sampleData.js";
import { DEMO_ANALYSIS_FIXTURE } from "../data/demoFlow.js";
import { createDemoExternalAnalysisReport, createDemoExternalAnalysisScenario } from "../data/externalDemo.js";
import { buildUnifiedDataCompany, mergeCompanyDataHistory } from "../dataPlatform/dataPlatform.js";
import { buildEvaluatedCompany, upsertEvaluatedCompany } from "../domain/evaluatedCompanies.js";
import { toNumber } from "../domain/financialMetrics.js";
import { rankEvaluatedCompanies } from "../engines/rankingEngine.js";
import { runEquityResearch } from "../engines/researchEngine.js";
import { loadAnalystBrainMethodology } from "../analystBrain/methodology.js";
import { normalizeLanguage, setLanguageContext } from "../i18n/language.js";
import { buildInstitutionalResearch } from "../research/institutionalResearch.js";
import { parseExternalAnalysisBlock, parseExternalAnalysisSupplementBlock, parseInvestmentAnalystBlock } from "../providers/apiClient.js";
import { parseExternalAnalysisInput } from "../externalAnalysis/parser.js";
import { normalizeExternalAnalysisReport, updateExternalAnalysisField } from "../externalAnalysis/schema.js";
import { validateExternalAnalysisReport } from "../externalAnalysis/externalAnalysisSchemaValidator.js";
import { attachCompletionStatus, buildMissingRequirementsPrompt } from "../externalAnalysis/missingFields.js";
import { buildExternalAnalysisJsonTemplate, buildFullAnalysisPrompt, buildNewEarningsAnalysisPrompt } from "../externalAnalysis/chatgptContract.js";
import {
  createInvestmentDataBackup,
  mergeInvestmentDataBackup,
  parseInvestmentDataBackup,
  replaceInvestmentDataBackup
} from "../externalAnalysis/backup.js";
import {
  attachRequirementSetIdentityToReport,
  applyHistoricalRequirementLifecycle,
  normalizeHistoricalRequirementSets,
  prepareHistoricalRequirementEvaluation
} from "../externalAnalysis/historicalRequirements.js";
import { mergeExternalAnalysisSupplement } from "../externalAnalysis/supplementMerge.js";
import { parseExternalAnalysisSupplement } from "../externalAnalysis/supplementParser.js";
import { validateExternalAnalysisSupplement } from "../externalAnalysis/supplementValidator.js";
import {
  deleteAllExternalAnalysesForTicker,
  deleteExternalAnalysis,
  findDuplicateExternalAnalysis,
  getExternalAnalysis,
  normalizeExternalAnalysesCollection,
  saveExternalAnalysis,
  updateSavedExternalAnalysis
} from "../externalAnalysis/storage.js";
import {
  applyParsedPreview,
  approveWorkspaceValuation,
  confirmWorkspaceField,
  createValuationWorkspace,
  markWorkspaceFieldNotAvailable,
  parseWorkspacePaste,
  rejectWorkspaceField,
  runFixedMethodologyValuation,
  runInvestmentAnalystBrainValuation,
  setMethodologyOverride,
  updateAnalystBrainPaste,
  updatePasteDraft,
  updateSectionSource,
  updateWorkspaceField
} from "../valuationWorkflow/workflow.js";

const STORAGE_KEY = "equityResearchV4State";

export function createStore() {
  const saved = load();
  const initialLanguage = normalizeLanguage(saved.language || localStorage.getItem("equityResearchLanguage") || "ar");
  setLanguageContext(initialLanguage);
  const initialManualInputs = saved.manualInputs || { averageCost: "", morningstarFairValue: "", notes: "" };
  const initialEvaluatedCompanies = rankEvaluatedCompanies(saved.evaluatedCompanies || []).map(({ rankingPosition, ...item }) => item);
  const initialEvaluatedSort = normalizeEvaluatedSort(saved.evaluatedSort);
  const initialExternalAnalyses = normalizeExternalAnalysesCollection(saved.externalAnalyses || {});
  const initialHistoricalRequirementSets = normalizeHistoricalRequirementSets(saved.historicalRequirementSets || {}, initialExternalAnalyses);
  const initialCompany = buildUnifiedDataCompany(saved.company || createCompanyShell("NVDA"), {
    manualInputs: initialManualInputs,
    previousCompany: saved.company || null,
    providers: saved.company?.dataPlatform?.providers || []
  });
  const state = {
    company: initialCompany,
    manualInputs: initialManualInputs,
    research: runEquityResearch(initialCompany, initialManualInputs),
    institutionalResearch: null,
    query: "",
    searchResults: [],
    loading: false,
    processingStage: "idle",
    notice: "",
    language: initialLanguage,
    theme: saved.theme || "dark",
    activePanel: "home",
    evaluatedSort: initialEvaluatedSort,
    rankingFilter: saved.rankingFilter || "all",
    sectorFilter: saved.sectorFilter || "all",
    compareSelectedTickers: saved.compareSelectedTickers || [],
    comparisonOpen: saved.comparisonOpen || false,
    evaluatedCompanies: initialEvaluatedCompanies,
    externalAnalyses: initialExternalAnalyses,
    historicalRequirementSets: initialHistoricalRequirementSets,
    externalImport: createExternalImportState(),
    externalReportSelection: saved.externalReportSelection || null,
    restorePreview: null,
    valuationWorkspace: saved.valuationWorkspace || null,
    history: saved.history || [],
    watchList: saved.watchList || [],
    watchDraft: saved.watchDraft || { thesis: "", targetPrice: "", reviewDate: "", notes: "" }
  };
  state.institutionalResearch = buildInstitutionalResearch(state.research);

  const listeners = new Set();

  function set(patch) {
    Object.assign(state, typeof patch === "function" ? patch(state) : patch);
    persist(state);
    listeners.forEach((listener) => listener(state));
  }

  function updateResearch() {
    const research = runEquityResearch(state.company, state.manualInputs);
    const patch = { research, institutionalResearch: buildInstitutionalResearch(research) };
    const previous = state.evaluatedCompanies.find((item) => item.ticker === state.company.ticker);
    if (previous) {
      const evaluated = buildEvaluatedCompany({ company: state.company, research, manualInputs: state.manualInputs, previous });
      patch.evaluatedCompanies = upsertEvaluatedCompany(state.evaluatedCompanies, evaluated);
    }
    set(patch);
  }

  function setCompany(company) {
    const mergedCompany = mergeCompanyDataHistory(state.company, company);
    const research = runEquityResearch(mergedCompany, state.manualInputs);
    const previous = state.evaluatedCompanies.find((item) => item.ticker === mergedCompany.ticker);
    const evaluated = buildEvaluatedCompany({ company: mergedCompany, research, manualInputs: state.manualInputs, previous });
    set({
      company: mergedCompany,
      activePanel: "summary",
      loading: false,
      processingStage: "idle",
      notice: "",
      research,
      institutionalResearch: buildInstitutionalResearch(research),
      evaluatedCompanies: upsertEvaluatedCompany(state.evaluatedCompanies, evaluated)
    });
  }

  function openValuationWorkspace(company) {
    const workspace = createValuationWorkspace(company, state.valuationWorkspace?.ticker === company.ticker ? state.valuationWorkspace : null);
    set({
      company,
      valuationWorkspace: workspace,
      activePanel: "workspace",
      loading: false,
      processingStage: "idle",
      notice: "",
      searchResults: []
    });
  }

  function startBlankAnalysis() {
    const clean = String(state.query || "").trim();
    const ticker = clean && /^[a-z0-9.-]{1,12}$/i.test(clean) ? clean.toUpperCase() : "NEW";
    const company = {
      ...createCompanyShell(ticker),
      ticker,
      name: clean && clean.toUpperCase() !== ticker ? clean : (ticker === "NEW" ? "" : ticker),
      quote: { price: null }
    };
    set({
      company,
      valuationWorkspace: createValuationWorkspace(company),
      activePanel: "workspace",
      loading: false,
      processingStage: "idle",
      notice: state.language === "ar"
        ? "ألصق بيانات الشركة في الصندوق الرئيسي أو استخدم البيانات التجريبية."
        : "Paste the company data into the main box or load the demo data.",
      searchResults: []
    });
  }

  function loadDemoAnalysis() {
    let workspace = createValuationWorkspace(DEMO_ANALYSIS_FIXTURE.company);
    workspace = updateAnalystBrainPaste(workspace, DEMO_ANALYSIS_FIXTURE.pasteText);
    for (const [field, value] of Object.entries(DEMO_ANALYSIS_FIXTURE.fields)) {
      workspace = updateWorkspaceField(workspace, field, value, {
        source: DEMO_ANALYSIS_FIXTURE.source,
        sourceDate: DEMO_ANALYSIS_FIXTURE.sourceDate,
        mode: "Automatic",
        confidence: 0.96,
        userConfirmed: true,
        originalTextReference: "Loaded from demo fixture"
      });
    }
    set({
      company: DEMO_ANALYSIS_FIXTURE.company,
      valuationWorkspace: workspace,
      activePanel: "workspace",
      loading: false,
      processingStage: "idle",
      notice: state.language === "ar"
        ? "تم تحميل بيانات تجريبية. راجع البيانات ثم شغّل التحليل."
        : "Demo data loaded. Review the data, then run the analysis.",
      searchResults: []
    });
  }

  function loadDemoExternalAnalysis() {
    const reports = createDemoExternalAnalysisScenario();
    let externalAnalyses = state.externalAnalyses;
    let historicalRequirementSets = state.historicalRequirementSets;
    let latestReport = null;
    for (const report of reports) {
      const validation = validateExternalAnalysisReport(report);
      const prepared = prepareExternalDraftReport(report, validation, historicalRequirementSets);
      const reportForSave = prepareExternalReportForSave(prepared.report);
      const result = saveExternalAnalysis(externalAnalyses, reportForSave, {
        allowDuplicate: true,
        now: new Date(reportForSave.metadata?.importedAt || reportForSave.analysisDate || Date.now())
      });
      externalAnalyses = result.collection;
      historicalRequirementSets = applyHistoricalRequirementLifecycle(
        historicalRequirementSets,
        result.report,
        prepared.requirementMatch,
        new Date(reportForSave.metadata?.importedAt || Date.now())
      );
      latestReport = result.report;
    }
    const selectedReport = latestReport || createDemoExternalAnalysisReport();
    set({
      externalAnalyses,
      historicalRequirementSets,
      externalImport: createExternalImportState(),
      externalReportSelection: { ticker: selectedReport.company.ticker, reportId: selectedReport.id },
      company: externalReportCompanyShell(selectedReport),
      activePanel: "external-report",
      loading: false,
      processingStage: "idle",
      notice: state.language === "ar"
        ? "تم فتح سيناريو DEMO خارجي يحتوي على تقرير سابق وتقرير أرباح يقيّم المتطلبات."
        : "DEMO external scenario opened with a prior report and an earnings report that evaluates requirements.",
      searchResults: []
    });
  }

  function openExternalImport() {
    set({
      externalImport: createExternalImportState(),
      activePanel: "external-import",
      loading: false,
      processingStage: "idle",
      notice: "",
      searchResults: []
    });
  }

  async function parseExternalImport(text, context = {}) {
    const rawText = String(text || "").trim();
    const tickerHint = normalizeTickerHint(context.tickerHint ?? state.externalImport?.tickerHint);
    if (!rawText) {
      set({ notice: state.language === "ar" ? "ألصق تحليل ChatGPT أولًا." : "Paste the ChatGPT analysis first." });
      return;
    }
    set({
      loading: true,
      processingStage: "parsing-external-analysis",
      externalImport: {
        ...state.externalImport,
        rawText,
        tickerHint,
        stage: "parsing",
        validation: { valid: false, errors: [], warnings: [] },
        duplicate: null,
        parserSource: null,
        usedAi: false
      },
      notice: state.language === "ar" ? "جاري استخراج التحليل بدون إعادة حساب الأرقام..." : "Parsing the report without recalculating numbers..."
    });
    try {
      const parsed = await parseExternalAnalysisInput(rawText, {
        parseUnstructured: (inputText) => parseExternalAnalysisBlock({ text: inputText, language: state.language })
      });
      if (!parsed.report) throw new Error("External parser did not return a report.");
      const parsedReport = applyImportContextHints(parsed.report, { tickerHint });
      const validation = validateExternalAnalysisReport(parsedReport);
      const prepared = prepareExternalDraftReport(parsedReport, validation, state.historicalRequirementSets);
      const duplicate = findDuplicateExternalAnalysis(state.externalAnalyses, prepared.report);
      set({
        loading: false,
        processingStage: "idle",
        externalImport: {
          ...state.externalImport,
          rawText,
          tickerHint,
          draftReport: prepared.report,
          draftJson: JSON.stringify(prepared.report, null, 2),
          validation: prepared.validation,
          duplicate,
          requirementMatch: prepared.requirementMatch,
          parserSource: parsed.parserSource,
          usedAi: parsed.usedAi,
          stage: "preview"
        },
        notice: validation.valid
          ? (state.language === "ar" ? "تم تجهيز Preview. راجع ثم احفظ." : "Preview is ready. Review, then save.")
          : (state.language === "ar" ? "تم استخراج التقرير لكن توجد أخطاء قبل الحفظ." : "Report parsed, but validation errors must be fixed before saving.")
      });
    } catch (error) {
      set({
        loading: false,
        processingStage: "idle",
        externalImport: {
          ...state.externalImport,
          rawText,
          tickerHint,
          stage: "paste",
          validation: { valid: false, errors: [{ field: "parser", message: error.userMessage || error.message || "External parser failed." }], warnings: [] }
        },
        notice: error.userMessage || error.message || (state.language === "ar" ? "تعذر استخراج التحليل." : "Could not parse the analysis.")
      });
    }
  }

  function clearExternalImport() {
    set({
      externalImport: createExternalImportState(),
      notice: state.language === "ar" ? "تم مسح مسودة الاستيراد." : "External import draft cleared."
    });
  }

  function cancelExternalImport() {
    set({
      externalImport: createExternalImportState(),
      activePanel: "home",
      notice: ""
    });
  }

  function updateExternalDraftField(path, value) {
    if (!state.externalImport?.draftReport) return;
    const updatedReport = updateExternalAnalysisField(state.externalImport.draftReport, path, value);
    const validation = validateExternalAnalysisReport(updatedReport);
    const prepared = prepareExternalDraftReport(updatedReport, validation, state.historicalRequirementSets, {
      selectedRequirementSetId: state.externalImport?.requirementMatch?.selectedRequirementSetId
    });
    set({
      externalImport: {
        ...state.externalImport,
        draftReport: prepared.report,
        draftJson: JSON.stringify(prepared.report, null, 2),
        validation: prepared.validation,
        requirementMatch: prepared.requirementMatch,
        duplicate: findDuplicateExternalAnalysis(state.externalAnalyses, prepared.report)
      }
    });
  }

  function updateExternalDraftJson(value) {
    try {
      const rawOriginal = state.externalImport?.draftReport?.rawAnalysisOriginal || state.externalImport?.rawText || "";
      const normalizedReport = normalizeExternalAnalysisReport(JSON.parse(value || "{}"), rawOriginal, {
        importMethod: state.externalImport?.draftReport?.metadata?.importMethod || "manual_json_edit"
      });
      const validation = validateExternalAnalysisReport(normalizedReport);
      const prepared = prepareExternalDraftReport(normalizedReport, validation, state.historicalRequirementSets, {
        selectedRequirementSetId: state.externalImport?.requirementMatch?.selectedRequirementSetId
      });
      set({
        externalImport: {
          ...state.externalImport,
          draftReport: prepared.report,
          draftJson: value,
          validation: prepared.validation,
          requirementMatch: prepared.requirementMatch,
          duplicate: findDuplicateExternalAnalysis(state.externalAnalyses, prepared.report)
        }
      });
    } catch {
      set({
        externalImport: {
          ...state.externalImport,
          draftJson: value,
          validation: { valid: false, errors: [{ field: "json", message: "JSON editor contains invalid JSON." }], warnings: [] }
        }
      });
    }
  }

  function saveExternalDraft(allowDuplicate = false) {
    const draft = state.externalImport?.draftReport;
    if (!draft) return;
    const validation = validateExternalAnalysisReport(draft);
    if (!validation.valid) {
      set({
        externalImport: { ...state.externalImport, validation },
        notice: state.language === "ar" ? "أصلح أخطاء التحقق قبل الحفظ." : "Fix validation errors before saving."
      });
      return;
    }
    const draftForSave = prepareExternalReportForSave(draft);
    if (state.externalImport.editing) {
      const result = updateSavedExternalAnalysis(state.externalAnalyses, draftForSave);
      const historicalRequirementSets = applyHistoricalRequirementLifecycle(
        state.historicalRequirementSets,
        result.report,
        state.externalImport?.requirementMatch
      );
      set({
        externalAnalyses: result.collection,
        historicalRequirementSets,
        externalImport: createExternalImportState(),
        externalReportSelection: { ticker: result.report.company.ticker, reportId: result.report.id },
        company: externalReportCompanyShell(result.report),
        activePanel: "external-report",
        notice: state.language === "ar" ? "تم تحديث التحليل المستورد مع حفظ النص الأصلي." : "Imported analysis updated while preserving the original raw text."
      });
      return;
    }
    const result = saveExternalAnalysis(state.externalAnalyses, draftForSave, { allowDuplicate });
    if (result.duplicate && !allowDuplicate) {
      set({
        externalImport: {
          ...state.externalImport,
          duplicate: result.duplicate
        },
        notice: state.language === "ar" ? "هذا التحليل موجود مسبقًا. يمكنك حفظ نسخة مكررة إذا رغبت." : "This analysis already exists. You can save a duplicate version if needed."
      });
      return;
    }
    const historicalRequirementSets = applyHistoricalRequirementLifecycle(
      state.historicalRequirementSets,
      result.report,
      state.externalImport?.requirementMatch
    );
    set({
      externalAnalyses: result.collection,
      historicalRequirementSets,
      externalImport: createExternalImportState(),
      externalReportSelection: { ticker: result.report.company.ticker, reportId: result.report.id },
      company: externalReportCompanyShell(result.report),
      activePanel: "external-report",
      notice: state.language === "ar" ? "تم حفظ تحليل ChatGPT وإضافته إلى الصفحة الرئيسية." : "External ChatGPT analysis saved and added to Home."
    });
  }

  function saveExternalIncompleteDraft(allowDuplicate = false) {
    const draft = state.externalImport?.draftReport;
    if (!draft) return;
    const ticker = draft.company?.ticker;
    if (!ticker) {
      set({ notice: state.language === "ar" ? "لا يمكن حفظ المسودة بدون رمز السهم." : "A ticker is required before saving a draft." });
      return;
    }
    const validation = validateExternalAnalysisReport(draft);
    const draftReport = attachCompletionStatus(draft, validation, { draft: true });
    const draftForSave = prepareExternalReportForSave(draftReport);
    const result = state.externalImport.editing
      ? updateSavedExternalAnalysis(state.externalAnalyses, draftForSave)
      : saveExternalAnalysis(state.externalAnalyses, draftForSave, { allowDuplicate });
    if (result.duplicate && !allowDuplicate) {
      set({
        externalImport: { ...state.externalImport, duplicate: result.duplicate },
        notice: state.language === "ar" ? "هذه المسودة موجودة مسبقًا." : "This draft already exists."
      });
      return;
    }
    const historicalRequirementSets = applyHistoricalRequirementLifecycle(
      state.historicalRequirementSets,
      result.report,
      state.externalImport?.requirementMatch
    );
    set({
      externalAnalyses: result.collection,
      historicalRequirementSets,
      externalImport: createExternalImportState(),
      externalReportSelection: { ticker: result.report.company.ticker, reportId: result.report.id },
      company: externalReportCompanyShell(result.report),
      activePanel: "external-report",
      notice: state.language === "ar" ? "تم حفظ التقرير كمسودة غير مكتملة." : "Incomplete draft saved."
    });
  }

  function currentMissingRequirementsPrompt() {
    const report = state.externalImport?.draftReport || selectedExternalReportFromState();
    if (!report) return { text: "", count: 0, fields: [] };
    return buildMissingRequirementsPrompt(report, report.completionStatus);
  }

  function currentFullAnalysisPrompt(tickerHint = "") {
    return buildFullAnalysisPrompt({ tickerHint: tickerHint || state.externalImport?.tickerHint });
  }

  function currentExternalAnalysisJsonTemplate(tickerHint = "") {
    return buildExternalAnalysisJsonTemplate({ tickerHint: tickerHint || state.externalImport?.tickerHint });
  }

  function currentNewEarningsAnalysisPrompt() {
    const report = selectedExternalReportFromState();
    return report ? buildNewEarningsAnalysisPrompt(report) : "";
  }

  function openSupplementInput() {
    if (!state.externalImport?.draftReport) return;
    set({
      externalImport: {
        ...state.externalImport,
        supplement: {
          ...createSupplementState(),
          open: true,
          stage: "paste"
        }
      }
    });
  }

  function cancelExternalSupplement() {
    set({
      externalImport: {
        ...state.externalImport,
        supplement: createSupplementState()
      }
    });
  }

  async function parseExternalSupplement(text) {
    const rawText = String(text || "").trim();
    const existingReport = state.externalImport?.draftReport;
    if (!existingReport || !rawText) {
      set({ notice: state.language === "ar" ? "ألصق الرد التكميلي أولًا." : "Paste the supplementary response first." });
      return;
    }
    set({
      loading: true,
      processingStage: "parsing-external-supplement",
      externalImport: {
        ...state.externalImport,
        supplement: {
          ...(state.externalImport.supplement || createSupplementState()),
          open: true,
          rawText,
          stage: "parsing",
          validation: { valid: false, errors: [], warnings: [] }
        }
      },
      notice: state.language === "ar" ? "جاري قراءة البيانات المكملة فقط..." : "Parsing supplementary fields only..."
    });
    try {
      const missingFields = [
        ...(existingReport.completionStatus?.details?.criticalRequired || []),
        ...(existingReport.completionStatus?.details?.recommended || [])
      ];
      const parsed = await parseExternalAnalysisSupplement(rawText, {
        existingReport,
        missingFields,
        parseUnstructured: (inputText) => parseExternalAnalysisSupplementBlock({
          text: inputText,
          language: state.language,
          missingFields,
          reportContext: externalSupplementContext(existingReport)
        })
      });
      const supplementValidation = validateExternalAnalysisSupplement(parsed.supplement, existingReport);
      const mergePreview = supplementValidation.valid
        ? mergeExternalAnalysisSupplement(existingReport, parsed.supplement)
        : null;
      set({
        loading: false,
        processingStage: "idle",
        externalImport: {
          ...state.externalImport,
          supplement: {
            ...(state.externalImport.supplement || createSupplementState()),
            open: true,
            rawText,
            parsedSupplement: parsed.supplement,
            validation: supplementValidation,
            mergePreview,
            parserSource: parsed.parserSource,
            usedAi: parsed.usedAi,
            conflictResolutions: {},
            manualValues: {},
            stage: "preview"
          }
        },
        notice: supplementValidation.valid
          ? (state.language === "ar" ? "تم تجهيز Preview للحقول المكملة." : "Supplement preview is ready.")
          : (state.language === "ar" ? "الرد التكميلي غير صالح." : "Supplement is not valid.")
      });
    } catch (error) {
      set({
        loading: false,
        processingStage: "idle",
        externalImport: {
          ...state.externalImport,
          supplement: {
            ...(state.externalImport.supplement || createSupplementState()),
            open: true,
            rawText,
            stage: "paste",
            validation: { valid: false, errors: [{ field: "supplement", message: error.userMessage || error.message || "Supplement parser failed." }], warnings: [] }
          }
        },
        notice: error.userMessage || error.message || (state.language === "ar" ? "تعذر قراءة الرد التكميلي." : "Could not parse the supplement.")
      });
    }
  }

  function resolveSupplementConflict(path, resolution, manualValue = undefined) {
    const supplementState = state.externalImport?.supplement;
    const existingReport = state.externalImport?.draftReport;
    if (!supplementState?.parsedSupplement || !existingReport) return;
    const conflictResolutions = {
      ...(supplementState.conflictResolutions || {}),
      [path]: resolution
    };
    const manualValues = {
      ...(supplementState.manualValues || {})
    };
    if (manualValue !== undefined) manualValues[path] = manualValue;
    const mergePreview = mergeExternalAnalysisSupplement(existingReport, supplementState.parsedSupplement, {
      resolutions: conflictResolutions,
      manualValues
    });
    set({
      externalImport: {
        ...state.externalImport,
        supplement: {
          ...supplementState,
          conflictResolutions,
          manualValues,
          mergePreview
        }
      }
    });
  }

  function applyExternalSupplement() {
    const supplementState = state.externalImport?.supplement;
    if (!supplementState?.mergePreview) return;
    const mergedReport = supplementState.mergePreview.report;
    const validation = validateExternalAnalysisReport(mergedReport);
    const draftReportWithCompletion = attachCompletionStatus(mergedReport, validation, {
      conflictingPaths: supplementState.mergePreview.conflicts.map((item) => item.path)
    });
    const prepared = prepareExternalDraftReport(draftReportWithCompletion, validation, state.historicalRequirementSets, {
      selectedRequirementSetId: state.externalImport?.requirementMatch?.selectedRequirementSetId
    });
    const before = state.externalImport?.draftReport?.completionStatus || {};
    const after = prepared.report.completionStatus || {};
    set({
      externalImport: {
        ...state.externalImport,
        draftReport: prepared.report,
        draftJson: JSON.stringify(prepared.report, null, 2),
        validation: prepared.validation,
        requirementMatch: prepared.requirementMatch,
        duplicate: findDuplicateExternalAnalysis(state.externalAnalyses, prepared.report),
        supplement: {
          ...supplementState,
          stage: "applied",
          open: false
        }
      },
      notice: state.language === "ar"
        ? `تم دمج البيانات المكملة. قبل الإكمال: ${before.requiredComplete || 0}/${before.requiredTotal || 0}. بعد الإكمال: ${after.requiredComplete || 0}/${after.requiredTotal || 0}.`
        : `Supplement merged. Before: ${before.requiredComplete || 0}/${before.requiredTotal || 0}. After: ${after.requiredComplete || 0}/${after.requiredTotal || 0}.`
    });
  }

  function selectHistoricalRequirementSet(requirementSetId) {
    const draft = state.externalImport?.draftReport;
    if (!draft) return;
    const validation = validateExternalAnalysisReport(draft);
    const prepared = prepareExternalDraftReport(draft, validation, state.historicalRequirementSets, { selectedRequirementSetId: requirementSetId });
    set({
      externalImport: {
        ...state.externalImport,
        draftReport: prepared.report,
        draftJson: JSON.stringify(prepared.report, null, 2),
        validation: prepared.validation,
        requirementMatch: {
          ...prepared.requirementMatch,
          selectedRequirementSetId: requirementSetId
        },
        duplicate: findDuplicateExternalAnalysis(state.externalAnalyses, prepared.report)
      },
      notice: state.language === "ar"
        ? "تم ربط التقرير بمجموعة المتطلبات التاريخية المحددة."
        : "The report is linked to the selected historical requirement set."
    });
  }

  function selectedExternalReportFromState() {
    const selection = state.externalReportSelection || {};
    return ensureExternalCompletionStatus(getExternalAnalysis(state.externalAnalyses, selection.ticker, selection.reportId));
  }

  function openExternalReport(ticker, reportId = "latest") {
    const report = ensureExternalCompletionStatus(getExternalAnalysis(state.externalAnalyses, ticker, reportId));
    if (!report) return;
    set({
      externalReportSelection: { ticker: report.company.ticker, reportId: report.id },
      company: externalReportCompanyShell(report),
      activePanel: "external-report",
      notice: "",
      searchResults: []
    });
  }

  function openCompanyProfile(ticker, reportId = "latest") {
    const report = ensureExternalCompletionStatus(getExternalAnalysis(state.externalAnalyses, ticker, reportId));
    if (!report?.companyProfile) return;
    set({
      externalReportSelection: { ticker: report.company.ticker, reportId: report.id },
      company: externalReportCompanyShell(report),
      activePanel: "company-profile",
      notice: "",
      searchResults: []
    });
  }

  function editExternalReport(ticker, reportId) {
    const report = ensureExternalCompletionStatus(getExternalAnalysis(state.externalAnalyses, ticker, reportId));
    if (!report) return;
    set({
      externalImport: {
        rawText: report.rawAnalysisOriginal || report.rawAnalysis || "",
        draftReport: report,
        draftJson: JSON.stringify(report, null, 2),
        validation: validateExternalAnalysisReport(report),
        duplicate: null,
        parserSource: report.metadata?.importMethod || "Saved External Analysis",
        usedAi: report.metadata?.importMethod === "openai_backend_parser",
        stage: "preview",
        editing: true
      },
      activePanel: "external-import",
      notice: state.language === "ar" ? "يمكنك تعديل الحقول. النص الأصلي سيبقى محفوظًا." : "Edit fields as needed. The original raw text will remain preserved."
    });
  }

  function startExternalReportCompletion(ticker, reportId) {
    const report = ensureExternalCompletionStatus(getExternalAnalysis(state.externalAnalyses, ticker, reportId));
    if (!report) return;
    const validation = validateExternalAnalysisReport(report);
    set({
      externalImport: {
        ...createExternalImportState(),
        rawText: report.rawAnalysisOriginal || report.rawAnalysis || "",
        draftReport: report,
        draftJson: JSON.stringify(report, null, 2),
        validation,
        parserSource: report.metadata?.importMethod || "Saved External Analysis",
        stage: "preview",
        editing: true,
        supplement: {
          ...createSupplementState(),
          open: true,
          stage: "paste"
        }
      },
      activePanel: "external-import",
      notice: state.language === "ar" ? "ألصق رد ChatGPT التكميلي لإكمال التقرير." : "Paste the supplementary ChatGPT response to complete the report."
    });
  }

  function removeExternalReport(ticker, reportId) {
    const externalAnalyses = deleteExternalAnalysis(state.externalAnalyses, ticker, reportId);
    set({
      externalAnalyses,
      externalReportSelection: null,
      activePanel: "home",
      notice: state.language === "ar" ? "تم حذف نسخة التحليل المستورد." : "Imported analysis version deleted."
    });
  }

  function removeAllExternalReports(ticker) {
    const externalAnalyses = deleteAllExternalAnalysesForTicker(state.externalAnalyses, ticker);
    set({
      externalAnalyses,
      externalReportSelection: null,
      activePanel: "home",
      notice: state.language === "ar" ? "تم حذف جميع التحليلات المستوردة لهذا السهم." : "All imported analyses for this ticker were deleted."
    });
  }

  function clearAnalystPaste() {
    if (!state.valuationWorkspace) {
      startBlankAnalysis();
      return;
    }
    const workspace = createValuationWorkspace({
      ticker: state.valuationWorkspace.ticker || "NEW",
      name: state.valuationWorkspace.companyName || "",
      quote: { price: null }
    });
    set({
      valuationWorkspace: workspace,
      loading: false,
      processingStage: "idle",
      notice: state.language === "ar" ? "تم مسح مسودة التحليل." : "Analysis draft cleared."
    });
  }

  function setWorkspaceField(field, value) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: updateWorkspaceField(state.valuationWorkspace, field, value) });
  }

  function setWorkspaceSectionSource(sectionId, patch) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: updateSectionSource(state.valuationWorkspace, sectionId, patch) });
  }

  function setWorkspacePaste(sectionId, text) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: updatePasteDraft(state.valuationWorkspace, sectionId, text) });
  }

  function parseWorkspaceSection(sectionId) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: parseWorkspacePaste(state.valuationWorkspace, sectionId) });
  }

  function saveParsedWorkspaceValues() {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: applyParsedPreview(state.valuationWorkspace) });
  }

  function confirmWorkspaceValue(fieldId) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: confirmWorkspaceField(state.valuationWorkspace, fieldId) });
  }

  function rejectWorkspaceValue(fieldId) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: rejectWorkspaceField(state.valuationWorkspace, fieldId) });
  }

  function markWorkspaceValueNotAvailable(fieldId) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: markWorkspaceFieldNotAvailable(state.valuationWorkspace, fieldId) });
  }

  function setWorkspaceOverride(field, key, value) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: setMethodologyOverride(state.valuationWorkspace, field, { [key]: value }) });
  }

  function setWorkspaceInvestorNotes(value) {
    if (!state.valuationWorkspace) return;
    set({ valuationWorkspace: { ...state.valuationWorkspace, investorNotes: value, updatedAt: new Date().toISOString() } });
  }

  async function runWorkspaceValuation() {
    if (!state.valuationWorkspace) return;
    set({
      loading: true,
      processingStage: "reviewing-data",
      notice: state.language === "ar" ? "جاري تثبيت البيانات وتشغيل محرك التقييم..." : "Confirming data and running the valuation engine..."
    });
    await wait(360);
    const result = runFixedMethodologyValuation(state.valuationWorkspace, state.language);
    set({
      valuationWorkspace: result.workspace,
      loading: false,
      processingStage: "idle",
      notice: result.error || "",
      activePanel: "workspace"
    });
  }

  async function runAnalystBrainValuation(pasteText) {
    if (!state.valuationWorkspace) return;
    const text = String(pasteText || state.valuationWorkspace.analystBrainPaste || "").trim();
    if (!text) {
      set({ notice: state.language === "ar" ? "ألصق بيانات الشركة أولًا." : "Paste company data first." });
      return;
    }
    const draftWorkspace = updateAnalystBrainPaste(state.valuationWorkspace, text);
    set({
      valuationWorkspace: draftWorkspace,
      loading: true,
      processingStage: "parsing-paste",
      notice: state.language === "ar" ? "جاري قراءة البيانات وتشغيل المنهجية..." : "Parsing data and running the methodology..."
    });
    const methodology = await loadAnalystBrainMethodology();
    await wait(360);
    const aiParsed = await parseInvestmentAnalystBlock({
      text,
      methodology,
      language: state.language
    });
    set({
      loading: true,
      processingStage: "running-engine",
      notice: state.language === "ar" ? "تم استخراج البيانات. يجري الآن حساب التقييم deterministically." : "Data extracted. Running deterministic valuation now."
    });
    await wait(300);
    const result = runInvestmentAnalystBrainValuation(draftWorkspace, {
      text,
      language: state.language,
      schema: methodology.outputSchema,
      parsedFields: aiParsed.parsedFields,
      explanations: aiParsed.explanations,
      aiSource: aiParsed.source
    });
    set({
      valuationWorkspace: result.workspace,
      loading: false,
      processingStage: "idle",
      notice: result.error || (state.language === "ar" ? "تم إنشاء التقرير. راجعه ثم اعتمده للتصدير." : "Report generated. Review and approve it before export."),
      activePanel: "workspace"
    });
  }

  function editWorkspaceData() {
    if (!state.valuationWorkspace) return;
    set({
      valuationWorkspace: { ...state.valuationWorkspace, status: "Collecting Data", researchStatus: "Collecting Data" },
      activePanel: "workspace"
    });
  }

  function approveAndExportWorkspace() {
    if (!state.valuationWorkspace) return;
    const result = approveWorkspaceValuation(state.valuationWorkspace, state.valuationWorkspace.investorNotes || "");
    if (result.error) {
      set({ valuationWorkspace: result.workspace, notice: result.error, activePanel: "workspace" });
      return;
    }
    const previous = state.evaluatedCompanies.find((item) => item.ticker === result.evaluatedCompany.ticker);
    const evaluatedCompany = previous
      ? {
        ...result.evaluatedCompany,
        valuationVersions: [...(result.evaluatedCompany.valuationVersions || []), ...(previous.valuationVersions || [])].slice(0, 40),
        history: [previous, ...(previous.history || [])].slice(0, 40)
      }
      : result.evaluatedCompany;
    set({
      valuationWorkspace: result.workspace,
      evaluatedCompanies: upsertEvaluatedCompany(state.evaluatedCompanies, evaluatedCompany),
      notice: state.language === "ar" ? "تم اعتماد التقييم وتصديره إلى الصفحة الرئيسية." : "Valuation approved and exported to Home.",
      activePanel: "home"
    });
  }

  function setManualInput(field, value) {
    state.manualInputs[field] = value;
    updateResearch();
  }

  function clearLocalData() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("equityResearchLanguage");
    window.sessionStorage?.clear();
    window.location.reload();
  }

  function createInvestmentBackup() {
    return createInvestmentDataBackup(state);
  }

  function previewInvestmentRestore(text) {
    const result = parseInvestmentDataBackup(text);
    set({
      restorePreview: result,
      notice: result.valid
        ? (state.language === "ar" ? "تمت قراءة النسخة الاحتياطية. راجع الملخص ثم اختر دمج أو استبدال." : "Backup parsed. Review the preview, then merge or replace.")
        : (state.language === "ar" ? "النسخة الاحتياطية غير صالحة." : "Backup is not valid.")
    });
  }

  function cancelInvestmentRestore() {
    set({ restorePreview: null, notice: "" });
  }

  function restoreInvestmentBackup(mode = "merge") {
    if (!state.restorePreview?.valid || !state.restorePreview.backup) return;
    const next = mode === "replace"
      ? replaceInvestmentDataBackup(state, state.restorePreview.backup)
      : mergeInvestmentDataBackup(state, state.restorePreview.backup);
    const normalizedExternalAnalyses = normalizeExternalAnalysesCollection(next.externalAnalyses || {});
    set({
      ...next,
      externalAnalyses: normalizedExternalAnalyses,
      historicalRequirementSets: normalizeHistoricalRequirementSets(next.historicalRequirementSets || {}, normalizedExternalAnalyses),
      restorePreview: null,
      notice: state.language === "ar"
        ? (mode === "replace" ? "تم استبدال بيانات Franklin من النسخة الاحتياطية." : "تم دمج النسخة الاحتياطية مع بيانات Franklin الحالية.")
        : (mode === "replace" ? "Franklin data replaced from backup." : "Backup merged with current Franklin data.")
    });
  }

  function setLanguage(language) {
    const normalized = normalizeLanguage(language);
    setLanguageContext(normalized);
    localStorage.setItem("equityResearchLanguage", normalized);
    const research = runEquityResearch(state.company, state.manualInputs);
    set({
      language: normalized,
      research,
      institutionalResearch: buildInstitutionalResearch(research)
    });
  }

  function setEvaluatedSort(key) {
    const current = state.evaluatedSort || { key: "rankingPosition", direction: "asc" };
    const direction = current.key === key && current.direction === "desc" ? "asc" : "desc";
    set({ evaluatedSort: { key, direction } });
  }

  function setRankingFilter(filter) {
    set({ rankingFilter: filter, comparisonOpen: false });
  }

  function setSectorFilter(sector) {
    set({ sectorFilter: sector, comparisonOpen: false });
  }

  function toggleCompareSelection(ticker) {
    const selected = new Set(state.compareSelectedTickers);
    if (selected.has(ticker)) selected.delete(ticker);
    else if (selected.size < 5) selected.add(ticker);
    set({ compareSelectedTickers: [...selected] });
  }

  function openComparison() {
    const selected = state.compareSelectedTickers.filter((ticker) => state.evaluatedCompanies.some((item) => item.ticker === ticker));
    set({ compareSelectedTickers: selected, comparisonOpen: selected.length >= 2 && selected.length <= 5 });
  }

  function closeComparison() {
    set({ comparisonOpen: false });
  }

  function openEvaluatedCompany(ticker) {
    const item = state.evaluatedCompanies.find((entry) => entry.ticker === ticker);
    if (!item) return;
    if (item.approvedReport) {
      const workspace = createValuationWorkspace({
        ticker: item.ticker,
        name: item.companyName,
        sector: item.sector,
        quote: { price: item.currentPrice }
      }, {
        id: `approved-${item.valuationVersion || item.ticker}`,
        ticker: item.ticker,
        companyName: item.companyName,
        status: "Approved",
        researchStatus: "Approved",
        inputs: item.approvedInputSnapshot || {},
        sectionSources: item.approvedSourceSnapshot || {},
        report: item.approvedReport,
        renderedReport: item.approvedReportText || "",
        investorNotes: item.investorNotes || "",
        versions: item.valuationVersions || []
      });
      set({
        valuationWorkspace: {
          ...workspace,
          status: "Approved",
          researchStatus: "Approved",
          approvedVersionId: item.valuationVersion,
          approvedAt: item.approvalTimestamp
        },
        activePanel: "workspace",
        notice: "",
        searchResults: []
      });
      return;
    }
    const manualInputs = item.manualInputsSnapshot || state.manualInputs;
    const company = item.companySnapshot || createCompanyShell(ticker);
    const research = runEquityResearch(company, manualInputs);
    set({
      company,
      manualInputs,
      research,
      institutionalResearch: buildInstitutionalResearch(research),
      activePanel: "summary",
      loading: false,
      processingStage: "idle",
      notice: "",
      searchResults: []
    });
  }

  function saveRun() {
    const item = {
      id: String(Date.now()),
      date: new Date().toISOString().slice(0, 10),
      ticker: state.company.ticker,
      decision: state.research.decision.label,
      confidence: state.research.decision.confidence,
      status: state.research.decision.status,
      price: toNumber(state.company.quote?.price),
      fairValue: state.research.valuation.compositeFairValue,
      marginOfSafety: state.research.valuation.marginOfSafety
    };
    set({ history: [item, ...state.history].slice(0, 40), activePanel: "history" });
  }

  function setWatchDraft(field, value) {
    state.watchDraft[field] = value;
    set({ watchDraft: { ...state.watchDraft } });
  }

  function saveWatchItem() {
    const item = {
      id: state.company.ticker,
      ticker: state.company.ticker,
      name: state.company.name,
      decision: state.research.decision.label,
      confidence: state.research.decision.confidence,
      investmentThesis: state.watchDraft.thesis || state.institutionalResearch.thesis.whyInvest.join(" "),
      targetPrice: toNumber(state.watchDraft.targetPrice),
      reviewDate: state.watchDraft.reviewDate,
      notes: state.watchDraft.notes,
      updatedAt: new Date().toISOString()
    };
    const rest = state.watchList.filter((entry) => entry.id !== item.id);
    set({ watchList: [item, ...rest], activePanel: "watchlist" });
  }

  function removeWatchItem(id) {
    set({ watchList: state.watchList.filter((item) => item.id !== id) });
  }

  return {
    state,
    set,
    setCompany,
    openValuationWorkspace,
    startBlankAnalysis,
    loadDemoAnalysis,
    loadDemoExternalAnalysis,
    openExternalImport,
    parseExternalImport,
    clearExternalImport,
    cancelExternalImport,
    updateExternalDraftField,
    updateExternalDraftJson,
    saveExternalDraft,
    saveExternalIncompleteDraft,
    currentMissingRequirementsPrompt,
    currentFullAnalysisPrompt,
    currentExternalAnalysisJsonTemplate,
    currentNewEarningsAnalysisPrompt,
    openSupplementInput,
    cancelExternalSupplement,
    parseExternalSupplement,
    resolveSupplementConflict,
    applyExternalSupplement,
    selectHistoricalRequirementSet,
    openExternalReport,
    openCompanyProfile,
    editExternalReport,
    startExternalReportCompletion,
    removeExternalReport,
    removeAllExternalReports,
    clearAnalystPaste,
    setWorkspaceField,
    setWorkspaceSectionSource,
    setWorkspacePaste,
    parseWorkspaceSection,
    saveParsedWorkspaceValues,
    confirmWorkspaceValue,
    rejectWorkspaceValue,
    markWorkspaceValueNotAvailable,
    setWorkspaceOverride,
    setWorkspaceInvestorNotes,
    runWorkspaceValuation,
    runAnalystBrainValuation,
    editWorkspaceData,
    approveAndExportWorkspace,
    setManualInput,
    clearLocalData,
    createInvestmentBackup,
    previewInvestmentRestore,
    cancelInvestmentRestore,
    restoreInvestmentBackup,
    setLanguage,
    setEvaluatedSort,
    setRankingFilter,
    setSectorFilter,
    toggleCompareSelection,
    openComparison,
    closeComparison,
    openEvaluatedCompany,
    saveRun,
    setWatchDraft,
    saveWatchItem,
    removeWatchItem,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

function normalizeEvaluatedSort(sort) {
  const defaultSort = { key: "rankingPosition", direction: "asc" };
  if (!sort?.key) return defaultSort;
  if (sort.key === "maxFairValueUpside" && sort.direction === "desc") return defaultSort;
  return sort;
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persist(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    company: state.company,
    manualInputs: state.manualInputs,
    language: state.language,
    theme: state.theme,
    activePanel: state.activePanel,
    evaluatedSort: state.evaluatedSort,
    rankingFilter: state.rankingFilter,
    sectorFilter: state.sectorFilter,
    compareSelectedTickers: state.compareSelectedTickers,
    comparisonOpen: state.comparisonOpen,
    evaluatedCompanies: state.evaluatedCompanies,
    externalAnalyses: state.externalAnalyses,
    externalReportSelection: state.externalReportSelection,
    historicalRequirementSets: state.historicalRequirementSets,
    history: state.history,
    watchList: state.watchList
  }));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createExternalImportState() {
  return {
    rawText: "",
    tickerHint: "",
    draftReport: null,
    draftJson: "",
    validation: { valid: false, errors: [], warnings: [] },
    duplicate: null,
    requirementMatch: { status: "none", candidates: [] },
    parserSource: null,
    usedAi: false,
    missingPromptFallback: "",
    copyFallbackText: "",
    copyFallbackTitle: "",
    copyFallbackAction: "",
    supplement: createSupplementState(),
    stage: "paste",
    editing: false
  };
}

function applyImportContextHints(report, { tickerHint } = {}) {
  if (!report) return report;
  if (!tickerHint || report.company?.ticker) return report;
  return updateExternalAnalysisField(report, "company.ticker", tickerHint);
}

function normalizeTickerHint(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 12);
}

function createSupplementState() {
  return {
    open: false,
    rawText: "",
    parsedSupplement: null,
    validation: { valid: false, errors: [], warnings: [] },
    mergePreview: null,
    parserSource: null,
    usedAi: false,
    conflictResolutions: {},
    manualValues: {},
    stage: "idle"
  };
}

function prepareExternalDraftReport(report, validation, historicalRequirementSets = {}, options = {}) {
  const historical = prepareHistoricalRequirementEvaluation(report, historicalRequirementSets, options);
  const reportWithCompletion = attachCompletionStatus(historical.report, validation);
  return {
    report: reportWithCompletion,
    validation,
    requirementMatch: historical.match
  };
}

function prepareExternalReportForSave(report) {
  return attachRequirementSetIdentityToReport(ensureLocalExternalReportId(report));
}

function ensureLocalExternalReportId(report) {
  if (report?.id) return report;
  const ticker = normalizeTickerHint(report?.company?.ticker || "EXT") || "EXT";
  const date = String(report?.analysisDate || new Date().toISOString().slice(0, 10)).replace(/[^0-9A-Za-z-]/g, "");
  const hash = report?.metadata?.rawHash || String(Date.now());
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return { ...report, id: `${ticker}-${date}-${hash}-${stamp}` };
}

function ensureExternalCompletionStatus(report) {
  if (!report) return null;
  if (report.completionStatus?.status && report.completionStatus?.requiredTotal) return report;
  const validation = validateExternalAnalysisReport(report);
  return attachCompletionStatus(report, validation);
}

function externalSupplementContext(report) {
  return {
    ticker: report.company?.ticker || null,
    company: report.company?.name || null,
    targetAnalysisId: report.id || null,
    analysisDate: report.analysisDate || null,
    reportPeriod: report.reportPeriod || null,
    priceAtAnalysis: report.market?.priceAtAnalysis ?? null
  };
}

function externalReportCompanyShell(report) {
  return {
    ...createCompanyShell(report.company?.ticker || "EXT"),
    ticker: report.company?.ticker || "EXT",
    name: report.company?.name || report.company?.ticker || "",
    sector: report.company?.sector || "",
    industry: report.company?.industry || "",
    currency: report.company?.currency || "USD",
    quote: { price: report.market?.priceAtAnalysis ?? null }
  };
}
