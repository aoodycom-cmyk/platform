export const LANGUAGE_SYSTEM = {
  locale: "ar-SA",
  direction: "rtl",
  numericDirection: "ltr"
};

export const LANGUAGES = {
  AR: "ar",
  EN: "en"
};

let activeLanguage = LANGUAGES.AR;

const MISSING_AR = "غير متوفر من بيانات موثقة.";
const MISSING_EN = "Not available from verified data.";

const UI_LABELS = {
  Home: "الرئيسية",
  Executive: "الملخص",
  Valuation: "Valuation",
  Quality: "Quality",
  Growth: "Growth",
  Moat: "Economic Moat",
  Risk: "Risk",
  Research: "البحث",
  Watchlist: "قائمة المتابعة",
  Settings: "الإعدادات",
  History: "السجل",
  "Institutional Research": "البحث المؤسسي",
  "AI Equity Research Platform": "منصة أبحاث الأسهم",
  "Daily investment workspace": "مساحة العمل اليومية للمستثمر",
  "Equity research layer": "طبقة أبحاث الأسهم",
  "Version 5": "الإصدار 5",
  "Version 5.1": "الإصدار 5.1",
  "Version 6": "الإصدار 6",
  "Version 7": "الإصدار 7",
  "Valuation Workspace": "مساحة تقييم الشركة",
  "Build an approved valuation before it reaches Home": "ابنِ تقييمًا معتمدًا قبل ظهوره في الرئيسية",
  "Search a ticker, paste data, review it, run the fixed analyst, then approve and export.": "ابحث عن رمز السهم، ألصق البيانات، راجعها، شغّل المحلل الثابت، ثم اعتمد وصدّر.",
  "Open a valuation workspace, not a final decision.": "افتح مساحة تقييم، وليس قرارًا نهائيًا.",
  Data: "البيانات",
  "Paste or enter company data and confirm the source.": "ألصق أو أدخل بيانات الشركة وأكد المصدر.",
  Approve: "اعتمد",
  "Only approved valuations appear in the dashboard.": "فقط التقييمات المعتمدة تظهر في الداشبورد.",
  "Toggle theme": "تغيير الوضع",
  Light: "فاتح",
  Dark: "داكن",
  Search: "بحث",
  Searching: "جاري البحث",
  "Start analysis": "ابدأ التحليل",
  "New analysis": "تحليل جديد",
  "Start here": "ابدأ من هنا",
  "Enter a ticker to start": "اكتب رمز السهم للبدء",
  "Analyze any stock in three steps": "حلل أي سهم في ثلاث خطوات",
  "Type a ticker, choose the company, then read the decision summary first.": "اكتب رمز السهم، اختر الشركة، ثم اقرأ ملخص القرار أولًا.",
  "Common examples": "أمثلة شائعة",
  Choose: "اختر",
  Read: "اقرأ",
  "Use a ticker like AAPL or MSFT.": "استخدم رمزًا مثل AAPL أو MSFT.",
  "Tap the company result to run the analysis.": "اضغط نتيجة الشركة لتشغيل التحليل.",
  "Start with Buy, Hold, or Sell before the details.": "ابدأ بقرار Buy أو Hold أو Sell قبل التفاصيل.",
  "Market data key connected": "مفتاح بيانات السوق متصل",
  "Add FMP key for live data": "أضف مفتاح FMP للبيانات الحية",
  "Tap to analyze": "اضغط للتحليل",
  "Open valuation workspace": "افتح مساحة التقييم",
  "Search for a company to open a disciplined valuation workspace.": "ابحث عن شركة لفتح مساحة تقييم منضبطة.",
  "Research status": "حالة البحث",
  "Data completeness": "اكتمال البيانات",
  "Last saved": "آخر حفظ",
  Methodology: "المنهجية",
  "Open Workspace": "فتح المساحة",
  "Paste / Enter Data": "لصق / إدخال البيانات",
  "Review and Confirm Data": "مراجعة وتأكيد البيانات",
  "Run Valuation Analyst": "تشغيل محلل التقييم",
  "Approve and Export": "اعتماد وتصدير",
  "Input Data": "إدخال البيانات",
  "Paste tables or enter values manually. Every value keeps source, date, confidence, and confirmation status.": "ألصق الجداول أو أدخل القيم يدويًا. كل قيمة تحتفظ بالمصدر والتاريخ والثقة وحالة التأكيد.",
  "Source Date": "تاريخ المصدر",
  "Paste copied tables, plain text, tab-separated data, or CSV-style data here.": "ألصق هنا الجداول المنسوخة أو النص أو بيانات مفصولة بعلامات جدولة أو CSV.",
  "Parse pasted data": "تحليل البيانات الملصقة",
  "Paste Preview": "معاينة اللصق",
  "Review parsed values before saving": "راجع القيم المستخرجة قبل الحفظ",
  "Save parsed values": "حفظ القيم المستخرجة",
  "No values were mapped. You can still enter fields manually.": "لم يتم ربط قيم تلقائيًا. يمكنك إدخال الحقول يدويًا.",
  "Data Review": "مراجعة البيانات",
  Completeness: "نسبة الاكتمال",
  Minimum: "الحد الأدنى",
  "Unconfirmed Parsed Data": "بيانات مستخرجة غير مؤكدة",
  "Missing Data": "بيانات ناقصة",
  "Confirmed Data": "بيانات مؤكدة",
  "Conflicting Data": "بيانات متعارضة",
  "Outdated Data": "بيانات قديمة",
  Confirm: "تأكيد",
  Reject: "رفض",
  "Mark as Not Available": "تعليم كغير متوفر",
  Confirmed: "مؤكد",
  "Needs confirmation": "يحتاج تأكيد",
  Required: "مطلوب",
  Optional: "اختياري",
  "No source": "لا يوجد مصدر",
  "Confirm required fields and resolve critical issues before running the analyst.": "أكد الحقول المطلوبة وحل المشاكل الحرجة قبل تشغيل المحلل.",
  "Override Methodology Assumption": "تعديل افتراض منهجي",
  "Advanced only. Every override is labeled and requires an investor reason.": "خيار متقدم فقط. كل تعديل يتم تمييزه ويتطلب سببًا من المستثمر.",
  "New value": "القيمة الجديدة",
  "Investor reason": "سبب المستثمر",
  "Fixed-Format Report": "تقرير ثابت الشكل",
  "Awaiting investor approval": "بانتظار اعتماد المستثمر",
  "Edit Data and Re-run": "تعديل البيانات وإعادة التحليل",
  "Investor approval note": "ملاحظة اعتماد المستثمر",
  "Valuation Version History": "سجل نسخ التقييم",
  "Approved Date": "تاريخ الاعتماد",
  "Valuation Version": "نسخة التقييم",
  "Changes vs previous version": "التغييرات مقابل النسخة السابقة",
  "Company Name": "اسم الشركة",
  "Valuation Date": "تاريخ التقييم",
  "Confirmed Sources": "المصادر المؤكدة",
  "Important Limitations": "القيود المهمة",
  Classification: "التصنيف",
  "Suitable Valuation Models": "نماذج التقييم المناسبة",
  "Excluded Models": "النماذج المستبعدة",
  Weight: "الوزن",
  Probability: "الاحتمال",
  "Fair Value": "Fair Value",
  "Key Risks": "المخاطر الرئيسية",
  "Key Catalysts": "المحفزات الرئيسية",
  "Data Limitations": "قيود البيانات",
  "Search ticker or company name": "ابحث باسم الشركة أو رمز السهم",
  "Search by company name or ticker": "مثال: AAPL أو Apple",
  "Search Results": "نتائج البحث",
  "Evaluated Companies": "الشركات المقيمة",
  "All evaluated companies": "كل الشركات المقيمة",
  "No evaluated companies yet. Search for a company to run the first evaluation.": "لا توجد شركات مقيمة بعد. ابحث عن شركة لتشغيل أول تقييم.",
  "No matching evaluated companies.": "لا توجد شركات مطابقة.",
  "Open report": "فتح التقرير",
  Analyze: "تحليل",
  Stock: "السهم",
  "Range FV": "Range FV",
  "Upside %": "العائد المتوقع",
  "Max FV Upside %": "العائد لأعلى تقييم",
  Rank: "الترتيب",
  "Ranking Score": "درجة الترتيب",
  "Ranking Confidence": "ثقة الترتيب",
  "Main Positive Factor": "أهم عامل إيجابي",
  "Main Negative Factor": "أهم عامل سلبي",
  Compare: "مقارنة",
  "Compare selected": "قارن المحدد",
  "Comparison": "المقارنة",
  "Close comparison": "إغلاق المقارنة",
  "Select for comparison": "تحديد للمقارنة",
  "Select 2 to 5 companies to compare.": "حدد من شركتين إلى خمس شركات للمقارنة.",
  "All": "الكل",
  "Positive Upside": "عائد إيجابي",
  "Negative Upside": "عائد سلبي",
  "High Data Quality": "جودة بيانات مرتفعة",
  Sector: "القطاع",
  "All sectors": "كل القطاعات",
  "Best": "الأفضل",
  "Worst": "الأضعف",
  "Lowest Risk": "أقل Risk",
  "Highest Risk": "أعلى Risk",
  "Data Quality": "جودة البيانات",
  "Evaluation Date": "تاريخ التقييم",
  "Last Updated": "آخر تحديث",
  "Highest Fair Value": "أعلى Fair Value",
  "Sort ascending": "ترتيب تصاعدي",
  "Sort descending": "ترتيب تنازلي",
  "Companies persist locally in this browser. Latest evaluation replaces the current row and keeps prior evaluations in history.": "الشركات تحفظ محليًا في هذا المتصفح. آخر تقييم يستبدل الصف الحالي مع حفظ التقييمات السابقة في السجل.",
  Market: "السوق",
  Recommendation: "التوصية",
  Confidence: "درجة الثقة",
  "Current Price": "السعر الحالي",
  "Composite FV": "Composite Fair Value",
  "Composite Fair Value": "Composite Fair Value (القيمة العادلة المركبة)",
  "Margin of Safety": "هامش الأمان",
  "Investment Decision": "قرار الاستثمار",
  "Position size": "حجم المركز",
  "Add below": "أضف تحت",
  "Reduce above": "خفف فوق",
  "Investment score": "درجة الاستثمار",
  "Save thesis": "حفظ الفرضية",
  Explainability: "تفسير النتيجة",
  "What helped": "العوامل الداعمة",
  "What hurt": "العوامل الضاغطة",
  Scenarios: "السيناريوهات",
  probability: "احتمال",
  "Valuation Engine": "محرك Valuation",
  "Quality Engine": "محرك Quality",
  "Growth Engine": "محرك Growth",
  "Moat Engine": "محرك Economic Moat",
  "Management Engine": "محرك Management",
  "Risk Engine": "محرك Risk",
  "Data Completeness Engine": "محرك اكتمال البيانات",
  "Data Health": "صحة البيانات",
  "Overall Data Quality": "جودة البيانات الإجمالية",
  Timeline: "الخط الزمني",
  "Missing fields": "الحقول الناقصة",
  "Outdated fields": "الحقول القديمة",
  "Conflicting fields": "الحقول المتعارضة",
  "Company Profile": "ملف الشركة",
  Source: "المصدر",
  "Business Model": "نموذج العمل",
  "Revenue Segments": "Revenue Segments (قطاعات الإيرادات)",
  "Geographic Exposure": "التعرض الجغرافي",
  Customers: "العملاء",
  "Competitive Advantages": "المزايا التنافسية",
  "Key Products": "المنتجات الرئيسية",
  Management: "Management",
  "Competitive Analysis": "التحليل التنافسي",
  "Main Competitors": "المنافسون الرئيسيون",
  "Market Share": "الحصة السوقية",
  "Competitive Strengths": "نقاط القوة التنافسية",
  "Competitive Weaknesses": "نقاط الضعف التنافسية",
  "Peer Comparison": "مقارنة النظراء",
  "Historical Performance": "الأداء التاريخي",
  Year: "السنة",
  Revenue: "Revenue (الإيرادات)",
  EPS: "EPS (ربحية السهم)",
  FCF: "FCF (التدفق النقدي الحر)",
  "Free Cash Flow": "Free Cash Flow (التدفق النقدي الحر)",
  "Op Margin": "Operating Margin",
  "Operating Margin": "Operating Margin (هامش التشغيل)",
  ROIC: "ROIC (العائد على رأس المال المستثمر)",
  "Gross Margin": "Gross Margin (الهامش الإجمالي)",
  Debt: "الدين",
  Shares: "الأسهم",
  "Share Count": "عدد الأسهم",
  "Historical Valuation": "التقييم التاريخي",
  Metric: "المقياس",
  Current: "الحالي",
  "Current price": "السعر الحالي",
  Percentile: "النسبة المئوية",
  History: "السجل",
  "Earnings Center": "مركز النتائج",
  "Last earnings": "آخر نتائج",
  "Next earnings": "تاريخ النتائج القادم",
  "Revenue surprise": "مفاجأة Revenue",
  "EPS surprise": "مفاجأة EPS",
  Guidance: "Guidance (توجيهات الإدارة)",
  "Management Commentary": "تعليق Management",
  "Analyst Consensus": "Analyst Consensus",
  "Low target": "أدنى سعر مستهدف",
  "Average target": "متوسط السعر المستهدف",
  "High target": "أعلى سعر مستهدف",
  Rating: "التصنيف",
  "Rating Distribution": "توزيع التصنيفات",
  "Recent Upgrades": "ترقيات حديثة",
  "Recent Downgrades": "تخفيضات حديثة",
  "Consensus Trend": "اتجاه Analyst Consensus",
  "Investment Thesis": "فرضية الاستثمار",
  "Why Invest": "لماذا الاستثمار؟",
  "Why Avoid": "لماذا التجنب؟",
  "Biggest Opportunities": "أكبر الفرص",
  "Biggest Risks": "أكبر المخاطر",
  "What Would Change The Thesis": "ما الذي يغير الفرضية؟",
  "Research Timeline": "الخط الزمني البحثي",
  "Explain Like CIO": "ملخص CIO",
  "Watch List": "قائمة المتابعة",
  "Target price": "السعر المستهدف",
  "Review date": "تاريخ المراجعة",
  "Investment thesis": "فرضية الاستثمار",
  Notes: "ملاحظات",
  "Saved Companies": "الشركات المحفوظة",
  Remove: "إزالة",
  "FMP API key": "مفتاح FMP API",
  "OpenAI key": "مفتاح OpenAI",
  "Average cost": "متوسط التكلفة",
  "Morningstar FV": "Morningstar Fair Value",
  "Research notes": "ملاحظات البحث",
  "Company Basics": "أساسيات الشركة",
  "Income Statement": "قائمة الدخل",
  "Balance Sheet": "الميزانية العمومية",
  "Cash Flow Statement": "قائمة التدفقات النقدية",
  "Company Guidance": "Guidance الشركة",
  "Analyst Estimates": "تقديرات المحللين",
  "Morningstar Research": "أبحاث Morningstar",
  "Qualitative Research": "البحث النوعي",
  Ticker: "رمز السهم",
  "Company Name": "اسم الشركة",
  "Market Capitalization": "القيمة السوقية",
  "Enterprise Value": "Enterprise Value",
  Currency: "العملة",
  Industry: "الصناعة",
  "Current Date": "التاريخ الحالي",
  "Gross Profit": "Gross Profit",
  "Operating Income": "Operating Income",
  "Net Income": "Net Income",
  "Historical annual periods": "الفترات السنوية التاريخية",
  "Historical quarterly periods": "الفترات الربع سنوية التاريخية",
  Cash: "النقد",
  "Total Debt": "إجمالي الدين",
  Equity: "حقوق الملكية",
  "Working Capital": "Working Capital",
  "Diluted Shares Outstanding": "الأسهم المخففة القائمة",
  "Operating Cash Flow": "Operating Cash Flow",
  "Capital Expenditure": "CapEx",
  "Stock-Based Compensation": "Stock-Based Compensation",
  "Share Buybacks": "إعادة شراء الأسهم",
  Dividends: "التوزيعات",
  "Revenue Guidance": "Revenue Guidance",
  "EPS Guidance": "EPS Guidance",
  "Margin Guidance": "Margin Guidance",
  "CapEx Guidance": "CapEx Guidance",
  "Management Growth Guidance": "Management Growth Guidance",
  "Other guidance": "Guidance أخرى",
  "Revenue Estimates": "Revenue Estimates",
  "EPS Estimates": "EPS Estimates",
  "EBITDA Estimates": "EBITDA Estimates",
  "FCF Estimates": "FCF Estimates",
  "Low / Average / High Estimates": "تقديرات منخفض / متوسط / مرتفع",
  "Number of Analysts": "عدد المحللين",
  "Analyst Target Low": "أدنى سعر مستهدف",
  "Analyst Target Average": "متوسط السعر المستهدف",
  "Analyst Target High": "أعلى سعر مستهدف",
  "Economic Moat": "Economic Moat",
  "Capital Allocation": "Capital Allocation",
  "Uncertainty Rating": "تصنيف عدم اليقين",
  "Star Rating": "تصنيف النجوم",
  "Bull Case": "Bull Case",
  "Base Case": "Base Case",
  "Bear Case": "Bear Case",
  "Analyst Research Summary": "ملخص بحث المحلل",
  "Research Date": "تاريخ البحث",
  "Customer Concentration": "تركز العملاء",
  "Regulatory Risks": "المخاطر التنظيمية",
  "User Notes": "ملاحظات المستخدم",
  "Saved Theses": "الفرضيات المحفوظة",
  Formula: "الصيغة",
  Output: "المخرجات",
  Drivers: "المحركات",
  "No drivers": "لا توجد محركات",
  "No notes": "لا توجد ملاحظات",
  None: "لا يوجد",
  Missing: "غير متوفر"
};

const EN_UI_LABELS = {
  Home: "Home",
  Executive: "Executive",
  Research: "Research",
  Watchlist: "Watchlist",
  Settings: "Settings",
  History: "History",
  "Institutional Research": "Institutional Research",
  "AI Equity Research Platform": "AI Equity Research Platform",
  "Daily investment workspace": "Daily investment workspace",
  "Equity research layer": "Equity research layer",
  "Version 5.1": "Version 5.1",
  "Version 6": "Version 6",
  "Version 7": "Version 7",
  "Valuation Workspace": "Valuation Workspace",
  "Build an approved valuation before it reaches Home": "Build an approved valuation before it reaches Home",
  "Search a ticker, paste data, review it, run the fixed analyst, then approve and export.": "Search a ticker, paste data, review it, run the fixed analyst, then approve and export.",
  "Open a valuation workspace, not a final decision.": "Open a valuation workspace, not a final decision.",
  Data: "Data",
  "Paste or enter company data and confirm the source.": "Paste or enter company data and confirm the source.",
  Approve: "Approve",
  "Only approved valuations appear in the dashboard.": "Only approved valuations appear in the dashboard.",
  "Toggle theme": "Toggle theme",
  Light: "Light",
  Dark: "Dark",
  Search: "Search",
  Searching: "Searching",
  "Start analysis": "Start analysis",
  "New analysis": "New analysis",
  "Start here": "Start here",
  "Enter a ticker to start": "Enter a ticker to start",
  "Analyze any stock in three steps": "Analyze any stock in three steps",
  "Type a ticker, choose the company, then read the decision summary first.": "Type a ticker, choose the company, then read the decision summary first.",
  "Common examples": "Common examples",
  Choose: "Choose",
  Read: "Read",
  "Use a ticker like AAPL or MSFT.": "Use a ticker like AAPL or MSFT.",
  "Tap the company result to run the analysis.": "Tap the company result to run the analysis.",
  "Start with Buy, Hold, or Sell before the details.": "Start with Buy, Hold, or Sell before the details.",
  "Market data key connected": "Market data key connected",
  "Add FMP key for live data": "Add FMP key for live data",
  "Tap to analyze": "Tap to analyze",
  "Open valuation workspace": "Open valuation workspace",
  "Search for a company to open a disciplined valuation workspace.": "Search for a company to open a disciplined valuation workspace.",
  "Research status": "Research status",
  "Data completeness": "Data completeness",
  "Last saved": "Last saved",
  Methodology: "Methodology",
  "Open Workspace": "Open Workspace",
  "Paste / Enter Data": "Paste / Enter Data",
  "Review and Confirm Data": "Review and Confirm Data",
  "Run Valuation Analyst": "Run Valuation Analyst",
  "Approve and Export": "Approve and Export",
  "Input Data": "Input Data",
  "Paste tables or enter values manually. Every value keeps source, date, confidence, and confirmation status.": "Paste tables or enter values manually. Every value keeps source, date, confidence, and confirmation status.",
  "Source Date": "Source Date",
  "Paste copied tables, plain text, tab-separated data, or CSV-style data here.": "Paste copied tables, plain text, tab-separated data, or CSV-style data here.",
  "Parse pasted data": "Parse pasted data",
  "Paste Preview": "Paste Preview",
  "Review parsed values before saving": "Review parsed values before saving",
  "Save parsed values": "Save parsed values",
  "No values were mapped. You can still enter fields manually.": "No values were mapped. You can still enter fields manually.",
  "Data Review": "Data Review",
  Completeness: "Completeness",
  Minimum: "Minimum",
  "Unconfirmed Parsed Data": "Unconfirmed Parsed Data",
  "Missing Data": "Missing Data",
  "Confirmed Data": "Confirmed Data",
  "Conflicting Data": "Conflicting Data",
  "Outdated Data": "Outdated Data",
  Confirm: "Confirm",
  Reject: "Reject",
  "Mark as Not Available": "Mark as Not Available",
  Confirmed: "Confirmed",
  "Needs confirmation": "Needs confirmation",
  Required: "Required",
  Optional: "Optional",
  "No source": "No source",
  "Confirm required fields and resolve critical issues before running the analyst.": "Confirm required fields and resolve critical issues before running the analyst.",
  "Override Methodology Assumption": "Override Methodology Assumption",
  "Advanced only. Every override is labeled and requires an investor reason.": "Advanced only. Every override is labeled and requires an investor reason.",
  "New value": "New value",
  "Investor reason": "Investor reason",
  "Fixed-Format Report": "Fixed-Format Report",
  "Awaiting investor approval": "Awaiting investor approval",
  "Edit Data and Re-run": "Edit Data and Re-run",
  "Investor approval note": "Investor approval note",
  "Valuation Version History": "Valuation Version History",
  "Approved Date": "Approved Date",
  "Valuation Version": "Valuation Version",
  "Changes vs previous version": "Changes vs previous version",
  "Company Name": "Company Name",
  "Valuation Date": "Valuation Date",
  "Confirmed Sources": "Confirmed Sources",
  "Important Limitations": "Important Limitations",
  Classification: "Classification",
  "Suitable Valuation Models": "Suitable Valuation Models",
  "Excluded Models": "Excluded Models",
  Weight: "Weight",
  Probability: "Probability",
  "Fair Value": "Fair Value",
  "Key Risks": "Key Risks",
  "Key Catalysts": "Key Catalysts",
  "Data Limitations": "Data Limitations",
  "Search ticker or company name": "Search by company name or ticker",
  "Search by company name or ticker": "Example: AAPL or Apple",
  "Search Results": "Search Results",
  "Evaluated Companies": "Evaluated Companies",
  "All evaluated companies": "All evaluated companies",
  "No evaluated companies yet. Search for a company to run the first evaluation.": "No evaluated companies yet. Search for a company to run the first evaluation.",
  "No matching evaluated companies.": "No matching evaluated companies.",
  "Open report": "Open report",
  Analyze: "Analyze",
  Stock: "Stock",
  "Current Price": "Current Price",
  "Range FV": "Range FV",
  "Upside %": "Upside %",
  "Max FV Upside %": "Max FV Upside %",
  Rank: "Rank",
  "Ranking Score": "Ranking Score",
  "Ranking Confidence": "Ranking Confidence",
  "Main Positive Factor": "Main Positive Factor",
  "Main Negative Factor": "Main Negative Factor",
  Compare: "Compare",
  "Compare selected": "Compare selected",
  Comparison: "Comparison",
  "Close comparison": "Close comparison",
  "Select for comparison": "Select for comparison",
  "Select 2 to 5 companies to compare.": "Select 2 to 5 companies to compare.",
  All: "All",
  "Positive Upside": "Positive Upside",
  "Negative Upside": "Negative Upside",
  "High Data Quality": "High Data Quality",
  Sector: "Sector",
  "All sectors": "All sectors",
  Best: "Best",
  Worst: "Worst",
  "Lowest Risk": "Lowest Risk",
  "Highest Risk": "Highest Risk",
  Recommendation: "Recommendation",
  Confidence: "Confidence",
  "Data Quality": "Data Quality",
  "Evaluation Date": "Evaluation Date",
  "Last Updated": "Last Updated",
  "Highest Fair Value": "Highest Fair Value",
  "Sort ascending": "Sort ascending",
  "Sort descending": "Sort descending",
  "Companies persist locally in this browser. Latest evaluation replaces the current row and keeps prior evaluations in history.": "Companies persist locally in this browser. Latest evaluation replaces the current row and keeps prior evaluations in history.",
  Market: "Market",
  "Composite FV": "Composite FV",
  "Composite Fair Value": "Composite Fair Value",
  "Margin of Safety": "Margin of Safety",
  "Investment Decision": "Investment Decision",
  "Position size": "Position size",
  "Add below": "Add below",
  "Reduce above": "Reduce above",
  "Investment score": "Investment score",
  "Save thesis": "Save thesis",
  Explainability: "Explainability",
  "What helped": "What helped",
  "What hurt": "What hurt",
  Scenarios: "Scenarios",
  probability: "probability",
  "Valuation Engine": "Valuation Engine",
  "Quality Engine": "Quality Engine",
  "Growth Engine": "Growth Engine",
  "Moat Engine": "Economic Moat Engine",
  "Management Engine": "Management Engine",
  "Risk Engine": "Risk Engine",
  "Data Completeness Engine": "Data Completeness Engine",
  "Data Health": "Data Health",
  "Overall Data Quality": "Overall Data Quality",
  Timeline: "Timeline",
  "Missing fields": "Missing fields",
  "Outdated fields": "Outdated fields",
  "Conflicting fields": "Conflicting fields",
  "Company Profile": "Company Profile",
  Source: "Source",
  "Business Model": "Business Model",
  "Revenue Segments": "Revenue Segments",
  "Geographic Exposure": "Geographic Exposure",
  Customers: "Customers",
  "Competitive Advantages": "Competitive Advantages",
  "Key Products": "Key Products",
  "Competitive Analysis": "Competitive Analysis",
  "Main Competitors": "Main Competitors",
  "Market Share": "Market Share",
  "Competitive Strengths": "Competitive Strengths",
  "Competitive Weaknesses": "Competitive Weaknesses",
  "Peer Comparison": "Peer Comparison",
  "Historical Performance": "Historical Performance",
  Year: "Year",
  "Op Margin": "Operating Margin",
  Debt: "Debt",
  Shares: "Shares",
  "Share Count": "Share Count",
  "Historical Valuation": "Historical Valuation",
  Metric: "Metric",
  Current: "Current",
  Percentile: "Percentile",
  "Earnings Center": "Earnings Center",
  "Last earnings": "Last earnings",
  "Next earnings": "Next earnings",
  "Revenue surprise": "Revenue surprise",
  "EPS surprise": "EPS surprise",
  Guidance: "Guidance",
  "Management Commentary": "Management Commentary",
  "Analyst Consensus": "Analyst Consensus",
  "Low target": "Low target",
  "Average target": "Average target",
  "High target": "High target",
  Rating: "Rating",
  "Rating Distribution": "Rating Distribution",
  "Recent Upgrades": "Recent Upgrades",
  "Recent Downgrades": "Recent Downgrades",
  "Consensus Trend": "Consensus Trend",
  "Investment Thesis": "Investment Thesis",
  "Why Invest": "Why Invest",
  "Why Avoid": "Why Avoid",
  "Biggest Opportunities": "Biggest Opportunities",
  "Biggest Risks": "Biggest Risks",
  "What Would Change The Thesis": "What Would Change The Thesis",
  "Research Timeline": "Research Timeline",
  "Explain Like CIO": "Explain Like CIO",
  "Watch List": "Watch List",
  "Target price": "Target price",
  "Review date": "Review date",
  "Investment thesis": "Investment thesis",
  Notes: "Notes",
  "Saved Companies": "Saved Companies",
  Remove: "Remove",
  "FMP API key": "FMP API key",
  "OpenAI key": "OpenAI key",
  "Average cost": "Average cost",
  "Morningstar FV": "Morningstar FV",
  "Research notes": "Research notes",
  "Company Basics": "Company Basics",
  "Income Statement": "Income Statement",
  "Balance Sheet": "Balance Sheet",
  "Cash Flow Statement": "Cash Flow Statement",
  "Company Guidance": "Company Guidance",
  "Analyst Estimates": "Analyst Estimates",
  "Morningstar Research": "Morningstar Research",
  "Qualitative Research": "Qualitative Research",
  Ticker: "Ticker",
  "Market Capitalization": "Market Capitalization",
  "Enterprise Value": "Enterprise Value",
  Currency: "Currency",
  Industry: "Industry",
  "Current Date": "Current Date",
  "Gross Profit": "Gross Profit",
  "Operating Income": "Operating Income",
  "Net Income": "Net Income",
  "Historical annual periods": "Historical annual periods",
  "Historical quarterly periods": "Historical quarterly periods",
  Cash: "Cash",
  "Total Debt": "Total Debt",
  Equity: "Equity",
  "Working Capital": "Working Capital",
  "Diluted Shares Outstanding": "Diluted Shares Outstanding",
  "Operating Cash Flow": "Operating Cash Flow",
  "Capital Expenditure": "Capital Expenditure",
  "Stock-Based Compensation": "Stock-Based Compensation",
  "Share Buybacks": "Share Buybacks",
  Dividends: "Dividends",
  "Revenue Guidance": "Revenue Guidance",
  "EPS Guidance": "EPS Guidance",
  "Margin Guidance": "Margin Guidance",
  "CapEx Guidance": "CapEx Guidance",
  "Management Growth Guidance": "Management Growth Guidance",
  "Other guidance": "Other guidance",
  "Revenue Estimates": "Revenue Estimates",
  "EPS Estimates": "EPS Estimates",
  "EBITDA Estimates": "EBITDA Estimates",
  "FCF Estimates": "FCF Estimates",
  "Low / Average / High Estimates": "Low / Average / High Estimates",
  "Number of Analysts": "Number of Analysts",
  "Analyst Target Low": "Analyst Target Low",
  "Analyst Target Average": "Analyst Target Average",
  "Analyst Target High": "Analyst Target High",
  "Economic Moat": "Economic Moat",
  "Capital Allocation": "Capital Allocation",
  "Uncertainty Rating": "Uncertainty Rating",
  "Star Rating": "Star Rating",
  "Bull Case": "Bull Case",
  "Base Case": "Base Case",
  "Bear Case": "Bear Case",
  "Analyst Research Summary": "Analyst Research Summary",
  "Research Date": "Research Date",
  "Customer Concentration": "Customer Concentration",
  "Regulatory Risks": "Regulatory Risks",
  "User Notes": "User Notes",
  "Saved Theses": "Saved Theses",
  Formula: "Formula",
  Output: "Output",
  Drivers: "Drivers",
  "No drivers": "No drivers",
  "No notes": "No notes",
  None: "None",
  Missing: "Missing"
};

const TERM_LABELS = {
  DCF: "DCF",
  "Reverse DCF": "Reverse DCF",
  FCF: "FCF (التدفق النقدي الحر)",
  ROIC: "ROIC (العائد على رأس المال المستثمر)",
  EPS: "EPS (ربحية السهم)",
  "P/E": "P/E",
  PEG: "PEG",
  "EV/EBITDA": "EV/EBITDA",
  "EV/Sales": "EV/Sales",
  "Price/FCF": "Price/FCF",
  WACC: "WACC",
  CapEx: "CapEx",
  "Terminal Growth": "Terminal Growth",
  "Tax Rate": "Tax Rate",
  "Exit Multiple": "Exit Multiple",
  "Operating Margin": "Operating Margin (هامش التشغيل)",
  Revenue: "Revenue (الإيرادات)",
  "Revenue growth": "Revenue Growth (نمو الإيرادات)",
  "EPS growth": "EPS Growth (نمو EPS)",
  "FCF growth": "FCF Growth (نمو FCF)",
  "Free cash flow": "Free Cash Flow (التدفق النقدي الحر)",
  "free cash flow": "Free Cash Flow (التدفق النقدي الحر)",
  "Gross margin": "Gross Margin (الهامش الإجمالي)",
  "Operating margin": "Operating Margin (هامش التشغيل)",
  "FCF margin": "FCF Margin (هامش FCF)",
  "Margin profile": "Margin Profile (ملف الهوامش)",
  "Economic Moat": "Economic Moat (الميزة التنافسية)",
  Moat: "Economic Moat (الميزة التنافسية)",
  Quality: "Quality",
  Growth: "Growth",
  Management: "Management",
  Risk: "Risk",
  Bull: "Bull",
  Bear: "Bear",
  Base: "Base",
  "Analyst Consensus": "Analyst Consensus",
  "Morningstar Fair Value": "Morningstar Fair Value",
  "Capital allocation": "تخصيص رأس المال",
  Buybacks: "إعادة شراء الأسهم",
  Dilution: "التخفيف",
  "Balance sheet": "الميزانية العمومية",
  "Balance sheet discipline": "انضباط الميزانية العمومية",
  "Debt risk": "مخاطر الدين",
  "Specific risks": "مخاطر محددة",
  "Moat evidence": "أدلة Economic Moat",
  "Data completeness": "اكتمال البيانات",
  Data: "البيانات",
  "Market capitalization": "القيمة السوقية",
  "Latest financial statements": "القوائم المالية الأخيرة",
  EBITDA: "EBITDA",
  "Diluted shares": "الأسهم المخففة",
  "Cash and debt": "النقد والدين",
  "Growth history": "سجل Growth",
  "Consensus target": "سعر Analyst Consensus المستهدف",
  "Manual fair value": "القيمة العادلة اليدوية",
  Valuation: "Valuation",
  "Investment Score": "درجة الاستثمار",
  "Upside %": "العائد المتوقع",
  "Data Quality": "جودة البيانات",
  "Confidence": "درجة الثقة",
  "No strong positive factor": "لا يوجد عامل إيجابي قوي",
  "No material negative factor": "لا يوجد عامل سلبي جوهري",
  "Free Cash Flow": "Free Cash Flow (التدفق النقدي الحر)",
  "Gross Margin": "Gross Margin (الهامش الإجمالي)",
  "Operating Margin": "Operating Margin (هامش التشغيل)"
};

const EN_TERM_LABELS = {
  DCF: "DCF",
  "Reverse DCF": "Reverse DCF",
  FCF: "FCF",
  ROIC: "ROIC",
  EPS: "EPS",
  "P/E": "P/E",
  PEG: "PEG",
  "EV/EBITDA": "EV/EBITDA",
  "EV/Sales": "EV/Sales",
  "Price/FCF": "Price/FCF",
  Revenue: "Revenue",
  "Revenue growth": "Revenue Growth",
  "EPS growth": "EPS Growth",
  "FCF growth": "FCF Growth",
  "Free cash flow": "Free Cash Flow",
  "free cash flow": "Free Cash Flow",
  "Free Cash Flow": "Free Cash Flow",
  "Gross margin": "Gross Margin",
  "Gross Margin": "Gross Margin",
  "Operating margin": "Operating Margin",
  "Operating Margin": "Operating Margin",
  "FCF margin": "FCF Margin",
  "Margin profile": "Margin Profile",
  "Economic Moat": "Economic Moat",
  Moat: "Economic Moat",
  Quality: "Quality",
  Growth: "Growth",
  Management: "Management",
  Risk: "Risk",
  Bull: "Bull",
  Bear: "Bear",
  Base: "Base",
  "Analyst Consensus": "Analyst Consensus",
  "Morningstar Fair Value": "Morningstar Fair Value",
  "Capital allocation": "Capital allocation",
  Buybacks: "Buybacks",
  Dilution: "Dilution",
  "Balance sheet": "Balance sheet",
  "Balance sheet discipline": "Balance sheet discipline",
  "Debt risk": "Debt risk",
  "Specific risks": "Specific risks",
  "Moat evidence": "Moat evidence",
  "Data completeness": "Data completeness",
  Data: "Data",
  "Market capitalization": "Market capitalization",
  "Latest financial statements": "Latest financial statements",
  EBITDA: "EBITDA",
  "Diluted shares": "Diluted shares",
  "Cash and debt": "Cash and debt",
  "Growth history": "Growth history",
  "Consensus target": "Consensus target",
  "Manual fair value": "Manual fair value",
  Valuation: "Valuation",
  "Investment Score": "Investment Score",
  "Upside %": "Upside %",
  "Data Quality": "Data Quality",
  Confidence: "Confidence",
  "No strong positive factor": "No strong positive factor",
  "No material negative factor": "No material negative factor"
};

const TEXT_TRANSLATIONS = new Map([
  ["Not available from verified data.", MISSING_AR],
  ["No evidence available yet.", "لا توجد أدلة كافية حتى الآن."],
  ["No verified historical financial statements available.", "لا توجد قوائم مالية تاريخية موثقة."],
  ["No verified timeline events available.", "لا توجد أحداث زمنية موثقة."],
  ["No verified history.", "لا يوجد سجل تاريخي موثق."],
  ["No saved watch list companies yet.", "لا توجد شركات محفوظة في قائمة المتابعة بعد."],
  ["No saved theses yet.", "لا توجد فرضيات محفوظة بعد."],
  ["No companies found.", "لم يتم العثور على شركات."],
  ["Search failed. Check the market data key in Settings.", "فشل البحث. تحقق من مفتاح بيانات السوق في الإعدادات."],
  ["Could not load live data. Check the market data key in Settings.", "تعذر تحميل البيانات الحية. تحقق من مفتاح بيانات السوق في الإعدادات."],
  ["Select a company to run the thesis.", "اختر شركة لتشغيل فرضية الاستثمار."],
  ["Add a market data key in Settings, then search a ticker to run the investment engine.", "أضف مفتاح بيانات السوق من الإعدادات، ثم ابحث عن رمز سهم لتشغيل محرك الاستثمار."],
  ["No valuation method can run until price and financial statement inputs are available.", "لا يمكن تشغيل أي طريقة Valuation قبل توفر السعر والقوائم المالية."],
  ["The engine only runs valuation methods whose required inputs are present. Missing inputs remove the method instead of using placeholder values.", "يشغل المحرك طرق Valuation التي تملك مدخلات مكتملة فقط. أي مدخل ناقص يستبعد الطريقة بدل استخدام أرقام افتراضية."],
  ["Manual external fair value input.", "مدخل قيمة عادلة خارجي يتم إدخاله يدويًا."],
  ["Street target consensus from the connected market data provider.", "سعر Analyst Consensus من مزود بيانات السوق المتصل."],
  ["Projects free cash flow for five years and applies a terminal value.", "يعرض DCF توقع Free Cash Flow لخمس سنوات مع Terminal Value."],
  ["Applies a growth and quality adjusted earnings multiple.", "يطبق مضاعف أرباح معدل حسب Growth وQuality."],
  ["Normalizes earnings value against growth.", "يطبع قيمة الأرباح مقابل Growth."],
  ["Uses operating cash earnings and an adjusted enterprise multiple.", "يستخدم أرباح التشغيل النقدية مع مضاعف Enterprise Value معدل."],
  ["Useful for growth companies, lower confidence for mature businesses.", "مفيد لشركات Growth، لكن درجة الثقة أقل للشركات الناضجة."],
  ["Reverse DCF requires current price, free cash flow, cash, debt, and diluted shares.", "يتطلب Reverse DCF السعر الحالي، Free Cash Flow، النقد، الدين، وعدد الأسهم المخففة."],
  ["Scenario requires a composite fair value from the valuation engine.", "يتطلب السيناريو Composite Fair Value من محرك Valuation."],
  ["Growth normalizes faster", "Growth يتباطأ أسرع من المتوقع"],
  ["Margins compress", "الهوامش تنضغط"],
  ["Multiple contracts", "المضاعف ينكمش"],
  ["Current growth fades gradually", "Growth الحالي يتلاشى تدريجيًا"],
  ["Margins remain near normalized levels", "الهوامش تبقى قرب مستوياتها الطبيعية"],
  ["Multiple reflects quality and growth", "المضاعف يعكس Quality وGrowth"],
  ["Growth remains durable", "Growth يبقى مستدامًا"],
  ["FCF conversion improves", "تحويل FCF يتحسن"],
  ["Premium multiple persists", "المضاعف المرتفع يستمر"],
  ["Quality measures profitability, returns on capital, cash conversion, and balance sheet resilience.", "يقيس محرك Quality الربحية، العائد على رأس المال، تحويل النقد، ومتانة الميزانية العمومية."],
  ["Company quality is driven by profitability, returns on capital, free cash flow conversion, and balance sheet strength.", "درجة Quality تعتمد على الربحية، ROIC، تحويل Free Cash Flow، وقوة الميزانية العمومية."],
  ["Growth combines top-line growth, earnings growth, cash flow growth, and margin quality.", "يجمع محرك Growth بين نمو Revenue، نمو EPS، نمو FCF، وجودة الهوامش."],
  ["Growth score weighs revenue, EPS, free cash flow, and margin profile.", "درجة Growth توازن بين Revenue، EPS، Free Cash Flow، وMargin Profile."],
  ["Management score uses observable capital allocation evidence. Qualitative judgment should be added only from filings and transcripts.", "يعتمد محرك Management على أدلة قابلة للملاحظة في تخصيص رأس المال. أي حكم نوعي يجب أن يأتي من الإفصاحات والنصوص الرسمية."],
  ["Management score is provisional because capital allocation evidence is incomplete.", "درجة Management مؤقتة لأن أدلة تخصيص رأس المال غير مكتملة."],
  ["Management score reflects cash generation, buybacks, dilution, and balance sheet discipline.", "درجة Management تعكس توليد النقد، إعادة شراء الأسهم، التخفيف، وانضباط الميزانية العمومية."],
  ["Moat is evidence-based. The engine does not infer a moat unless the data includes explicit signals.", "يعتمد Economic Moat على أدلة صريحة؛ المحرك لا يفترض وجود ميزة تنافسية بدون إشارات موثقة."],
  ["The company shows multiple recorded competitive advantages.", "تظهر الشركة عدة مزايا تنافسية مسجلة."],
  ["The company has some recorded advantages, but durability should be monitored.", "لدى الشركة بعض المزايا المسجلة، لكن يجب مراقبة استدامتها."],
  ["There is limited recorded evidence of a durable moat.", "الأدلة المسجلة على Economic Moat مستدام محدودة."],
  ["Risk score penalizes explicit thesis risks and financial leverage. Higher score means lower investment risk.", "درجة Risk تخصم من المخاطر الصريحة والرافعة المالية. الدرجة الأعلى تعني مخاطرة استثمارية أقل."],
  ["Risk score reflects balance sheet and explicitly recorded competitive, regulatory, geographic, customer, legal, and disruption risks.", "درجة Risk تعكس الميزانية العمومية والمخاطر المسجلة في المنافسة والتنظيم والجغرافيا والعملاء والقانون والتغيرات التقنية."],
  ["Completeness determines whether the platform can issue a reliable investment decision. Missing data lowers confidence before valuation is considered.", "اكتمال البيانات يحدد قدرة المنصة على إصدار قرار استثماري موثوق. البيانات الناقصة تخفض الثقة قبل النظر في Valuation."],
  ["Core market, financial statement, and external validation inputs are available.", "مدخلات السوق والقوائم المالية والتحقق الخارجي الأساسية متوفرة."],
  ["Positive free cash flow gives management flexibility.", "Free Cash Flow الإيجابي يمنح Management مرونة في تخصيص رأس المال."],
  ["Negative free cash flow limits capital allocation flexibility.", "Free Cash Flow السلبي يحد من مرونة تخصيص رأس المال."],
  ["Capital allocation requires free cash flow.", "تخصيص رأس المال يتطلب Free Cash Flow."],
  ["Share count is stable or declining.", "عدد الأسهم مستقر أو يتراجع."],
  ["Share count is increasing.", "عدد الأسهم يرتفع."],
  ["Dilution factor requires current and prior diluted share count.", "عامل التخفيف يتطلب عدد الأسهم المخففة للفترة الحالية والسابقة."],
  ["Historical valuation percentiles require verified historical market price or enterprise value data.", "النسب المئوية التاريخية للتقييم تتطلب أسعار سوقية أو Enterprise Value تاريخية موثقة."],
  ["API keys stay in this browser session. Financial calculations are deterministic; AI is reserved for explanation and challenge only.", "مفاتيح API تبقى في جلسة المتصفح. الحسابات المالية deterministic، واستخدام AI مخصص للشرح وتحدي الفرضيات فقط."],
  ["Verified provider data", "بيانات مزود موثوقة"]
]);

export function normalizeLanguage(language) {
  return language === LANGUAGES.EN ? LANGUAGES.EN : LANGUAGES.AR;
}

export function setLanguageContext(language) {
  activeLanguage = normalizeLanguage(language);
}

export function isArabicLanguage(language = activeLanguage) {
  return normalizeLanguage(language) === LANGUAGES.AR;
}

export function setupArabicDocument(language = LANGUAGES.AR) {
  activeLanguage = normalizeLanguage(language);
  const arabic = isArabicLanguage();
  document.documentElement.lang = arabic ? "ar" : "en";
  document.documentElement.dir = arabic ? "rtl" : "ltr";
  document.documentElement.dataset.locale = arabic ? LANGUAGE_SYSTEM.locale : "en-US";
  document.documentElement.dataset.language = activeLanguage;
}

export function uiLabel(label) {
  if (!isArabicLanguage()) return EN_UI_LABELS[label] || label;
  return UI_LABELS[label] || TERM_LABELS[label] || label;
}

export function financialTerm(term) {
  if (!isArabicLanguage()) return EN_TERM_LABELS[term] || term;
  return TERM_LABELS[term] || term;
}

export function decisionLabel(label) {
  if (!isArabicLanguage()) return label || "";
  const labels = {
    BUY: "شراء",
    HOLD: "احتفاظ",
    SELL: "بيع",
    Buy: "شراء",
    Hold: "احتفاظ",
    Sell: "بيع",
    "Strong Buy": "شراء قوي",
    "Strong Sell": "بيع قوي",
    Neutral: "محايد",
    Outperform: "أداء أفضل من السوق",
    Underperform: "أداء أقل من السوق"
  };
  return labels[label] || label;
}

export function statusLabel(status) {
  if (!isArabicLanguage()) {
    const labels = {
      ACTIONABLE: "Actionable",
      INSUFFICIENT_DATA: "Data limited",
      SAVED: "Saved",
      clear: "Clear",
      missing: "Missing",
      outdated: "Outdated",
      conflict: "Conflict",
      observed: "Observed"
    };
    return labels[status] || labels[String(status).toLowerCase()] || status;
  }
  const labels = {
    ACTIONABLE: "قابل للتنفيذ",
    INSUFFICIENT_DATA: "بيانات غير كافية",
    SAVED: "محفوظ",
    clear: "سليم",
    missing: "ناقص",
    outdated: "قديم",
    conflict: "متعارض",
    observed: "موثق"
  };
  return labels[status] || labels[String(status).toLowerCase()] || status;
}

export function ratingLabel(value) {
  if (!isArabicLanguage()) return value ?? "";
  const labels = {
    Institutional: "مؤسسية",
    Researchable: "قابلة للبحث",
    Limited: "محدودة",
    Insufficient: "غير كافية",
    Low: "منخفضة",
    Medium: "متوسطة",
    High: "مرتفعة",
    Wide: "Wide (واسع)",
    Narrow: "Narrow (ضيق)",
    None: "None (غير مثبت)"
  };
  return labels[value] || value;
}

export function sourceLabel(value) {
  if (!isArabicLanguage()) return value || "Missing";
  const labels = {
    Missing: "غير متوفر",
    "Verified provider data": "بيانات مزود موثوقة",
    "Manual Input": "Manual Input",
    "Financial Modeling Prep": "Financial Modeling Prep",
    FMP: "Financial Modeling Prep"
  };
  return labels[value] || value || "غير متوفر";
}

export function factorDisplay(item) {
  return {
    ...item,
    label: factorLabel(item.label),
    explanation: analysisText(item.explanation)
  };
}

export function factorLabel(label) {
  if (!isArabicLanguage()) return EN_TERM_LABELS[label] || EN_UI_LABELS[label] || titleLabel(label);
  return TERM_LABELS[label] || UI_LABELS[label] || titleLabel(label);
}

export function outputKeyLabel(key) {
  if (!isArabicLanguage()) return titleLabel(key);
  const labels = {
    score: "الدرجة",
    grade: "التقدير",
    rating: "التصنيف",
    label: "التوصية",
    compositeScore: "درجة الاستثمار",
    confidence: "درجة الثقة",
    status: "الحالة",
    compositeFairValue: "Composite Fair Value",
    marginOfSafety: "هامش الأمان",
    methodCount: "عدد الطرق",
    dataQuality: "جودة البيانات",
    outdatedFields: "حقول قديمة",
    conflictingFields: "حقول متعارضة",
    summary: "الملخص"
  };
  return labels[key] || titleLabel(key);
}

export function analysisText(value) {
  const text = normalize(value);
  if (!isArabicLanguage()) return englishText(text);
  if (!text || text === "-") return MISSING_AR;
  if (containsArabic(text)) return text;
  if (TEXT_TRANSLATIONS.has(text)) return TEXT_TRANSLATIONS.get(text);

  const exact = translatePattern(text);
  if (exact) return exact;

  if (looksLikeFormula(text)) return text;
  if (looksLikeShortName(text)) return text;
  return "النص متوفر من مصدر موثوق، ويحتاج صياغة عربية بحثية قبل عرضه.";
}

export function researchText(value) {
  const text = normalize(value);
  if (!isArabicLanguage()) return englishText(text);
  if (!text || text === "-") return MISSING_AR;
  if (containsArabic(text)) return text;
  if (TEXT_TRANSLATIONS.has(text)) return TEXT_TRANSLATIONS.get(text);
  const translated = translatePattern(text);
  if (translated) return translated;
  if (looksLikeShortName(text)) return text;
  return "المعلومة متوفرة من مصدر موثوق، وتحتاج ترجمة بحثية قبل عرضها بالعربية.";
}

export function scenarioAssumption(value) {
  return analysisText(value);
}

export function timelineType(value) {
  if (!isArabicLanguage()) return value;
  const labels = {
    Dividend: "توزيعات أرباح",
    Dividends: "توزيعات أرباح",
    Buybacks: "إعادة شراء أسهم",
    Research: "بحث",
    Earnings: "نتائج",
    News: "خبر",
    Acquisition: "استحواذ",
    "CEO change": "تغيير CEO",
    "Product launch": "إطلاق منتج"
  };
  return labels[value] || value;
}

export function executiveSummaryText(company, research) {
  const ticker = company?.ticker || "السهم";
  const decision = decisionLabel(research.decision.label);
  const confidence = research.decision.confidence;
  const fairValue = research.valuation.compositeFairValue;
  const margin = research.valuation.marginOfSafety;
  const methods = research.valuation.methods.length;
  const quality = research.quality.score;
  const growth = research.growth.score;
  const risk = ratingLabel(research.risk.rating);

  if (!isArabicLanguage()) {
    if (!Number.isFinite(fairValue)) {
      return `${ticker}: current recommendation is ${decision} with ${confidence}% confidence. Composite Fair Value is unavailable because only ${methods} valuation methods are available. Treat the decision as preliminary until data improves.`;
    }
    const marginTextEn = Number.isFinite(margin) ? `${Math.round(margin * 100)}%` : "not available";
    return `${ticker}: current recommendation is ${decision} with ${confidence}% confidence. Composite Fair Value is compared with current price and implies ${marginTextEn} Margin of Safety. Quality is ${quality}/100, Growth is ${growth}/100, and Risk is ${risk}.`;
  }

  if (!Number.isFinite(fairValue)) {
    return `${ticker}: التوصية الحالية ${decision} بدرجة ثقة ${confidence}%. لا توجد Composite Fair Value كافية لأن عدد طرق Valuation المتاحة ${methods} فقط، لذلك يجب اعتبار القرار مبدئيًا حتى تكتمل البيانات.`;
  }

  const marginText = Number.isFinite(margin) ? `${Math.round(margin * 100)}%` : "غير متوفر";
  return `${ticker}: التوصية الحالية ${decision} بدرجة ثقة ${confidence}%. Composite Fair Value تقارن بالسعر الحالي وتعطي Margin of Safety قدره ${marginText}. Quality عند ${quality}/100 وGrowth عند ${growth}/100 بينما Risk مصنف ${risk}.`;
}

export function decisionWhyText(research) {
  const score = research.decision.compositeScore;
  const methods = research.valuation.methods.length;
  const data = research.dataCompleteness.score;
  const decision = decisionLabel(research.decision.label);
  if (!isArabicLanguage()) {
    if (research.decision.status === "INSUFFICIENT_DATA") {
      return `The decision is ${decision} because data completeness is ${data}/100 and only ${methods} valuation methods are available. The platform will not issue an actionable Buy or Sell before data is sufficient.`;
    }
    return `The ${decision} decision is based on an investment score of ${score}/100, led by Valuation, then Quality, Growth, and Risk according to the documented formula.`;
  }
  if (research.decision.status === "INSUFFICIENT_DATA") {
    return `القرار ${decision} لأن اكتمال البيانات ${data}/100 وعدد طرق Valuation المتاحة ${methods}. المنصة لا تصدر Buy أو Sell قابل للتنفيذ قبل توفر بيانات كافية.`;
  }
  return `القرار ${decision} مبني على درجة استثمار ${score}/100، مع وزن رئيسي لـ Valuation ثم Quality وGrowth وRisk حسب المعادلة الموثقة.`;
}

export function exitThesisText(decision) {
  if (!isArabicLanguage()) {
    if (decision.status === "INSUFFICIENT_DATA") {
      return "Do not size a real position from this output until market data and core financial statements are available.";
    }
    if (decision.label === "SELL") {
      return "The exit thesis changes if price stays above Fair Value while Growth, Quality, or balance-sheet Risk does not improve.";
    }
    return "The investment thesis changes if core Growth breaks, margins reset structurally lower, or balance-sheet Risk rises.";
  }
  if (decision.status === "INSUFFICIENT_DATA") {
    return "لا تستخدم هذا الناتج لتحديد حجم مركز فعلي حتى تتوفر بيانات السوق والقوائم المالية الأساسية.";
  }
  if (decision.label === "SELL") {
    return "تتغير فرضية الخروج إذا بقي السعر أعلى من Fair Value بينما لا يتحسن Growth أو Quality أو Risk في الميزانية العمومية.";
  }
  return "تتغير فرضية الاستثمار إذا انكسر Growth الأساسي، أو هبطت الهوامش هيكليًا، أو ارتفع Risk في الميزانية العمومية.";
}

function translatePattern(text) {
  const currentPriceReverseDcf = text.match(/^Current price implies roughly (.+) five-year FCF growth under the base discount assumptions\.$/);
  if (currentPriceReverseDcf) {
    return `السعر الحالي يتطلب تقريبًا ${currentPriceReverseDcf[1]} نمو FCF لخمس سنوات وفق افتراضات الخصم الأساسية.`;
  }

  const insufficientDecision = text.match(/^Rated HOLD because the data completeness score is (.+)\/100 and only (.+) valuation methods are available\.$/);
  if (insufficientDecision) {
    return `التوصية احتفاظ لأن اكتمال البيانات ${insufficientDecision[1]}/100 وعدد طرق Valuation المتاحة ${insufficientDecision[2]} فقط.`;
  }

  const actionableDecision = text.match(/^(BUY|HOLD|SELL) with investment score (.+)\/100, composite fair value (.+), and margin of safety (.+)\.$/);
  if (actionableDecision) {
    return `التوصية ${decisionLabel(actionableDecision[1])} مع درجة استثمار ${actionableDecision[2]}/100، وComposite Fair Value ${actionableDecision[3]}، وMargin of Safety ${actionableDecision[4]}.`;
  }

  const summaryHold = text.match(/^(.+) is held at HOLD because the platform needs more data before issuing an actionable Buy or Sell recommendation\. Data completeness is (.+)\/100\.$/);
  if (summaryHold) {
    return `${summaryHold[1]} يبقى على توصية احتفاظ لأن المنصة تحتاج بيانات أكثر قبل إصدار قرار شراء أو بيع قابل للتنفيذ. اكتمال البيانات ${summaryHold[2]}/100.`;
  }

  const summaryAction = text.match(/^(.+) is rated (BUY|HOLD|SELL) with (.+)% confidence\. Composite fair value is (.+), implying (.+) margin of safety\.$/);
  if (summaryAction) {
    return `${summaryAction[1]} مصنف ${decisionLabel(summaryAction[2])} بدرجة ثقة ${summaryAction[3]}%. Composite Fair Value ${summaryAction[4]} ويعني Margin of Safety ${summaryAction[5]}.`;
  }

  const mos = text.match(/^Margin of safety is (.+)\.$/);
  if (mos) return `Margin of Safety يساوي ${mos[1]}.`;

  const contribution = text.match(/^(Quality|Growth|Management|Moat|Risk) contributes (.+)\/100\.$/);
  if (contribution) return `${financialTerm(contribution[1])} يساهم بدرجة ${contribution[2]}/100.`;

  const dataCompleteness = text.match(/^Data completeness is (.+)\/100\.$/);
  if (dataCompleteness) return `اكتمال البيانات ${dataCompleteness[1]}/100.`;

  const neutralValuation = text.match(/^Valuation score is neutral because fair value or current price is missing\.$/);
  if (neutralValuation) return "درجة Valuation محايدة لأن Fair Value أو السعر الحالي غير متوفر.";

  const periods = text.match(/^(.+) annual periods available\.$/);
  if (periods) return `تتوفر ${periods[1]} فترات سنوية موثقة.`;

  const historyPeriods = text.match(/^(.+) periods$/);
  if (historyPeriods) return `${historyPeriods[1]} فترات`;

  const fieldAvailable = text.match(/^(.+) is available\.$/);
  if (fieldAvailable) return `${factorLabel(fieldAvailable[1])} متوفر.`;

  const moreEvidence = text.match(/^More evidence required: (.+)$/);
  if (moreEvidence) return `تحتاج الفرضية أدلة إضافية: ${factorLabel(moreEvidence[1])}.`;

  const ceo = text.match(/^CEO: (.+)$/);
  if (ceo) return `الرئيس التنفيذي: ${ceo[1]}`;

  const employees = text.match(/^Employees: (.+)$/);
  if (employees) return `عدد الموظفين: ${employees[1]}`;

  const dividends = text.match(/^Dividends paid: (.+)$/);
  if (dividends) return `توزيعات أرباح مدفوعة: ${dividends[1]}`;

  const buybacks = text.match(/^Share repurchases: (.+)$/);
  if (buybacks) return `إعادة شراء أسهم: ${buybacks[1]}`;

  const signal = text.match(/^(.+) is recorded as a competitive advantage signal\.$/);
  if (signal) return `تم تسجيل ${signal[1]} كإشارة ميزة تنافسية.`;

  const riskSignal = text.match(/^(.+) can pressure estimates, valuation, or thesis durability\.$/);
  if (riskSignal) return `${riskSignal[1]} قد يضغط على التقديرات أو Valuation أو متانة الفرضية.`;

  const metricTranslations = translateMetricSentence(text);
  if (metricTranslations) return metricTranslations;

  return "";
}

function translateMetricSentence(text) {
  const rules = [
    [/^ROIC is exceptional at (.+)\.$/, (v) => `ROIC استثنائي عند ${v}.`],
    [/^ROIC is strong at (.+)\.$/, (v) => `ROIC قوي عند ${v}.`],
    [/^ROIC is acceptable at (.+)\.$/, (v) => `ROIC مقبول عند ${v}.`],
    [/^ROIC is weak at (.+)\.$/, (v) => `ROIC ضعيف عند ${v}.`],
    [/^ROIC requires operating income, cash, debt, equity, and tax assumption\.$/, () => "ROIC يتطلب Operating Income، النقد، الدين، حقوق الملكية، وافتراض الضريبة."],
    [/^Gross margin is structurally high at (.+)\.$/, (v) => `Gross Margin مرتفع هيكليًا عند ${v}.`],
    [/^Gross margin is healthy at (.+)\.$/, (v) => `Gross Margin صحي عند ${v}.`],
    [/^Gross margin is acceptable at (.+)\.$/, (v) => `Gross Margin مقبول عند ${v}.`],
    [/^Gross margin is low at (.+)\.$/, (v) => `Gross Margin منخفض عند ${v}.`],
    [/^Gross margin requires revenue and gross profit\.$/, () => "Gross Margin يتطلب Revenue وGross Profit."],
    [/^Operating margin is excellent at (.+)\.$/, (v) => `Operating Margin ممتاز عند ${v}.`],
    [/^Operating margin is strong at (.+)\.$/, (v) => `Operating Margin قوي عند ${v}.`],
    [/^Operating margin is modest at (.+)\.$/, (v) => `Operating Margin متوسط عند ${v}.`],
    [/^Operating margin is thin at (.+)\.$/, (v) => `Operating Margin ضعيف عند ${v}.`],
    [/^Operating margin requires revenue and operating income\.$/, () => "Operating Margin يتطلب Revenue وOperating Income."],
    [/^Free cash flow margin is high at (.+)\.$/, (v) => `FCF Margin مرتفع عند ${v}.`],
    [/^Free cash flow margin is solid at (.+)\.$/, (v) => `FCF Margin جيد عند ${v}.`],
    [/^Free cash flow margin is positive at (.+)\.$/, (v) => `FCF Margin إيجابي عند ${v}.`],
    [/^Free cash flow conversion is weak at (.+)\.$/, (v) => `تحويل Free Cash Flow ضعيف عند ${v}.`],
    [/^FCF margin requires revenue and free cash flow\.$/, () => "FCF Margin يتطلب Revenue وFree Cash Flow."],
    [/^Net cash balance sheet with net debt \/ EBITDA of (.+)x\.$/, (v) => `الميزانية العمومية بصافي نقد، وNet Debt / EBITDA عند ${v}x.`],
    [/^Leverage is conservative at (.+)x net debt \/ EBITDA\.$/, (v) => `الرافعة المالية محافظة عند ${v}x Net Debt / EBITDA.`],
    [/^Leverage is elevated at (.+)x net debt \/ EBITDA\.$/, (v) => `الرافعة المالية مرتفعة عند ${v}x Net Debt / EBITDA.`],
    [/^Leverage is manageable but not pristine at (.+)x net debt \/ EBITDA\.$/, (v) => `الرافعة المالية قابلة للإدارة لكنها ليست مثالية عند ${v}x Net Debt / EBITDA.`],
    [/^Balance sheet factor requires cash, debt, and EBITDA\.$/, () => "عامل الميزانية العمومية يتطلب النقد، الدين، وEBITDA."],
    [/^Latest revenue growth is very strong at (.+)\.$/, (v) => `أحدث Revenue Growth قوي جدًا عند ${v}.`],
    [/^Latest revenue growth is strong at (.+)\.$/, (v) => `أحدث Revenue Growth قوي عند ${v}.`],
    [/^Latest revenue growth is modest at (.+)\.$/, (v) => `أحدث Revenue Growth متوسط عند ${v}.`],
    [/^Latest revenue growth is weak at (.+)\.$/, (v) => `أحدث Revenue Growth ضعيف عند ${v}.`],
    [/^Revenue growth requires at least two revenue periods\.$/, () => "Revenue Growth يتطلب فترتين على الأقل من Revenue."],
    [/^EPS growth is very strong at (.+)\.$/, (v) => `EPS Growth قوي جدًا عند ${v}.`],
    [/^EPS growth is strong at (.+)\.$/, (v) => `EPS Growth قوي عند ${v}.`],
    [/^EPS growth is modest at (.+)\.$/, (v) => `EPS Growth متوسط عند ${v}.`],
    [/^EPS growth is weak at (.+)\.$/, (v) => `EPS Growth ضعيف عند ${v}.`],
    [/^EPS growth requires at least two EPS periods\.$/, () => "EPS Growth يتطلب فترتين على الأقل من EPS."],
    [/^Free cash flow growth is strong at (.+)\.$/, (v) => `FCF Growth قوي عند ${v}.`],
    [/^Free cash flow growth is healthy at (.+)\.$/, (v) => `FCF Growth صحي عند ${v}.`],
    [/^Free cash flow growth is positive at (.+)\.$/, (v) => `FCF Growth إيجابي عند ${v}.`],
    [/^Free cash flow growth is negative at (.+)\.$/, (v) => `FCF Growth سلبي عند ${v}.`],
    [/^FCF growth requires at least two free cash flow periods\.$/, () => "FCF Growth يتطلب فترتين على الأقل من Free Cash Flow."],
    [/^Operating margin is (.+) and FCF margin is (.+)\.$/, (a, b) => `Operating Margin عند ${a} وFCF Margin عند ${b}.`],
    [/^Margins are acceptable: operating margin (.+), FCF margin (.+)\.$/, (a, b) => `الهوامش مقبولة: Operating Margin ${a} وFCF Margin ${b}.`],
    [/^Margin profile requires operating margin and FCF margin\.$/, () => "Margin Profile يتطلب Operating Margin وFCF Margin."],
    [/^Share count reduction is meaningful at (.+)\.$/, (v) => `انخفاض عدد الأسهم مؤثر عند ${v}.`],
    [/^Share count reduction is modest at (.+)\.$/, (v) => `انخفاض عدد الأسهم محدود عند ${v}.`],
    [/^Share count is not shrinking; buyback yield is (.+)\.$/, (v) => `عدد الأسهم لا ينخفض؛ Buyback Yield عند ${v}.`],
    [/^Buyback factor requires current and prior diluted share count\.$/, () => "عامل إعادة الشراء يتطلب عدد الأسهم المخففة الحالي والسابق."],
    [/^Leverage discipline is strong at (.+)x net debt \/ EBITDA\.$/, (v) => `انضباط الرافعة قوي عند ${v}x Net Debt / EBITDA.`],
    [/^Leverage discipline is weak at (.+)x net debt \/ EBITDA\.$/, (v) => `انضباط الرافعة ضعيف عند ${v}x Net Debt / EBITDA.`],
    [/^Leverage is acceptable at (.+)x net debt \/ EBITDA\.$/, (v) => `الرافعة مقبولة عند ${v}x Net Debt / EBITDA.`],
    [/^Balance sheet discipline requires cash, debt, and EBITDA\.$/, () => "انضباط الميزانية العمومية يتطلب النقد، الدين، وEBITDA."],
    [/^Moat rating requires explicit evidence such as brand, network effect, switching cost, cost advantage, patents, or scale\.$/, () => "تصنيف Economic Moat يتطلب أدلة صريحة مثل Brand، Network Effect، Switching Cost، Cost Advantage، Patents، أو Scale."],
    [/^Net cash reduces financial risk; net debt \/ EBITDA is (.+)x\.$/, (v) => `صافي النقد يخفض Risk المالي؛ Net Debt / EBITDA عند ${v}x.`],
    [/^Debt risk is elevated at (.+)x net debt \/ EBITDA\.$/, (v) => `Risk الدين مرتفع عند ${v}x Net Debt / EBITDA.`],
    [/^Debt risk is manageable at (.+)x net debt \/ EBITDA\.$/, (v) => `Risk الدين قابل للإدارة عند ${v}x Net Debt / EBITDA.`],
    [/^Debt risk requires cash, debt, and EBITDA\.$/, () => "Risk الدين يتطلب النقد، الدين، وEBITDA."],
    [/^Risk engine needs explicit risks such as competition, regulation, debt, customer concentration, China exposure, AI disruption, tariffs, or litigation\.$/, () => "محرك Risk يحتاج مخاطر صريحة مثل المنافسة، التنظيم، الدين، تركيز العملاء، China Exposure، AI Disruption، Tariffs، أو Litigation."]
  ];

  for (const [pattern, translate] of rules) {
    const match = text.match(pattern);
    if (match) return translate(...match.slice(1));
  }
  return "";
}

function titleLabel(value) {
  return String(value || "")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function normalize(value) {
  return String(value ?? "").trim();
}

function englishText(text) {
  if (!text || text === "-") return MISSING_EN;
  if (containsArabic(text)) return MISSING_EN;
  return text;
}

function containsArabic(text) {
  return /[\u0600-\u06FF]/.test(text);
}

function looksLikeFormula(text) {
  return /[=+\-*/()]|weighted average|clamp|score =|BUY\/HOLD\/SELL/i.test(text);
}

function looksLikeShortName(text) {
  return text.length <= 44 && !/[.!?;:]/.test(text);
}
