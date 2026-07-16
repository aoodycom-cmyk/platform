import { createCompanyShell } from "../data/sampleData.js";
import { buildUnifiedDataCompany, mergeCompanyDataHistory } from "../dataPlatform/dataPlatform.js";
import { buildEvaluatedCompany, upsertEvaluatedCompany } from "../domain/evaluatedCompanies.js";
import { toNumber } from "../domain/financialMetrics.js";
import { rankEvaluatedCompanies } from "../engines/rankingEngine.js";
import { runEquityResearch } from "../engines/researchEngine.js";
import { normalizeLanguage, setLanguageContext } from "../i18n/language.js";
import { buildInstitutionalResearch } from "../research/institutionalResearch.js";
import {
  applyParsedPreview,
  approveWorkspaceValuation,
  confirmWorkspaceField,
  createValuationWorkspace,
  markWorkspaceFieldNotAvailable,
  parseWorkspacePaste,
  rejectWorkspaceField,
  runFixedMethodologyValuation,
  setMethodologyOverride,
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
    notice: "",
    language: initialLanguage,
    theme: saved.theme || "dark",
    apiKeys: {
      fmp: sessionStorage.getItem("equityResearchFmpKey") || "",
      openai: sessionStorage.getItem("equityResearchOpenAiKey") || ""
    },
    activePanel: "home",
    evaluatedSort: initialEvaluatedSort,
    rankingFilter: saved.rankingFilter || "all",
    sectorFilter: saved.sectorFilter || "all",
    compareSelectedTickers: saved.compareSelectedTickers || [],
    comparisonOpen: saved.comparisonOpen || false,
    evaluatedCompanies: initialEvaluatedCompanies,
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
      notice: "",
      searchResults: []
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

  function runWorkspaceValuation() {
    if (!state.valuationWorkspace) return;
    const result = runFixedMethodologyValuation(state.valuationWorkspace, state.language);
    set({
      valuationWorkspace: result.workspace,
      notice: result.error || "",
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

  function setApiKey(field, value) {
    state.apiKeys[field] = value;
    const storageKey = field === "fmp" ? "equityResearchFmpKey" : "equityResearchOpenAiKey";
    sessionStorage.setItem(storageKey, value);
    listeners.forEach((listener) => listener(state));
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
    editWorkspaceData,
    approveAndExportWorkspace,
    setManualInput,
    setApiKey,
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
    valuationWorkspace: state.valuationWorkspace,
    history: state.history,
    watchList: state.watchList,
    watchDraft: state.watchDraft
  }));
}
