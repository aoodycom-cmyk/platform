import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateArabicNarrativeQuality } from "../src/externalAnalysis/arabicNarrativeQuality.js";

const glossary = [
  { termAr: "التدفق النقدي الحر", termEn: "FCF", plainExplanationAr: "النقد المتبقي بعد تشغيل الشركة وتمويل استثماراتها الضرورية.", whyItMattersAr: "يمول النمو ويخفض الدين." },
  { termAr: "الإنفاق الرأسمالي", termEn: "CapEx", plainExplanationAr: "الأموال المستخدمة لبناء المصانع وشراء المعدات طويلة الأجل.", whyItMattersAr: "يؤثر في النقد والعائد." },
  { termAr: "تصنيع الرقائق المتخصصة", termEn: "Specialty Foundry", plainExplanationAr: "تصنيع تعاقدي لرقائق ذات خصائص مخصصة للاتصالات والسيارات.", whyItMattersAr: "يدعم الهوامش والتميّز." },
  { termAr: "الفوتونيات السيليكونية", termEn: "Silicon Photonics", plainExplanationAr: "تقنية تنقل البيانات باستخدام الضوء لرفع السرعة وتقليل استهلاك الطاقة.", whyItMattersAr: "تخدم مراكز البيانات." }
];

const good = validateArabicNarrativeQuality({
  outputLanguage: "ar",
  companyGlossary: glossary,
  companyProfile: { summary: "تستفيد الشركة من تصنيع الرقائق المتخصصة (Specialty Foundry)، وهي رقائق مصممة لوظائف محددة في الاتصالات والسيارات." },
  thesis: { updatedSummary: "تحسن التدفق النقدي الحر (FCF) يدعم قدرة الشركة على تمويل النمو دون زيادة الدين." }
});
assert.deepEqual(good.errors, []);

const bad = validateArabicNarrativeQuality({
  outputLanguage: "ar",
  companyGlossary: [],
  companyProfile: { summary: "The company is moving toward specialty foundry and silicon photonics with a stronger product mix and higher margins." }
});
assert.ok(bad.errors.some((item) => item.field === "companyGlossary"));
assert.ok(bad.errors.some((item) => item.field === "companyProfile.summary"));

const initialPrompt = readFileSync(new URL("../src/externalAnalysis/initialAnalysisPrompt.js", import.meta.url), "utf8");
const earningsPrompt = readFileSync(new URL("../src/externalAnalysis/earningsRevaluationPrompt.js", import.meta.url), "utf8");
const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
assert.match(initialPrompt, /LANGUAGE GATE/);
assert.match(earningsPrompt, /companyGlossary/);
assert.match(components, /مصطلحات الشركة ببساطة/);

console.log("Arabic narrative and company glossary checks passed.");
