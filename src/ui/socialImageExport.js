import { getExternalAnalysis } from "../externalAnalysis/storage.js";

export const SOCIAL_EXPORT_WIDTH = 1080;
export const SOCIAL_EXPORT_HEIGHT = 1350;

const COLORS = {
  background: "#070a12",
  surface: "#0d111b",
  elevated: "#111827",
  border: "#283348",
  text: "#f5f7fb",
  muted: "#9aa6ba",
  teal: "#2dd4bf",
  blue: "#6ea8ff",
  green: "#55d49b",
  amber: "#e7b65b",
  red: "#f17b89",
  purple: "#a78bfa",
  soft: "#172036"
};

const STATUS_LABELS = {
  EXCEEDED: "تجاوز",
  PASSED: "تحقق",
  PARTIALLY_PASSED: "جزئي",
  FAILED: "فشل",
  NOT_REPORTED: "بانتظار الإعلان"
};

const DECISION_LABELS = {
  BUY: "شراء",
  ADD: "زيادة",
  HOLD: "احتفاظ",
  WATCH: "مراقبة",
  REDUCE: "تخفيف",
  SELL: "بيع"
};

export function buildInvestmentInfographicModel(report = {}) {
  const v3 = canonicalV3(report);
  const profile = v3?.companyProfile || report.companyProfile || {};
  const latest = v3?.latestQuarter || {};
  const current = v3?.valuation?.current || {};
  const fair = report.fairValueSummary || {};
  const decision = v3?.decision || report.decision || {};
  const company = v3?.company || {};
  const identity = v3?.reportIdentity || {};

  return {
    ticker: identity.ticker || report.company?.ticker || "—",
    companyName: identity.companyName || report.company?.name || "—",
    sector: company.sector || report.company?.sector || null,
    industry: company.industry || report.company?.industry || null,
    reportPeriod: report.reportPeriod || periodFromIdentity(identity) || null,
    analysisDate: identity.analysisDate || report.analysisDate || null,
    decision: String(decision.action || "").toUpperCase() || null,
    decisionConfidence: toNumber(decision.confidence),
    investmentScore: toNumber(decision.investmentScore),
    marketPrice: toNumber(v3?.marketPrice?.value ?? fair.currentPrice),
    bear: toNumber(current.bear ?? fair.fairValueLow),
    base: toNumber(current.base ?? fair.fairValueBase),
    bull: toNumber(current.bull ?? fair.fairValueHigh),
    probabilityWeighted: toNumber(current.probabilityWeighted ?? fair.probabilityWeightedFairValue),
    upsideToBasePct: toNumber(v3?.valuation?.upsideToBasePct ?? fair.upsideDownsidePercent),
    marginOfSafetyPct: toNumber(v3?.valuation?.marginOfSafetyPct ?? fair.marginOfSafetyPercent),
    companySummary: cleanText(profile.summary || report.companyProfile?.summary),
    businessModel: cleanText(profile.businessModel || report.companyProfile?.businessModel),
    latestQuarterSummary: cleanText(latest.summary),
    latestMetrics: buildLatestMetrics(v3, report),
    strengths: normalizeNarrativeItems(v3?.strengths, report.quality?.strengths).slice(0, 3),
    risks: normalizeNarrativeItems(v3?.risks, report.risks).slice(0, 3),
    thesis: cleanText(v3?.thesis?.updatedSummary || report.thesis?.fullSummary || report.thesis?.shortSummary),
    catalysts: normalizeNarrativeItems(v3?.catalysts, report.catalysts).slice(0, 3),
    sourceCount: Array.isArray(v3?.sources) ? v3.sources.length : Array.isArray(report.sources) ? report.sources.length : 0,
    dataQualityScore: toNumber(v3?.dataQuality?.score),
    currency: company.tradingCurrency || report.company?.currency || "USD"
  };
}

export function buildEarningsTrackerModel(report = {}) {
  const v3 = canonicalV3(report);
  const evaluated = evaluatedRequirementSource(v3, report);
  const source = evaluated || openRequirementSource(v3, report);
  const requirements = Array.isArray(source?.requirements) ? source.requirements.slice(0, 8) : [];
  const targetQuarter = source?.targetQuarter || source?.earningsPeriod || report.reportPeriod || periodFromIdentity(v3?.reportIdentity || {}) || "—";
  const isEvaluated = Boolean(evaluated);

  return {
    ticker: v3?.reportIdentity?.ticker || report.company?.ticker || "—",
    companyName: v3?.reportIdentity?.companyName || report.company?.name || "—",
    targetQuarter,
    reportPeriod: report.reportPeriod || periodFromIdentity(v3?.reportIdentity || {}) || null,
    decision: String(v3?.decision?.action || report.decision?.action || "").toUpperCase() || null,
    baseFairValue: toNumber(v3?.valuation?.current?.base ?? report.fairValueSummary?.fairValueBase),
    marketPrice: toNumber(v3?.marketPrice?.value ?? report.fairValueSummary?.currentPrice),
    mode: source?.mode || v3?.nextRequirements?.mode || report.priceTargetRequirements?.mode || null,
    targetValue: toNumber(source?.targetValue ?? v3?.nextRequirements?.targetValue ?? report.priceTargetRequirements?.targetValue),
    targetScenario: source?.targetScenario || v3?.nextRequirements?.targetScenario || report.priceTargetRequirements?.targetScenario || null,
    isEvaluated,
    expectedSourceNote: "المتوقع = Consensus إن توفر، وإلا Guidance أو نطاق المتابعة الموثق.",
    rows: requirements.map((item) => buildTrackerRow(item, v3, report, { isEvaluated, targetQuarter }))
  };
}

export async function renderInvestmentInfographicPng(report, exportedAt = new Date()) {
  assertBrowserCanvas();
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = createCanvas();
  drawInvestmentInfographic(canvas.getContext("2d"), buildInvestmentInfographicModel(report), exportedAt);
  return canvasToBlob(canvas);
}

export async function renderEarningsTrackerPng(report, exportedAt = new Date()) {
  assertBrowserCanvas();
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = createCanvas();
  drawEarningsTracker(canvas.getContext("2d"), buildEarningsTrackerModel(report), exportedAt);
  return canvasToBlob(canvas);
}

export async function exportInvestmentInfographicPng(report, exportedAt = new Date()) {
  const blob = await renderInvestmentInfographicPng(report, exportedAt);
  const ticker = safeFilePart(report?.company?.ticker || canonicalV3(report)?.reportIdentity?.ticker || "company");
  return deliverPng(blob, `franklin-${ticker}-investment-infographic.png`, `${ticker} — Franklin Investment Infographic`);
}

export async function exportEarningsTrackerPng(report, exportedAt = new Date()) {
  const blob = await renderEarningsTrackerPng(report, exportedAt);
  const ticker = safeFilePart(report?.company?.ticker || canonicalV3(report)?.reportIdentity?.ticker || "earnings");
  return deliverPng(blob, `franklin-${ticker}-earnings-tracker.png`, `${ticker} — Franklin Earnings Tracker`);
}

export function installSocialImageExport(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.socialImageExportInstalled === "true") return;
  root.dataset.socialImageExportInstalled = "true";
  ensureExportStyles();

  const mount = () => mountExportPanel(store, root);
  const unsubscribe = store.subscribe?.(mount);
  root.__franklinSocialExportUnsubscribe = unsubscribe;
  mount();

  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-social-image-export]");
    if (!button || !root.contains(button)) return;
    const type = button.dataset.socialImageExport;
    const selection = store.state.externalReportSelection || {};
    const report = getExternalAnalysis(store.state.externalAnalyses || {}, selection.ticker, selection.reportId || "latest");
    if (!report) return showExportToast(root, "تعذر العثور على التقرير المحفوظ.", "error");

    const previousText = button.textContent;
    button.disabled = true;
    button.classList.add("is-exporting");
    button.textContent = "جارٍ تجهيز الصورة…";
    try {
      if (type === "investment") await exportInvestmentInfographicPng(report);
      else if (type === "earnings") await exportEarningsTrackerPng(report);
      else return;
      showExportToast(root, "الصورة جاهزة للمشاركة أو الحفظ.", "success");
    } catch (error) {
      if (error?.name !== "AbortError") {
        showExportToast(root, `تعذر تصدير الصورة: ${String(error?.message || error)}`, "error");
      }
    } finally {
      button.disabled = false;
      button.classList.remove("is-exporting");
      button.textContent = previousText;
    }
  });
}

function mountExportPanel(store, root) {
  root.querySelector("[data-franklin-social-export-panel]")?.remove();
  if (store.state.activePanel !== "external-report") return;
  const selection = store.state.externalReportSelection || {};
  const report = getExternalAnalysis(store.state.externalAnalyses || {}, selection.ticker, selection.reportId || "latest");
  if (!report) return;
  const host = root.querySelector(".mobile-page-content");
  if (!host) return;

  const section = document.createElement("section");
  section.className = "franklin-social-export-panel";
  section.dataset.franklinSocialExportPanel = "true";
  section.innerHTML = `
    <div class="franklin-social-export-heading">
      <div>
        <span>جاهز للنشر</span>
        <strong>تصدير للسوشال ميديا</strong>
      </div>
      <small>PNG · 1080 × 1350</small>
    </div>
    <div class="franklin-social-export-actions">
      <button type="button" data-social-image-export="investment">
        <b>إنفوجرافيك الشركة</b>
        <span>النشاط · آخر ربع · التقييم · الفرضية · المخاطر · المحفزات</span>
      </button>
      <button type="button" data-social-image-export="earnings">
        <b>جدول متابعة الأرباح</b>
        <span>السابق · المتوقع · خطة الاستهداف · الفعلي · الحالة</span>
      </button>
    </div>
  `;
  host.prepend(section);
}

function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install = () => {
    const store = window.__equityResearchStore;
    const root = document.getElementById("app");
    if (store && root) installSocialImageExport(store, root);
  };
  if (window.__equityResearchStore) install();
  else window.addEventListener("franklin:boot-ready", install, { once: true });
}

function buildLatestMetrics(v3, report) {
  const metrics = v3?.latestQuarter?.coreMetrics || {};
  const highlights = report.financialHighlights || {};
  const items = [
    metricCard("Revenue", metricValue(metrics.revenue, highlights.revenue), metrics.revenue?.yoyPct),
    metricCard("EPS", metricValue(metrics.eps, highlights.epsReported), metrics.eps?.yoyPct),
    metricCard("Gross Margin", percentValue(metrics.grossMarginPct?.actualValue), null),
    metricCard("Operating Margin", percentValue(metrics.operatingMarginPct?.actualValue ?? highlights.operatingMarginPct), null),
    metricCard("FCF", metricValue(metrics.freeCashFlow, highlights.freeCashFlow), metrics.freeCashFlow?.yoyPct)
  ].filter((item) => item.value !== "—");

  const kpis = Array.isArray(v3?.latestQuarter?.companySpecificKpis)
    ? v3.latestQuarter.companySpecificKpis.slice(0, 2).map((item) => metricCard(item.arabicName || item.name || "KPI", item.actualDisplay || formatValue(item.actualValue, item.unit), item.yoyPct))
    : [];
  return [...items, ...kpis].slice(0, 6);
}

function metricCard(label, value, change) {
  return { label, value: value || "—", change: Number.isFinite(Number(change)) ? Number(change) : null };
}

function buildTrackerRow(item, v3, report, context) {
  const metric = cleanText(item?.arabicName || item?.name || item?.metric || "مؤشر");
  const previous = item?.baselineDisplay || item?.previousDisplay || formatValue(item?.baselineValue ?? item?.previousValue, item?.unit);
  const target = item?.requiredDisplay || formatThreshold(item);
  const actual = context.isEvaluated
    ? item?.actualDisplay || formatValue(item?.actualValue, item?.unit)
    : "بانتظار الإعلان";
  const status = context.isEvaluated ? String(item?.status || "NOT_REPORTED").toUpperCase() : "NOT_REPORTED";
  return {
    metric,
    previous: previous || "—",
    expected: expectedForMetric(item, v3, report, context.targetQuarter) || "—",
    target: target || "—",
    actual: actual || "—",
    status,
    statusLabel: STATUS_LABELS[status] || status
  };
}

function expectedForMetric(item, v3, report, targetQuarter) {
  const key = normalizedMetricKey(item?.metric || item?.name || item?.arabicName);
  const core = v3?.latestQuarter?.coreMetrics || {};
  const consensusMetric = coreMetricForKey(core, key);
  if (periodLooksSame(targetQuarter, report.reportPeriod || periodFromIdentity(v3?.reportIdentity || {}))) {
    const consensus = consensusMetric?.consensusValue;
    if (consensus !== null && consensus !== undefined && consensus !== "") {
      return formatValue(consensus, consensusMetric?.unit || item?.unit);
    }
  }

  const guidance = [
    ...(Array.isArray(v3?.latestQuarter?.guidance) ? v3.latestQuarter.guidance : []),
    ...(Array.isArray(report.guidance) ? report.guidance : [])
  ].find((entry) => guidanceMatches(entry, item, targetQuarter));
  if (guidance?.currentGuidance) return String(guidance.currentGuidance);

  const monitor = (Array.isArray(v3?.monitoringChecklist) ? v3.monitoringChecklist : report.monitoringChecklist || [])
    .find((entry) => metricMatches(entry?.metric, item?.metric || item?.name || item?.arabicName));
  if (monitor?.expectedRange) return String(monitor.expectedRange);
  return null;
}

function evaluatedRequirementSource(v3, report) {
  const candidates = [v3?.previousRequirementsEvaluation, report.previousRequirementsEvaluation];
  return candidates.find((candidate) => Array.isArray(candidate?.requirements) && candidate.requirements.some((item) => {
    const status = String(item?.status || "NOT_REPORTED").toUpperCase();
    return status !== "NOT_REPORTED" || item?.actualValue !== null && item?.actualValue !== undefined || Boolean(item?.actualDisplay);
  })) || null;
}

function openRequirementSource(v3, report) {
  if (Array.isArray(v3?.nextRequirements?.requirements) && v3.nextRequirements.requirements.length) return v3.nextRequirements;
  if (Array.isArray(report.priceTargetRequirements?.requirements) && report.priceTargetRequirements.requirements.length) return report.priceTargetRequirements;
  return { requirements: [] };
}

function drawInvestmentInfographic(ctx, model, exportedAt) {
  paintBackground(ctx);
  drawBrand(ctx, "INVESTMENT INFOGRAPHIC", exportedAt);
  drawIdentityHero(ctx, model);
  drawBusinessCard(ctx, model);
  drawLatestQuarterCard(ctx, model);
  drawValuationCard(ctx, model);
  drawStrengthRiskColumns(ctx, model);
  drawThesisCatalystsCard(ctx, model);
  drawFooter(ctx, model.analysisDate, model.sourceCount);
}

function drawEarningsTracker(ctx, model, exportedAt) {
  paintBackground(ctx);
  drawBrand(ctx, "EARNINGS TRACKER", exportedAt);
  drawTrackerHero(ctx, model);
  drawTrackerTable(ctx, model);
  drawTrackerFooter(ctx, model);
}

function paintBackground(ctx) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, SOCIAL_EXPORT_WIDTH, SOCIAL_EXPORT_HEIGHT);
  const gradient = ctx.createLinearGradient(0, 0, SOCIAL_EXPORT_WIDTH, SOCIAL_EXPORT_HEIGHT);
  gradient.addColorStop(0, "rgba(45,212,191,0.08)");
  gradient.addColorStop(0.45, "rgba(110,168,255,0.025)");
  gradient.addColorStop(1, "rgba(167,139,250,0.05)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SOCIAL_EXPORT_WIDTH, SOCIAL_EXPORT_HEIGHT);
}

function drawBrand(ctx, label, exportedAt) {
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  setFont(ctx, 24, 800);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("FRANKLIN RESEARCH", 64, 58);
  setFont(ctx, 14, 700);
  ctx.fillStyle = COLORS.teal;
  ctx.fillText(label, 64, 86);

  ctx.textAlign = "right";
  setFont(ctx, 14, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(String(exportedAt?.toISOString?.() || exportedAt || "").slice(0, 10), 1016, 64);
}

function drawIdentityHero(ctx, model) {
  card(ctx, 64, 112, 952, 148, COLORS.surface);
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  setFont(ctx, 48, 900);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(model.ticker, 92, 161);
  setFont(ctx, 20, 650);
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, model.companyName, 92, 198, 360, 20);
  setFont(ctx, 15, 600);
  ctx.fillText([model.sector, model.industry].filter(Boolean).join(" · "), 92, 228);

  drawDecisionBadge(ctx, model.decision, 692, 135, 286, 44);
  drawHeroMetric(ctx, "السعر", money(model.marketPrice), 702, 213, "ltr");
  drawHeroMetric(ctx, "Base", money(model.base), 840, 213, "ltr");
  drawHeroMetric(ctx, "إلى Base", signedPercent(model.upsideToBasePct), 978, 213, "ltr", upsideColor(model.upsideToBasePct));
}

function drawBusinessCard(ctx, model) {
  card(ctx, 64, 282, 952, 178, COLORS.surface);
  sectionTitle(ctx, "الشركة باختصار", "كيف تكسب المال وما الذي يحرك النمو؟", 986, 315);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 20, 650);
  ctx.fillStyle = COLORS.text;
  drawWrappedText(ctx, model.companySummary || model.businessModel || "لا يوجد ملخص متاح.", 986, 355, 894, 30, 3);
  setFont(ctx, 15, 600);
  ctx.fillStyle = COLORS.muted;
  drawWrappedText(ctx, model.businessModel && model.businessModel !== model.companySummary ? model.businessModel : model.latestQuarterSummary, 986, 423, 894, 22, 2);
}

function drawLatestQuarterCard(ctx, model) {
  card(ctx, 64, 482, 952, 186, COLORS.surface);
  sectionTitle(ctx, `آخر ربع ${model.reportPeriod || ""}`.trim(), "أهم الأرقام التشغيلية", 986, 515);
  const metrics = model.latestMetrics.length ? model.latestMetrics : [{ label: "Data", value: "—", change: null }];
  const width = 894 / Math.min(metrics.length, 6);
  metrics.slice(0, 6).forEach((metric, index) => {
    const x = 92 + index * width;
    if (index > 0) divider(ctx, x - 10, 552, x - 10, 642);
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    setFont(ctx, 13, 700);
    ctx.fillStyle = COLORS.muted;
    fitText(ctx, metric.label, x, 570, width - 24, 13);
    setFont(ctx, 23, 800);
    ctx.fillStyle = COLORS.text;
    fitText(ctx, metric.value, x, 607, width - 24, 23);
    if (metric.change !== null) {
      setFont(ctx, 12, 700);
      ctx.fillStyle = upsideColor(metric.change);
      ctx.fillText(`${metric.change > 0 ? "+" : ""}${metric.change.toFixed(1)}% YoY`, x, 635);
    }
  });
}

function drawValuationCard(ctx, model) {
  card(ctx, 64, 690, 952, 162, COLORS.surface);
  sectionTitle(ctx, "القيمة العادلة", "Bear / Base / Bull", 986, 723);
  const scenarios = [
    ["Bear", model.bear, COLORS.red],
    ["Base", model.base, COLORS.teal],
    ["Bull", model.bull, COLORS.green]
  ];
  scenarios.forEach(([label, value, color], index) => {
    const x = 92 + index * 220;
    roundedRect(ctx, x, 754, 196, 72, 14, COLORS.elevated, COLORS.border);
    ctx.direction = "ltr";
    ctx.textAlign = "left";
    setFont(ctx, 13, 800);
    ctx.fillStyle = color;
    ctx.fillText(label, x + 16, 775);
    setFont(ctx, 29, 900);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(money(value), x + 16, 808);
  });
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 13, 700);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("القيمة المرجحة", 986, 771);
  setFont(ctx, 28, 900);
  ctx.fillStyle = COLORS.blue;
  ctx.fillText(money(model.probabilityWeighted), 986, 807);
  setFont(ctx, 12, 650);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`هامش الأمان ${signedPercent(model.marginOfSafetyPct)}`, 986, 832);
}

function drawStrengthRiskColumns(ctx, model) {
  const y = 874;
  card(ctx, 64, y, 462, 226, COLORS.surface);
  card(ctx, 554, y, 462, 226, COLORS.surface);
  sectionTitle(ctx, "نقاط القوة", "ما يدعم الفرضية", 498, y + 32, COLORS.green);
  sectionTitle(ctx, "المخاطر", "ما قد يكسر الفرضية", 988, y + 32, COLORS.red);
  drawBullets(ctx, model.strengths, 498, y + 72, 406, 44, COLORS.green, 3);
  drawBullets(ctx, model.risks, 988, y + 72, 406, 44, COLORS.red, 3);
}

function drawThesisCatalystsCard(ctx, model) {
  card(ctx, 64, 1122, 952, 158, COLORS.surface);
  sectionTitle(ctx, "الفرضية الاستثمارية", "الخلاصة وما الذي قد يغيرها", 986, 1154);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 16, 650);
  ctx.fillStyle = COLORS.text;
  drawWrappedText(ctx, model.thesis || "لا توجد فرضية مختصرة متاحة.", 986, 1191, 894, 23, 3);
  const catalystLine = model.catalysts.map((item) => item.title).filter(Boolean).slice(0, 3).join("  •  ");
  setFont(ctx, 13, 650);
  ctx.fillStyle = COLORS.teal;
  fitText(ctx, catalystLine || "المحفزات ستظهر هنا عند توفرها", 986, 1261, 894, 13, "right");
}

function drawFooter(ctx, analysisDate, sourceCount) {
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 12, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`تحليل ${analysisDate || "—"} · ${sourceCount || 0} مصادر · لأغراض البحث وليست توصية مالية`, 1016, 1320);
}

function drawTrackerHero(ctx, model) {
  card(ctx, 64, 112, 952, 170, COLORS.surface);
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  setFont(ctx, 46, 900);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(model.ticker, 92, 160);
  setFont(ctx, 19, 650);
  ctx.fillStyle = COLORS.muted;
  fitText(ctx, model.companyName, 92, 197, 420, 19);
  setFont(ctx, 15, 700);
  ctx.fillStyle = COLORS.blue;
  ctx.fillText(String(model.targetQuarter || "—"), 92, 230);

  drawDecisionBadge(ctx, model.decision, 720, 132, 258, 42);
  drawHeroMetric(ctx, "Base Fair Value", money(model.baseFairValue), 978, 218, "rtl");
  drawHeroMetric(ctx, "السعر", money(model.marketPrice), 820, 218, "rtl");
  drawHeroMetric(ctx, "الوضع", modeLabel(model.mode), 650, 218, "rtl", COLORS.teal);

  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 13, 650);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(model.isEvaluated ? "تقرير الأرباح المعلن: مقارنة الخطة بالفعلي" : "متابعة الربع القادم: الفعلي يظهر بعد الإعلان", 986, 261);
}

function drawTrackerTable(ctx, model) {
  const x = 64;
  const y = 306;
  const width = 952;
  const headerHeight = 70;
  const rows = model.rows.length ? model.rows : [{ metric: "لا توجد متطلبات", previous: "—", expected: "—", target: "—", actual: "—", status: "NOT_REPORTED", statusLabel: "—" }];
  const maxTableHeight = 860;
  const rowHeight = Math.max(78, Math.min(106, Math.floor((maxTableHeight - headerHeight) / rows.length)));
  const tableHeight = headerHeight + rowHeight * rows.length;
  card(ctx, x, y, width, tableHeight, COLORS.surface);

  const cols = [
    { key: "metric", label: "المؤشر", width: 222 },
    { key: "previous", label: "السابق", width: 142 },
    { key: "expected", label: "المتوقع", width: 170 },
    { key: "target", label: "خطة الاستهداف", width: 176 },
    { key: "actual", label: "الفعلي", width: 144 },
    { key: "statusLabel", label: "الحالة", width: 98 }
  ];
  const right = x + width;
  const boundaries = [];
  let cursor = right;
  cols.forEach((col) => {
    boundaries.push({ ...col, right: cursor, left: cursor - col.width, center: cursor - col.width / 2 });
    cursor -= col.width;
  });

  ctx.fillStyle = COLORS.elevated;
  roundedRect(ctx, x + 1, y + 1, width - 2, headerHeight - 1, 16, COLORS.elevated, null);
  boundaries.forEach((col, index) => {
    ctx.direction = "rtl";
    ctx.textAlign = "center";
    setFont(ctx, index === 3 ? 14 : 15, 800);
    ctx.fillStyle = index === 3 ? COLORS.teal : COLORS.muted;
    ctx.fillText(col.label, col.center, y + 39);
    if (index > 0) divider(ctx, col.right, y + 14, col.right, y + tableHeight - 14);
  });

  rows.forEach((row, rowIndex) => {
    const top = y + headerHeight + rowIndex * rowHeight;
    divider(ctx, x + 18, top, x + width - 18, top);
    boundaries.forEach((col) => {
      const value = String(row[col.key] || "—");
      ctx.textAlign = "center";
      ctx.direction = containsArabic(value) ? "rtl" : "ltr";
      const isMetric = col.key === "metric";
      const isStatus = col.key === "statusLabel";
      setFont(ctx, isMetric ? 15 : 14, isMetric || isStatus ? 800 : 700);
      ctx.fillStyle = isStatus ? statusColor(row.status) : col.key === "target" ? COLORS.teal : COLORS.text;
      drawCenteredWrapped(ctx, value, col.center, top + rowHeight / 2, col.width - 18, rowHeight - 18, isMetric ? 20 : 19, 2);
    });
  });

  const noteY = Math.min(1238, y + tableHeight + 38);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 13, 650);
  ctx.fillStyle = COLORS.muted;
  drawWrappedText(ctx, model.expectedSourceNote, 1016, noteY, 952, 20, 2);
}

function drawTrackerFooter(ctx, model) {
  const y = 1270;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 13, 700);
  ctx.fillStyle = COLORS.teal;
  const target = Number.isFinite(model.targetValue) ? `الهدف التالي ${money(model.targetValue)}` : "";
  const scenario = model.targetScenario ? ` · ${scenarioLabel(model.targetScenario)}` : "";
  ctx.fillText(`${target}${scenario}` || "خطة المتابعة محفوظة في Franklin", 1016, y);
  setFont(ctx, 12, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("Franklin Research · السابق ≠ المتوقع ≠ مستهدف Franklin · لأغراض البحث وليست توصية مالية", 1016, 1320);
}

function drawDecisionBadge(ctx, decision, x, y, width, height) {
  const label = DECISION_LABELS[decision] || decision || "غير محدد";
  const color = decisionColor(decision);
  roundedRect(ctx, x, y, width, height, 13, tint(color, 0.13), color);
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  setFont(ctx, 17, 850);
  ctx.fillStyle = color;
  ctx.fillText(`${label} · ${decision || "—"}`, x + width / 2, y + height / 2 + 1);
}

function drawHeroMetric(ctx, label, value, x, y, direction = "ltr", color = COLORS.text) {
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 11, 700);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(label, x, y - 21);
  ctx.direction = direction;
  ctx.textAlign = "right";
  setFont(ctx, 19, 850);
  ctx.fillStyle = color;
  fitText(ctx, value, x, y + 5, 136, 19, "right");
}

function sectionTitle(ctx, title, subtitle, x, y, color = COLORS.teal) {
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 20, 850);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(title, x, y);
  setFont(ctx, 12, 650);
  ctx.fillStyle = color;
  ctx.fillText(subtitle, x, y + 25);
}

function drawBullets(ctx, items, x, y, maxWidth, lineHeight, color, maxItems) {
  const list = items?.length ? items.slice(0, maxItems) : [{ title: "—", explanation: "" }];
  list.forEach((item, index) => {
    const cy = y + index * lineHeight;
    ctx.beginPath();
    ctx.arc(x - 4, cy + 7, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    setFont(ctx, 14, 800);
    ctx.fillStyle = COLORS.text;
    fitText(ctx, item.title || item.explanation || "—", x - 18, cy + 9, maxWidth - 18, 14, "right");
    if (item.explanation) {
      setFont(ctx, 11, 600);
      ctx.fillStyle = COLORS.muted;
      fitText(ctx, item.explanation, x - 18, cy + 28, maxWidth - 18, 11, "right");
    }
  });
}

function card(ctx, x, y, width, height, fill) {
  roundedRect(ctx, x, y, width, height, 20, fill, COLORS.border);
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function divider(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const lines = wrapLines(ctx, cleanText(text) || "—", maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return lines.length;
}

function drawCenteredWrapped(ctx, text, centerX, centerY, maxWidth, maxHeight, lineHeight, maxLines) {
  const lines = wrapLines(ctx, text, maxWidth, maxLines);
  const height = Math.min(maxHeight, lines.length * lineHeight);
  const start = centerY - height / 2 + lineHeight * 0.72;
  lines.forEach((line, index) => ctx.fillText(line, centerX, start + index * lineHeight));
}

function wrapLines(ctx, text, maxWidth, maxLines = 3) {
  const words = String(text || "—").replace(/\s+/g, " ").trim().split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length >= maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").split(" ").length;
  if (consumed < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[.,،؛:!?\s]+$/g, "")}…`;
  }
  return lines;
}

function fitText(ctx, text, x, y, maxWidth, initialSize, align = "left") {
  const original = ctx.font;
  const weightMatch = original.match(/^\s*(\d+)/);
  const weight = weightMatch ? Number(weightMatch[1]) : 700;
  let size = initialSize;
  const value = cleanText(text) || "—";
  ctx.textAlign = align;
  while (size > 10) {
    setFont(ctx, size, weight);
    if (ctx.measureText(value).width <= maxWidth) break;
    size -= 1;
  }
  ctx.fillText(value, x, y);
}

function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Tahoma, Arial, sans-serif`;
}

function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = SOCIAL_EXPORT_WIDTH;
  canvas.height = SOCIAL_EXPORT_HEIGHT;
  return canvas;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("تعذر إنشاء ملف PNG.")), "image/png", 1);
  });
}

async function deliverPng(blob, fileName, title) {
  const canUseFile = typeof File !== "undefined";
  const file = canUseFile ? new File([blob], fileName, { type: "image/png" }) : null;
  if (file && typeof navigator !== "undefined" && navigator.share) {
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] });
        return { shared: true, downloaded: false, blob };
      }
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  return { shared: false, downloaded: true, blob };
}

function ensureExportStyles() {
  if (document.getElementById("franklin-social-export-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-social-export-styles";
  style.textContent = `
    .franklin-social-export-panel{margin:0 0 18px;padding:16px;border:1px solid rgba(45,212,191,.28);border-radius:18px;background:linear-gradient(145deg,rgba(45,212,191,.08),rgba(17,24,39,.72));box-shadow:0 18px 50px rgba(0,0,0,.16)}
    .franklin-social-export-heading{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:12px}.franklin-social-export-heading>div{display:grid;gap:3px}.franklin-social-export-heading span{font-size:11px;font-weight:800;color:#2dd4bf}.franklin-social-export-heading strong{font-size:19px;line-height:1.25;color:#f5f7fb}.franklin-social-export-heading small{direction:ltr;font-size:11px;color:#93a0b5;white-space:nowrap}
    .franklin-social-export-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.franklin-social-export-actions button{min-height:92px;padding:14px;text-align:right;border:1px solid #2b3549;border-radius:15px;background:#0d111b;color:#f5f7fb;font:inherit;display:grid;align-content:center;gap:6px;cursor:pointer}.franklin-social-export-actions button:active{transform:translateY(1px)}.franklin-social-export-actions button:first-child{border-color:rgba(45,212,191,.4)}.franklin-social-export-actions b{font-size:14px}.franklin-social-export-actions span{font-size:11px;line-height:1.55;color:#99a5b8}.franklin-social-export-actions button.is-exporting{opacity:.65;cursor:wait}
    .franklin-social-export-toast{position:fixed;z-index:25000;left:50%;bottom:max(86px,calc(env(safe-area-inset-bottom) + 74px));transform:translateX(-50%);max-width:min(88vw,430px);padding:11px 15px;border-radius:999px;background:#101624;border:1px solid #2b3549;color:#f5f7fb;font:700 12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;box-shadow:0 18px 45px rgba(0,0,0,.38);text-align:center}.franklin-social-export-toast.success{border-color:rgba(45,212,191,.55)}.franklin-social-export-toast.error{border-color:rgba(241,123,137,.65)}
    @media(max-width:640px){.franklin-social-export-actions{grid-template-columns:1fr}.franklin-social-export-actions button{min-height:78px}.franklin-social-export-heading{align-items:start}.franklin-social-export-heading small{margin-top:4px}}
  `;
  document.head.appendChild(style);
}

function showExportToast(root, message, tone) {
  root.querySelector(".franklin-social-export-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `franklin-social-export-toast ${tone || ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2800);
}

function canonicalV3(report) {
  const candidate = report?.metadata?.franklinV3Report;
  return candidate && typeof candidate === "object" ? candidate : null;
}

function normalizeNarrativeItems(primary, fallback) {
  const source = Array.isArray(primary) && primary.length ? primary : Array.isArray(fallback) ? fallback : [];
  return source.map((item) => {
    if (typeof item === "string") return { title: cleanText(item), explanation: "" };
    return {
      title: cleanText(item?.title || item?.name || item?.metric),
      explanation: cleanText(item?.explanation || item?.interpretation || item?.whyItMatters)
    };
  }).filter((item) => item.title || item.explanation);
}

function coreMetricForKey(core, key) {
  if (key === "revenue") return core.revenue;
  if (key === "eps") return core.eps;
  if (key === "grossmargin") return core.grossMarginPct;
  if (key === "operatingmargin") return core.operatingMarginPct;
  if (key === "fcf") return core.freeCashFlow;
  return null;
}

function normalizedMetricKey(value) {
  const text = String(value || "").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ");
  if (/revenue|إيراد/.test(text)) return "revenue";
  if (/eps|ربحية|سهم/.test(text)) return "eps";
  if (/gross.*margin|هامش.*إجمالي/.test(text)) return "grossmargin";
  if (/operating.*margin|هامش.*تشغيل/.test(text)) return "operatingmargin";
  if (/free.*cash|fcf|تدفق.*حر/.test(text)) return "fcf";
  return text.replace(/\s+/g, "");
}

function guidanceMatches(entry, item, targetQuarter) {
  if (!entry) return false;
  const periodOk = !targetQuarter || !entry.period || periodLooksSame(entry.period, targetQuarter);
  return periodOk && metricMatches(entry.topic, item?.metric || item?.name || item?.arabicName);
}

function metricMatches(left, right) {
  const a = normalizedMetricKey(left);
  const b = normalizedMetricKey(right);
  if (!a || !b) return false;
  if (a === b) return true;
  return a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a));
}

function periodLooksSame(left, right) {
  const a = String(left || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const b = String(right || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function metricValue(metric, fallback) {
  if (metric?.actualDisplay) return String(metric.actualDisplay);
  if (metric?.actualValue !== null && metric?.actualValue !== undefined) return formatValue(metric.actualValue, metric.unit);
  if (fallback !== null && fallback !== undefined && fallback !== "") return String(fallback);
  return "—";
}

function formatThreshold(item) {
  const value = item?.requiredValue;
  if (value === null || value === undefined || value === "") return "—";
  const type = String(item?.type || "").toLowerCase();
  const prefix = type === "minimum" ? "≥ " : type === "maximum" ? "≤ " : "";
  return `${prefix}${formatValue(value, item?.unit)}`;
}

function formatValue(value, unit) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && !Number.isFinite(Number(value))) return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  const cleanUnit = String(unit || "").trim();
  if (cleanUnit === "%") return `${trimNumber(number)}%`;
  if (/usd/i.test(cleanUnit) && Math.abs(number) >= 1_000_000_000) return `$${trimNumber(number / 1_000_000_000)}B`;
  if (/usd/i.test(cleanUnit) && Math.abs(number) >= 1_000_000) return `$${trimNumber(number / 1_000_000)}M`;
  if (/usd\/share|usd per share|share/i.test(cleanUnit) && Math.abs(number) < 10000) return `$${trimNumber(number)}`;
  if (/usd/i.test(cleanUnit) && Math.abs(number) < 10000) return `$${trimNumber(number)}`;
  if (/hk\$/i.test(cleanUnit) && Math.abs(number) >= 1_000_000_000) return `HK$${trimNumber(number / 1_000_000_000)}B`;
  if (/hk\$/i.test(cleanUnit)) return `HK$${trimNumber(number)}`;
  return `${trimNumber(number)}${cleanUnit && cleanUnit !== "text" && cleanUnit !== "qualitative" ? ` ${cleanUnit}` : ""}`;
}

function percentValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${trimNumber(number)}%` : "—";
}

function money(value) {
  return Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";
}

function signedPercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number > 0 ? "+" : ""}${number.toFixed(1)}%` : "—";
}

function trimNumber(number) {
  return Number(number).toLocaleString("en-US", { maximumFractionDigits: Math.abs(number) < 10 ? 2 : 1 });
}

function periodFromIdentity(identity) {
  if (!identity?.fiscalQuarter || !identity?.fiscalYear) return null;
  return `${identity.fiscalQuarter} ${identity.fiscalYear}`;
}

function decisionColor(decision) {
  if (decision === "BUY" || decision === "ADD") return COLORS.green;
  if (decision === "SELL" || decision === "REDUCE") return COLORS.red;
  if (decision === "HOLD") return COLORS.amber;
  if (decision === "WATCH") return COLORS.blue;
  return COLORS.muted;
}

function statusColor(status) {
  if (status === "EXCEEDED" || status === "PASSED") return COLORS.green;
  if (status === "PARTIALLY_PASSED") return COLORS.amber;
  if (status === "FAILED") return COLORS.red;
  return COLORS.muted;
}

function upsideColor(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return COLORS.muted;
  if (number > 2) return COLORS.green;
  if (number < -2) return COLORS.red;
  return COLORS.amber;
}

function modeLabel(mode) {
  if (mode === "ADVANCE_TARGET") return "رفع الهدف";
  if (mode === "DEFEND_BASE") return "دفاع عن Base";
  if (mode === "RECOVERY") return "تعافي";
  return mode || "—";
}

function scenarioLabel(value) {
  if (value === "BULL") return "Bull";
  if (value === "INTERMEDIATE") return "Intermediate";
  if (value === "BASE_DEFENSE") return "Base Defense";
  if (value === "RECOVERY") return "Recovery";
  return value;
}

function tint(hex, alpha) {
  const raw = String(hex || "#000000").replace("#", "");
  const value = raw.length === 3 ? raw.split("").map((c) => `${c}${c}`).join("") : raw;
  const r = parseInt(value.slice(0, 2), 16) || 0;
  const g = parseInt(value.slice(2, 4), 16) || 0;
  const b = parseInt(value.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${alpha})`;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function containsArabic(value) {
  return /[\u0600-\u06FF]/.test(String(value || ""));
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function safeFilePart(value) {
  return String(value || "franklin").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "franklin";
}

function assertBrowserCanvas() {
  if (typeof document === "undefined") throw new Error("PNG export requires a browser document.");
}

autoInstall();
