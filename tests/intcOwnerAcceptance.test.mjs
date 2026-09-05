import assert from "node:assert/strict";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { validateExternalAnalysisReport } from "../src/externalAnalysis/externalAnalysisSchemaValidator.js";
import { attachCompletionStatus } from "../src/externalAnalysis/missingFields.js";
import {
  attachRequirementSetIdentityToReport,
  applyHistoricalRequirementLifecycle
} from "../src/externalAnalysis/historicalRequirements.js";
import { saveExternalAnalysis } from "../src/externalAnalysis/storage.js";

export const canonical = {
  schemaVersion: "franklin-fair-value/v3",
  methodologyVersion: "fair-value-methodology/v2",
  analysisType: "INITIAL",
  reportIdentity: {
    ticker: "INTC",
    companyName: "Intel Corporation",
    fiscalQuarter: "Q2",
    fiscalYear: 2026,
    periodEndDate: "2026-06-27",
    earningsReleaseDate: "2026-07-23",
    analysisDate: "2026-08-24",
    previousAnalysisId: null,
    previousRequirementSetId: null
  },
  company: {
    sector: "Technology",
    industry: "Semiconductors",
    reportingCurrency: "USD",
    tradingCurrency: "USD",
    securityUnit: "share"
  },
  companyProfile: {
    summary: "Intel تصمم وتبيع معالجات ومنصات للحواسيب الشخصية ومراكز البيانات، وفي الوقت نفسه تبني Intel Foundry لتصنيع الشرائح داخليًا ولعملاء خارجيين. جوهر الاستثمار هو نجاح تعافي منتجات الخوادم والعملاء بالتوازي مع خفض خسائر المصانع وتحويل الإنفاق الرأسمالي الضخم إلى عوائد مستدامة.",
    businessModel: "تجمع Intel بين نموذج شركة منتجات أشباه موصلات تبيع CPUs وASICs ومنصات حوسبة، ونموذج foundry رأسمالي يصنع الرقائق على عقد Intel المتقدمة. الإيراد يأتي أساسًا من Intel Products، بينما Intel Foundry ما زالت في مرحلة استثمار وخسائر تشغيلية كبيرة.",
    activities: [
      { name: "Client Computing", arabicName: "حوسبة العملاء", description: "معالجات ومنصات الحواسيب الشخصية، وهي مصدر كبير للإيراد والربح.", importance: "high" },
      { name: "Data Center and AI", arabicName: "مراكز البيانات والذكاء الاصطناعي", description: "معالجات الخوادم وASICs وحلول الحوسبة لمراكز البيانات، وهي محرك النمو الأسرع حاليًا.", importance: "critical" },
      { name: "Intel Foundry", arabicName: "مصانع Intel", description: "تصنيع الرقائق والتغليف المتقدم داخليًا ولعملاء خارجيين؛ نجاحه حاسم لتبرير رأس المال المستثمر.", importance: "critical" }
    ],
    customers: ["مصنعو الحواسيب", "مزودو الخدمات السحابية", "الشركات ومراكز البيانات", "عملاء foundry وASICs"],
    mainGrowthDrivers: ["طلب AI على الحوسبة العامة والخوادم", "تحسن مزيج وتسعير منتجات DCAI", "رفع إنتاجية Intel 18A", "استقطاب عملاء foundry خارجيين", "تحسن العوائد الصناعية وخفض تكلفة الوحدة"]
  },
  dataQuality: {
    score: 92,
    confidence: "HIGH",
    reportedDataThrough: "Q2 2026",
    missingCriticalFields: [],
    notes: ["تم استخدام بيانات Intel وSEC الرسمية للربع الثاني كأساس.", "مقياس EPS المستخدم للمقارنة مع consensus هو non-GAAP $0.42 مقابل consensus $0.21؛ خسارة GAAP البالغة $2.16 للسهم موضحة في السرد.", "السعر المستخدم هو آخر إغلاق متاح في 21 أغسطس 2026 وليس سعرًا حيًا."]
  },
  classification: {
    companyType: "Integrated semiconductor products and foundry",
    businessStage: "Turnaround and capital-intensive expansion",
    cyclicality: "مرتفع نسبيًا بسبب دورات أشباه الموصلات والإنفاق على مراكز البيانات والحواسيب",
    capitalIntensity: "مرتفع جدًا بسبب بناء وتشغيل المصانع والعقد المتقدمة",
    evidence: ["Intel Foundry تتطلب إنفاقًا رأسماليًا كبيرًا", "Q2 أظهر تحسنًا قويًا في المنتجات مع استمرار خسائر foundry", "الإدارة رفعت خطة Capex 2026 إلى نحو $20B"],
    confidence: "HIGH"
  },
  businessQuality: {
    score: 72,
    rating: "جيدة لكن عالية المخاطر التنفيذية",
    confidence: "MEDIUM",
    components: {
      growth: 82,
      profitability: 68,
      cashFlow: 45,
      balanceSheet: 66,
      capitalAllocation: 60,
      competitiveAdvantage: 78,
      management: 76
    },
    explanation: "قوة العلامة والمنظومة الهندسية وموقع Intel في x86 تحسنت ماليًا بوضوح، لكن جودة الأعمال ما زالت مقيدة بخسائر foundry، تقلب التدفق النقدي الحر، كثافة رأس المال، ومخاطر تنفيذ العقد المتقدمة."
  },
  strengths: [
    { title: "قفزة قوية في DCAI", explanation: "إيراد DCAI بلغ $6.262B ونما 59% سنويًا مع طلب AI قوي ومزيج منتجات أعلى.", evidence: ["DCAI revenue $6.262B", "59% YoY growth"], importance: "critical", durability: "متوسطة إلى مرتفعة إذا استمر الطلب وقدرة Intel على التوريد", valuationImpact: "يدعم رفع تقديرات الأرباح ومضاعفات أفضل إذا استدام النمو", confidence: "HIGH", sourceIds: ["S2"] },
    { title: "تعافي الهوامش والربحية التشغيلية", explanation: "الهامش الإجمالي GAAP ارتفع إلى 40.4% والهامش التشغيلي إلى 11.1% من مستويات سلبية حادة قبل عام.", evidence: ["GAAP gross margin 40.4%", "GAAP operating margin 11.1%"], importance: "high", durability: "مرهونة بالمزيج والعوائد الصناعية", valuationImpact: "يحسن قدرة الأرباح ويخفض خطر بقاء الشركة في خسائر هيكلية", confidence: "HIGH", sourceIds: ["S1"] },
    { title: "تحسن ملموس في اقتصاديات Foundry", explanation: "خسارة Intel Foundry التشغيلية انخفضت إلى $2.089B من $3.168B قبل عام، مع نمو الإيراد 31% تقريبًا.", evidence: ["Foundry revenue $5.765B", "Foundry operating loss $2.089B"], importance: "high", durability: "تحتاج عدة أرباع إضافية لإثباتها", valuationImpact: "أي اقتراب من التعادل سيحسن قيمة SOTP بقوة", confidence: "HIGH", sourceIds: ["S2"] },
    { title: "تعزيز السيولة عبر طرح الأسهم", explanation: "Intel سعّرت طرحًا موسعًا بقيمة $20B عند $95 للسهم، بصافي متوقع يقارب $19.7B، ما يدعم تمويل Capex ورأس المال العامل.", evidence: ["210,526,315 shares at $95", "approximately $19.7B expected net proceeds before optional allotment"], importance: "high", durability: "مرتفعة من ناحية السيولة لكنها تأتي مقابل تخفيف الملكية", valuationImpact: "يخفض مخاطر التمويل ويزيد في المقابل dilution", confidence: "HIGH", sourceIds: ["S5"] }
  ],
  weaknesses: [
    { title: "Foundry لا تزال تسجل خسائر ضخمة", explanation: "رغم التحسن، خسارة foundry التشغيلية $2.089B في ربع واحد ما تزال استنزافًا اقتصاديًا كبيرًا.", evidence: ["Foundry operating loss $2.089B"], severity: "critical", persistence: "متوسطة إلى مرتفعة حتى تتحسن الأحجام والعوائد", valuationImpact: "تضغط على SOTP والتدفقات النقدية", monitoringIndicator: "Intel Foundry operating loss and external revenue", confidence: "HIGH", sourceIds: ["S2"] },
    { title: "التدفق النقدي الحر ضعيف بسبب الاستثمار", explanation: "Adjusted FCF في Q2 كان سالب $8.419B رغم $7.0B من التدفق التشغيلي، ما يوضح شدة متطلبات الاستثمار.", evidence: ["Adjusted free cash flow -$8.419B", "Operating cash flow about $7.0B"], severity: "high", persistence: "قد يستمر مع زيادة Capex", valuationImpact: "يحد من ملاءمة DCF التقليدي ويرفع حساسية القيمة للتمويل", monitoringIndicator: "Adjusted FCF and net capex", confidence: "HIGH", sourceIds: ["S1"] },
    { title: "قيود التوريد", explanation: "Intel أفصحت أن الطلب تجاوز الإمداد المتاح وتتوقع استمرار قيود الصناعة إلى العام القادم.", evidence: ["Demand exceeded available product supply in Q2", "Supply constraints expected to persist into next year"], severity: "high", persistence: "متوسطة", valuationImpact: "قد تمنع تحويل كامل الطلب إلى إيراد", monitoringIndicator: "Factory yields, cycle times and product availability", confidence: "HIGH", sourceIds: ["S2"] },
    { title: "تخفيف ملكية المساهمين", explanation: "الطرح الكبير يحسن الميزانية لكنه يضيف أكثر من 210 مليون سهم قبل خيار التخصيص الإضافي.", evidence: ["210,526,315 shares offered"], severity: "medium", persistence: "دائم على عدد الأسهم", valuationImpact: "يخفض القيمة لكل سهم مقارنة بحالة عدم الإصدار", monitoringIndicator: "Diluted share count", confidence: "HIGH", sourceIds: ["S5"] }
  ],
  marketPrice: {
    value: 90.07,
    currency: "USD",
    asOf: "2026-08-21",
    priceType: "LAST_CLOSE",
    sourceId: "S4"
  },
  latestQuarter: {
    summary: "Q2 2026 كان ربع تحول قوي تشغيليًا: الإيراد $16.128B (+25% YoY) وتجاوز consensus بوضوح، وnon-GAAP EPS بلغ $0.42 مقابل $0.21 متوقع، مع تحسن حاد في الهوامش. في المقابل، GAAP EPS كان -$2.16 بسبب بنود كبيرة غير تشغيلية، وAdjusted FCF بقي سالبًا بقوة. DCAI كان المحرك الأبرز، بينما تحسنت خسائر Foundry لكنها ما تزال كبيرة.",
    coreMetrics: {
      revenue: { actualValue: 16128000000, unit: "USD", consensusValue: 14420000000, priorYearValue: 12859000000, yoyPct: 25.4218835057, qoqPct: null, result: "BEAT", sourceId: "S1" },
      eps: { actualValue: 0.42, unit: "USD/share non-GAAP", consensusValue: 0.21, priorYearValue: -0.10, yoyPct: null, result: "BEAT", sourceId: "S1" },
      grossMarginPct: { actualValue: 40.4, consensusValue: null, priorYearValue: 27.5, result: "NA", sourceId: "S1" },
      operatingMarginPct: { actualValue: 11.1, consensusValue: null, priorYearValue: -24.7, result: "NA", sourceId: "S1" },
      freeCashFlow: { actualValue: -8419000000, unit: "USD adjusted FCF", priorYearValue: -1050000000, yoyPct: null, sourceId: "S1" },
      cash: { actualValue: 12874000000, unit: "USD", sourceId: "S2" },
      debt: { actualValue: 50537000000, unit: "USD", sourceId: "S2" }
    },
    companySpecificKpis: [
      { id: "dcai_revenue", name: "DCAI Revenue", arabicName: "إيرادات DCAI", actualValue: 6262000000, actualDisplay: "$6.262B", priorValue: 3939000000, yoyPct: 58.9743589744, qoqPct: null, result: "NA", importance: "critical", interpretation: "نمو قوي مدفوع بمزيج الخوادم وطلب AI وASICs.", sourceId: "S2" },
      { id: "ccpg_revenue", name: "CCPG Revenue", arabicName: "إيرادات CCPG", actualValue: 8877000000, actualDisplay: "$8.877B", priorValue: 7871000000, yoyPct: 12.7810951594, qoqPct: null, result: "NA", importance: "high", interpretation: "نمو جيد في الحواسيب مع مزيج منتجات أعلى.", sourceId: "S2" },
      { id: "foundry_revenue", name: "Intel Foundry Revenue", arabicName: "إيرادات Intel Foundry", actualValue: 5765000000, actualDisplay: "$5.765B", priorValue: 4417000000, yoyPct: 30.5184514376, qoqPct: null, result: "NA", importance: "high", interpretation: "نمو جيد لكن معظم الإيراد ما يزال داخليًا بين القطاعات.", sourceId: "S2" },
      { id: "foundry_operating_loss", name: "Intel Foundry Operating Loss", arabicName: "خسارة Intel Foundry التشغيلية", actualValue: -2089000000, actualDisplay: "-$2.089B", priorValue: -3168000000, yoyPct: null, qoqPct: null, result: "NA", importance: "critical", interpretation: "الخسارة تقلصت بوضوح لكنها تبقى أكبر نقطة ضغط على الاقتصاديات.", sourceId: "S2" },
      { id: "external_foundry_revenue", name: "External Foundry Revenue", arabicName: "إيراد Foundry الخارجي", actualValue: 293000000, actualDisplay: "$293M", priorValue: 22000000, yoyPct: null, qoqPct: null, result: "NA", importance: "high", interpretation: "تحسن من قاعدة صغيرة جدًا؛ نجاح foundry الخارجي يحتاج نموًا أكبر بكثير.", sourceId: "S2" }
    ],
    guidance: [
      { period: "Q3 2026", topic: "Revenue", previousGuidance: null, currentGuidance: "$15.8B-$16.8B", direction: "new", interpretation: "المنتصف $16.3B يشير إلى استمرار مستوى إيراد قوي بعد Q2.", sourceId: "S1" },
      { period: "Q3 2026", topic: "Non-GAAP EPS", previousGuidance: null, currentGuidance: "$0.38", direction: "new", interpretation: "يوحي باستمرار الربحية المعدلة رغم الاستثمار المرتفع.", sourceId: "S1" },
      { period: "Q3 2026", topic: "GAAP Gross Margin", previousGuidance: null, currentGuidance: "41.0%", direction: "new", interpretation: "استمرار تحسن الهامش هو شرط مهم للدفاع عن التقييم.", sourceId: "S1" },
      { period: "FY2026", topic: "Capital Expenditure", previousGuidance: "$18B", currentGuidance: "$20B", direction: "raised", interpretation: "Intel تزيد الاستثمار لدعم الطلب والنمو لكنها تؤخر تطبيع FCF.", sourceId: "S3" }
    ],
    forwardOutlook: {
      growthOutlook: "stable",
      marginOutlook: "improving",
      fcfOutlook: "pressured",
      demandOutlook: "improving",
      capacityOutlook: "constrained",
      executionOutlook: "improving",
      guidanceTrend: "raised",
      managementTone: "positive",
      summary: "المشهد الأمامي إيجابي للطلب والهوامش لكنه مقيد بالقدرة الإنتاجية والإنفاق الرأسمالي. Q3 guidance يدعم استمرار الإيراد القوي، بينما جودة FCF ستبقى أضعف نقطة حتى تنخفض كثافة الاستثمار."
    }
  },
  forecast: {
    materiality: "MATERIAL",
    yearlyForecast: [
      {
        period: "FY2026E",
        revenue: { value: 63000000000, basis: "analyst_assumption" },
        revenueGrowthPct: { value: 19, basis: "analyst_assumption" },
        eps: { value: 1.50, basis: "analyst_assumption" },
        ebitda: { value: 22000000000, basis: "analyst_assumption" },
        ebitdaMarginPct: { value: 34.9, basis: "analyst_assumption" },
        freeCashFlow: { value: null, basis: null },
        fcfMarginPct: { value: null, basis: null }
      },
      {
        period: "FY2027E",
        revenue: { value: 71000000000, basis: "analyst_assumption" },
        revenueGrowthPct: { value: 12.7, basis: "analyst_assumption" },
        eps: { value: 2.00, basis: "analyst_assumption" },
        ebitda: { value: 28000000000, basis: "analyst_assumption" },
        ebitdaMarginPct: { value: 39.4, basis: "analyst_assumption" },
        freeCashFlow: { value: null, basis: null },
        fcfMarginPct: { value: null, basis: null }
      }
    ],
    estimateRevisions: [
      { metric: "Revenue", period: "FY2026E", previousEstimate: null, updatedEstimate: 63000000000, unit: "USD", changePct: null, reason: "افتراض محلل مبني على Q2 القوي وQ3 guidance، وليس رقمًا معلنًا من الشركة." }
    ],
    changedAssumptions: [
      { metric: "Revenue trajectory", period: "2026-2027", previousValue: null, updatedValue: "أقوى من التوقع السابق نوعيًا", unit: "text", direction: "UP", reason: "Q2 beat الكبير واستمرار طلب AI ورفع Q3 outlook.", sourceId: "S1" },
      { metric: "Capital intensity", period: "FY2026", previousValue: 18000000000, updatedValue: 20000000000, unit: "USD capex", direction: "UP", reason: "الإدارة رفعت خطة الإنفاق الرأسمالي لدعم الطلب والسعة.", sourceId: "S3" }
    ],
    wacc: { value: 10.5, rangeLow: 9.5, rangeHigh: 11.5, reason: "مخاطر تنفيذ foundry وكثافة رأس المال تعوض جزئيًا قوة السيولة والمنصة." },
    terminalGrowth: { value: 3.0, reason: "افتراض طويل الأجل محافظ نسبيًا لصناعة دورية لكن مدعومة بنمو الحوسبة." },
    sensitivity: [],
    summary: "التوقع يفترض استمرار نمو DCAI وتحسن الهوامش، مع بقاء FCF ضعيفًا مؤقتًا بسبب Capex. أهم متغيرين هما سرعة خفض خسائر Foundry واستمرار الطلب الذي يسمح باستغلال السعة الجديدة."
  },
  previousRequirementsEvaluation: null,
  valuation: {
    reviewStatus: "INITIAL",
    previous: null,
    current: { bear: 55, base: 85, bull: 135, probabilityWeighted: 90, currency: "USD", securityUnit: "share", confidence: "MEDIUM" },
    change: null,
    methodology: {
      primaryMethod: "Forward P/E",
      secondaryMethods: ["EV/EBIT", "SOTP"],
      excludedMethods: [
        { method: "DCF", reason: "Adjusted FCF شديد التشوه حاليًا بسبب دورة استثمار foundry وCapex، لذلك الاعتماد عليه كطريقة أساسية سيخلق حساسية زائفة." },
        { method: "Dividend Discount Model", reason: "القصة الاستثمارية ليست عائد توزيعات بل تعافي الأرباح وإعادة بناء foundry." }
      ],
      methodologyChanged: false,
      selectionReason: "Forward P/E يلتقط تعافي EPS، EV/EBIT يوازن أثر هيكل التمويل، وSOTP ضروري لفصل قيمة المنتجات عن مخاطر Foundry.",
      modelWeights: [
        { method: "Forward P/E", weight: 45 },
        { method: "EV/EBIT", weight: 35 },
        { method: "SOTP", weight: 20 }
      ],
      weightReasoning: "أعلى وزن لمضاعف الأرباح لأن تعافي الربحية هو محرك السهم الأقرب، مع وزن معتبر لـEV/EBIT وSOTP بسبب اختلاف اقتصاديات المنتجات وFoundry.",
      limitations: ["التقييم حساس جدًا لسرعة تعافي EPS وخسائر Foundry.", "طرح الأسهم الكبير يغير عدد الأسهم ويجب تحديثه في النماذج مع الإفصاحات اللاحقة."]
    },
    valuationResults: [
      { method: "Forward P/E", role: "PRIMARY", fairValue: 82, weight: 45, confidence: "MEDIUM", inputs: { normalizedForwardEps: 2.0, impliedMultiple: 41 }, assumptions: { horizon: "FY2027E" }, rationale: "مضاعف مرتفع نسبيًا لكنه يعكس تحول الربحية وإمكانية نمو EPS من قاعدة متعافية.", limitations: "يتأثر بشدة بتغير EPS والمضاعف خلال دورة التحول." },
      { method: "EV/EBIT", role: "SECONDARY", fairValue: 86, weight: 35, confidence: "MEDIUM", inputs: { normalizedOperatingProfitability: "2027E turnaround" }, assumptions: { foundryLossesDecline: true }, rationale: "يوازن أثر الدين والسيولة ويعطي وزنًا لارتفاع الربحية التشغيلية.", limitations: "يتطلب افتراضات عن صافي الدين بعد تمويل الأسهم والإنفاق الرأسمالي." },
      { method: "SOTP", role: "SECONDARY", fairValue: 95, weight: 20, confidence: "LOW", inputs: { products: "CCPG + DCAI", foundry: "risk-adjusted" }, assumptions: { externalFoundryScaleUp: "gradual" }, rationale: "يفصل قيمة أعمال المنتجات المربحة عن Foundry عالية المخاطر، وهو مهم لأن النتائج القطاعية متباينة جدًا.", limitations: "قيمة Foundry غير يقينية وتعتمد على 18A/14A والعملاء الخارجيين." }
    ],
    scenarios: {
      Bear: { probability: 25, fairValue: 55, assumptions: ["تباطؤ DCAI", "استمرار خسائر Foundry قرب المستويات الحالية", "Capex مرتفع وFCF ضعيف", "تأخر 18A/14A أو ضعف العملاء الخارجيين"], requiredOutcomes: ["عدم تحقق تحسن مستدام في الهامش"], keyRisks: ["foundry execution", "dilution", "cycle slowdown"] },
      Base: { probability: 50, fairValue: 85, assumptions: ["إيراد 2026 قرب $63B", "تحسن تدريجي للهامش", "DCAI يبقى قويًا", "Foundry تقلص الخسائر على عدة أرباع", "18A يتقدم دون تعثر مادي"], requiredOutcomes: ["Q3 ضمن guidance", "خفض تدريجي لخسائر foundry", "استمرار طلب AI"], keyRisks: ["capital intensity", "supply constraints"] },
      Bull: { probability: 25, fairValue: 135, assumptions: ["DCAI يحافظ على نمو مرتفع", "Foundry يقترب بسرعة أكبر من التعادل", "18A و14A يجذبان عملاء خارجيين كبار", "هوامش المنتجات تتوسع بقوة"], requiredOutcomes: ["تسارع external foundry revenue", "تحسن كبير في FCF بعد ذروة Capex"], keyRisks: ["execution still required"] }
    },
    valuationBridge: { positiveDrivers: ["Q2 revenue/EPS beat", "DCAI +59% YoY", "تحسن gross/operating margin", "تحسن Foundry loss", "تعزيز السيولة عبر طرح الأسهم"], negativeDrivers: ["سعر السوق يعكس نجاحًا كبيرًا مسبقًا", "Adjusted FCF -$8.419B", "Foundry loss ما زالت كبيرة", "dilution", "supply constraints"], whyBaseChangedOrNot: "Initial valuation." },
    upsideToBasePct: -5.6289552570,
    marginOfSafetyPct: -5.9647058824
  },
  thesis: {
    status: "INITIAL",
    previousSummary: null,
    updatedSummary: "Intel دخلت مرحلة تعافٍ تشغيلي حقيقية يقودها DCAI وتحسن الهوامش والعوائد الصناعية، لكن عند سعر يقارب $90 أصبح جزء مهم من نجاح التحول مسعرًا. القيمة لكل سهم تعتمد على تحويل نمو AI إلى أرباح مستدامة، خفض خسائر Foundry، وعبور ذروة Capex دون مزيد من التخفيف غير المنضبط.",
    changeReason: "Initial analysis.",
    keySupports: ["نمو DCAI 59% YoY", "Revenue beat كبير في Q2", "تحسن الهامش التشغيلي", "انخفاض خسائر Foundry", "سيولة إضافية من طرح الأسهم"],
    keyThreats: ["خسائر Foundry وكثافة رأس المال", "Adjusted FCF سلبي جدًا", "التخفيف الناتج عن طرح الأسهم", "قيود التوريد", "خطر تنفيذ 18A/14A"]
  },
  decision: {
    scope: "STOCK_LEVEL",
    action: "WATCH",
    confidence: 76,
    investmentScore: 64,
    rationale: ["التحول التشغيلي أقوى بوضوح من العام السابق.", "Q2 تفوق على التوقعات وDCAI قوي.", "السعر $90.07 أعلى من Base Fair Value $85، لذلك لا توجد margin of safety كافية للشراء الآن.", "الاستثمار في Foundry قد يخلق قيمة كبيرة لكنه ما زال يتطلب إثباتًا في الخسائر والعملاء والتدفق النقدي."],
    whyNot: ["ليست BUY/ADD لأن السعر الحالي يتجاوز Base ولأن FCF وخسائر Foundry ما زالت مرتفعة.", "ليست REDUCE/SELL لأن قوة DCAI وتحسن الهوامش وخفض خسائر Foundry تشير إلى تحول حقيقي وليس مجرد تحسن مؤقت مؤكد الانعكاس."],
    biggestAssumption: "أن نمو DCAI وتحسن العوائد الصناعية سيستمران بما يكفي لتعويض تكلفة بناء Foundry.",
    mainRisk: "فشل Foundry في خفض الخسائر أو جذب أحجام خارجية كافية بعد إنفاق رأسمالي وتخفيف كبير للمساهمين.",
    upgradeTriggers: ["سعر أقل بوضوح من Base مع بقاء الفرضية سليمة", "خفض Foundry loss أسرع من المتوقع", "تحسن FCF مع ثبات النمو", "إثبات عملاء خارجيين ماديين لـ18A/14A"],
    downgradeTriggers: ["تراجع DCAI أو guidance", "توقف تحسن gross margin", "زيادة خسائر Foundry", "تأخر مادي في 18A/14A", "مزيد من التخفيف دون عائد تشغيلي واضح"]
  },
  nextRequirements: {
    requirementSetId: null,
    mode: "DEFEND_BASE",
    previousQuarter: "Q2 2026",
    targetQuarter: "Q3 2026",
    currentJustifiedValue: 85,
    targetValue: 85,
    targetScenario: "BASE_DEFENSE",
    targetDescription: "للدفاع عن Base $85 يجب أن تثبت Q3 أن قوة الطلب والهوامش ليست عابرة، مع تقدم واضح في خفض خسائر Foundry وعدم تدهور التنفيذ.",
    summary: "المجموعة تدافع عن Base بدل رفع الهدف لأن سعر السوق الحالي أعلى من Base؛ المطلوب الآن إثبات الاستدامة لا مجرد تكرار Q2.",
    requirements: [
      { id: "q3_revenue", name: "Q3 Revenue", arabicName: "إيرادات Q3", metric: "Revenue", type: "minimum", baselineValue: 16128000000, baselineDisplay: "$16.128B", requiredValue: 15800000000, requiredDisplay: ">= $15.8B", unit: "USD", importance: "critical", weight: 20, whyItMatters: "الحد الأدنى الرسمي للـguidance يختبر استدامة الطلب بعد Q2 القوي.", status: "NOT_REPORTED" },
      { id: "q3_nongaap_eps", name: "Q3 Non-GAAP EPS", arabicName: "ربحية Q3 المعدلة", metric: "Non-GAAP EPS", type: "minimum", baselineValue: 0.42, baselineDisplay: "$0.42", requiredValue: 0.38, requiredDisplay: ">= $0.38", unit: "USD/share", importance: "high", weight: 15, whyItMatters: "يحمي فرضية أن نمو الإيراد يتحول إلى ربحية معدلة.", status: "NOT_REPORTED" },
      { id: "q3_gaap_gross_margin", name: "Q3 GAAP Gross Margin", arabicName: "الهامش الإجمالي GAAP في Q3", metric: "GAAP Gross Margin", type: "minimum", baselineValue: 40.4, baselineDisplay: "40.4%", requiredValue: 41.0, requiredDisplay: ">= 41.0%", unit: "%", importance: "high", weight: 15, whyItMatters: "توسع الهامش أساسي لرفع قدرة الأرباح وتغطية الاستثمار.", status: "NOT_REPORTED" },
      { id: "q3_dcai_revenue", name: "Q3 DCAI Revenue", arabicName: "إيرادات DCAI في Q3", metric: "DCAI Revenue", type: "minimum", baselineValue: 6262000000, baselineDisplay: "$6.262B", requiredValue: 6300000000, requiredDisplay: ">= $6.3B", unit: "USD", importance: "critical", weight: 15, whyItMatters: "DCAI هو محرك إعادة تسعير Intel في دورة AI؛ الحفاظ على مستوى Q2 تقريبًا ضروري للـBase.", status: "NOT_REPORTED" },
      { id: "q3_foundry_loss", name: "Intel Foundry Operating Loss", arabicName: "خسارة Intel Foundry التشغيلية", metric: "Intel Foundry Operating Loss Absolute", type: "maximum", baselineValue: 2089000000, baselineDisplay: "$2.089B loss", requiredValue: 2000000000, requiredDisplay: "<= $2.0B loss", unit: "USD absolute loss", importance: "critical", weight: 20, whyItMatters: "خفض الخسارة هو أهم دليل أن رأس المال المستثمر في Foundry يتحول تدريجيًا إلى اقتصاديات أفضل.", status: "NOT_REPORTED" },
      { id: "q3_18a_execution", name: "18A Execution", arabicName: "تنفيذ Intel 18A", metric: "18A Execution", type: "qualitative", baselineValue: null, baselineDisplay: "18A ramp progressing; yields/cycle times improved in Q2", requiredValue: null, requiredDisplay: "No material delay; continued yield/volume progress", unit: "qualitative", importance: "critical", weight: 15, whyItMatters: "نجاح 18A جوهري لقيمة المنتجات وFoundry وللمصداقية الاستراتيجية.", status: "NOT_REPORTED" }
    ]
  },
  risks: [
    { title: "مخاطر تنفيذ Foundry", severity: "critical", explanation: "أي تأخير في 18A/14A أو ضعف أحجام العملاء الخارجيين قد يحول الإنفاق الرأسمالي إلى عائد ضعيف.", whatToMonitor: "18A yields, 14A customer commitments, external foundry revenue, foundry operating loss", thesisBreaker: "تأخر مادي متكرر مع بقاء الخسائر قرب المستويات الحالية دون مسار واضح للتحسن", sourceIds: ["S2"] },
    { title: "كثافة رأس المال وFCF", severity: "high", explanation: "زيادة Capex إلى نحو $20B وAdjusted FCF السلبي يزيدان حساسية الاستثمار للتمويل والعوائد المستقبلية.", whatToMonitor: "Capex, adjusted FCF, net debt and liquidity", thesisBreaker: "استمرار FCF شديد السلبية دون تحسن في الأرباح أو Foundry", sourceIds: ["S1", "S3"] },
    { title: "التخفيف", severity: "high", explanation: "الطرح البالغ $20B يدعم التمويل لكنه يخفض حصة المساهم القائم من الأرباح المستقبلية.", whatToMonitor: "Diluted share count and use of proceeds", thesisBreaker: "إصدارات إضافية كبيرة دون عائد تشغيلي", sourceIds: ["S5"] },
    { title: "قيود الإمداد", severity: "medium", explanation: "الطلب قد يبقى أعلى من قدرة Intel على التوريد، ما يحد من الإيراد ويضغط تكلفة الوحدة.", whatToMonitor: "Factory capacity, yields and cycle times", thesisBreaker: "فقدان عملاء أو طلب بسبب عدم القدرة على التوريد", sourceIds: ["S2"] },
    { title: "الدورة والمنافسة", severity: "high", explanation: "Intel تواجه AMD وArm/مسرعات AI ومصانع TSMC؛ تباطؤ دورة الخوادم أو فقدان الحصة قد يخفض التوقعات سريعًا.", whatToMonitor: "Server share, ASPs, product roadmap and hyperscaler demand", thesisBreaker: "انكماش مستدام في DCAI أو فقدان تنافسية المنتج", sourceIds: ["S2"] }
  ],
  catalysts: [
    { title: "استمرار DCAI فوق التوقعات", explanation: "استدامة نمو الخوادم وASICs قد ترفع EPS المتوقع وتدعم مضاعفًا أعلى.", timeframe: "Q3-Q4 2026", sourceIds: ["S1", "S2"] },
    { title: "خفض أسرع لخسائر Foundry", explanation: "تحسن الخسائر مع نمو الإيراد الخارجي سيكون أقوى دليل على نجاح إعادة الهيكلة.", timeframe: "2026-2027", sourceIds: ["S2"] },
    { title: "إثبات عملاء 18A/14A خارجيين", explanation: "عقود خارجية مادية تقلل مخاطر أن تكون مصانع Intel عبئًا داخليًا فقط.", timeframe: "2026-2028", sourceIds: ["S2"] },
    { title: "تطبيع FCF بعد ذروة Capex", explanation: "الانتقال من استهلاك السيولة إلى توليد نقدي سيحسن جودة الاستثمار والتقييم.", timeframe: "2027+", sourceIds: ["S1", "S3"] }
  ],
  monitoringChecklist: [
    { metric: "Quarterly Revenue", currentValue: "$16.128B", expectedRange: "$15.8B-$16.8B Q3 guide", upgradeTrigger: "Sustained above guide with margin expansion", downgradeTrigger: "Below guide", thesisBreak: "Multi-quarter revenue reversal without cyclical explanation" },
    { metric: "DCAI Revenue", currentValue: "$6.262B", expectedRange: ">= $6.3B Q3 analyst floor", upgradeTrigger: "Continued strong YoY growth", downgradeTrigger: "Sequential decline with weaker demand", thesisBreak: "Sustained share/demand loss" },
    { metric: "GAAP Gross Margin", currentValue: "40.4%", expectedRange: ">= 41% Q3 guide", upgradeTrigger: ">43% with stable demand", downgradeTrigger: "Below 40%", thesisBreak: "Persistent margin reversal" },
    { metric: "Intel Foundry Operating Loss", currentValue: "-$2.089B", expectedRange: "Improving toward < $2.0B loss", upgradeTrigger: "Materially faster loss reduction", downgradeTrigger: "Loss widens", thesisBreak: "No credible path to materially lower losses" },
    { metric: "Adjusted Free Cash Flow", currentValue: "-$8.419B", expectedRange: "Pressured during peak investment", upgradeTrigger: "Clear normalization toward positive FCF", downgradeTrigger: "Worsening cash burn with no earnings payoff", thesisBreak: "Chronic cash burn requiring repeated dilution" },
    { metric: "18A/14A Execution", currentValue: "18A ramp progressing", expectedRange: "No material roadmap delay", upgradeTrigger: "External wins plus improving yields", downgradeTrigger: "Material delay or customer loss", thesisBreak: "Roadmap failure undermining foundry economics" }
  ],
  sources: [
    { id: "S1", title: "Intel Reports Second-Quarter 2026 Financial Results", type: "SEC", date: "2026-07-23", url: "https://www.sec.gov/Archives/edgar/data/50863/000005086326000155/q226earningsrelease.htm", usedFor: ["latestQuarter", "guidance", "financials", "cashFlow"] },
    { id: "S2", title: "Intel Q2 2026 Form 10-Q", type: "SEC", date: "2026-07-23", url: "https://www.sec.gov/Archives/edgar/data/50863/000005086326000157/intc-20260627.htm", usedFor: ["latestQuarter", "segments", "balanceSheet", "foundry", "risks"] },
    { id: "S3", title: "Intel forecast crushes estimates as AI boom boosts chip demand", type: "Trusted Financial News", date: "2026-07-23", url: "https://www.reuters.com/business/intel-forecasts-upbeat-quarterly-revenue-profit-strong-ai-driven-server-chip-2026-07-23/", usedFor: ["consensus", "guidance", "capex", "industryContext"] },
    { id: "S4", title: "Intel Corporation Historical Data", type: "Market Data", date: "2026-08-21", url: "https://www.investing.com/equities/intel-corp-historical-data", usedFor: ["marketPrice"] },
    { id: "S5", title: "Intel Announces Upsize and Pricing of $20 Billion Common Stock Offering", type: "Investor Relations", date: "2026-08-10", url: "https://newsroom.intel.com/corporate/intel-announces-upsize-and-pricing-of-20-billion-common-stock-offering", usedFor: ["capitalStructure", "liquidity", "dilution", "valuation"] }
  ],
  limitations: [
    "القيمة العادلة شديدة الحساسية لمسار Foundry، وهو نشاط لم يثبت بعد عائدًا اقتصاديًا مستدامًا.",
    "السعر المستخدم آخر إغلاق وليس سعرًا حيًا في 24 أغسطس 2026.",
    "التوقعات السنوية الموسومة analyst_assumption ليست guidance رسميًا ولا consensus منقولًا.",
    "صافي السيولة بعد إغلاق طرح أغسطس والإنفاق اللاحق للربع يحتاج تحديثًا مع الإفصاح المالي التالي."
  ],
  audit: {
    scenarioProbabilityTotalPct: 100,
    valuationMethodWeightTotalPct: 100,
    previousRequirementWeightTotalPct: null,
    nextRequirementWeightTotalPct: 100,
    consistencyNotes: [
      "EPS beat compares non-GAAP actual $0.42 with non-GAAP/adjusted consensus $0.21; GAAP EPS -$2.16 is disclosed separately.",
      "Adjusted FCF is used because Intel reports it as a non-GAAP liquidity metric during the foundry investment cycle.",
      "DEFEND_BASE allows Q3 maintenance floors at or near Q2 actuals because the current market price already exceeds Base Fair Value."
    ]
  }
};

const directValidation = validateFranklinV3Report(canonical);
assert.equal(directValidation.valid, true, `Direct V3 validation failed:\n${JSON.stringify(directValidation.errors, null, 2)}`);

const fenced = `\`\`\`json\n${JSON.stringify(canonical)}\n\`\`\``;
const parsed = await parseExternalAnalysisInput(fenced);
assert.equal(parsed.usedAi, false);
assert.equal(parsed.report.company.ticker, "INTC");
assert.equal(parsed.report.reportPeriod, "Q2 2026");

const externalValidation = validateExternalAnalysisReport(parsed.report);
assert.equal(externalValidation.valid, true, `Adapted external validation failed:\n${JSON.stringify(externalValidation.errors, null, 2)}`);

const withCompletion = attachCompletionStatus(parsed.report, externalValidation);
const deterministic = {
  ...withCompletion,
  id: "INTC-2026-08-24-owner-acceptance"
};
const readyToSave = attachRequirementSetIdentityToReport(deterministic, new Date("2026-08-24T15:30:00.000Z"));
assert.ok(readyToSave.priceTargetRequirements?.requirementSetId, "Requirement Set ID must be assigned before save.");

const saved = saveExternalAnalysis({}, readyToSave, {
  allowDuplicate: true,
  now: new Date("2026-08-24T15:30:00.000Z")
});
assert.equal(saved.report.company.ticker, "INTC");
assert.equal(saved.report.fairValueSummary.fairValueBase, 85);
assert.equal(saved.report.decision.action, "WATCH");
assert.equal(saved.report.priceTargetRequirements.mode, "DEFEND_BASE");
assert.equal(saved.report.priceTargetRequirements.targetQuarter, "Q3 2026");
assert.equal(saved.report.priceTargetRequirements.requirements.length, 6);
assert.ok(saved.report.priceTargetRequirements.requirements.every((item) => item.status === "NOT_REPORTED"));

const historical = applyHistoricalRequirementLifecycle({}, saved.report, {}, new Date("2026-08-24T15:30:00.000Z"));
assert.equal(historical.INTC.length, 1);
assert.equal(historical.INTC[0].status, "OPEN");
assert.equal(historical.INTC[0].targetQuarter, "Q3 2026");
assert.equal(historical.INTC[0].requirements.length, 6);

const payload = {
  canonical,
  savedReport: saved.report,
  historicalRequirementSets: historical.INTC
};
console.log(`INTC_OWNER_ACCEPTANCE_B64:${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`);
console.log("INTC owner acceptance: PASS");
