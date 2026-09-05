const ARABIC_RE = /[\u0600-\u06ff]/g;
const LATIN_RE = /[A-Za-z]/g;
const TECHNICAL_PHRASE_RE = /\b[A-Za-z][A-Za-z0-9-]*(?:[ /-]+[A-Za-z][A-Za-z0-9-]*)+\b/g;
const KNOWN_ACRONYMS = ["CAPEX", "FCF", "OPEX", "ROIC", "EBITDA", "CAGR", "ASP", "SBC", "WACC"];
const IGNORED_PHRASES = new Set(["bear base", "base bull", "investor relations", "market data", "consensus data"]);

export function validateArabicNarrativeQuality(input = {}) {
  if (String(input.outputLanguage || "").toLowerCase() !== "ar") return { errors: [], warnings: [] };
  const errors = [];
  const warnings = [];
  const glossary = Array.isArray(input.companyGlossary) ? input.companyGlossary : [];
  const dynamicIgnored = dynamicIgnoredTerms(input);

  if (glossary.length < 4) {
    errors.push(issue("companyGlossary", "يلزم إرفاق 4 مصطلحات فنية على الأقل وشرحها بالعربية المبسطة."));
  }
  if (glossary.length > 15) {
    warnings.push(issue("companyGlossary", "اختصر قاموس الشركة إلى أهم 15 مصطلحًا للمستثمر."));
  }

  glossary.forEach((entry, index) => {
    if (!hasArabic(entry?.termAr)) errors.push(issue(`companyGlossary.${index}.termAr`, "اسم المصطلح العربي مطلوب."));
    if (!String(entry?.termEn || "").trim()) errors.push(issue(`companyGlossary.${index}.termEn`, "المصطلح الإنجليزي الأصلي مطلوب."));
    if (!hasArabic(entry?.plainExplanationAr) || String(entry?.plainExplanationAr || "").trim().length < 24) {
      errors.push(issue(`companyGlossary.${index}.plainExplanationAr`, "اشرح المصطلح بالعربية المبسطة وفي سياق نشاط الشركة."));
    }
  });

  const narratives = investorNarratives(input);
  for (const { path, text } of narratives) {
    const arabicCount = text.match(ARABIC_RE)?.length || 0;
    const latinCount = text.match(LATIN_RE)?.length || 0;
    if (text.length >= 60 && arabicCount < 12) {
      errors.push(issue(path, "هذا النص موجه للمستثمر ويجب أن يكون مكتوبًا بالعربية."));
    } else if (text.length >= 100 && latinCount > arabicCount * 0.55) {
      errors.push(issue(path, "النص يحتوي إنجليزية أكثر من المقبول. اكتب الشرح بالعربية واجعل المصطلح الإنجليزي بين قوسين عند أول ظهور فقط."));
    }
  }

  const glossaryTerms = glossary.map((entry) => normalizeEnglish(entry?.termEn)).filter(Boolean);
  const unexplained = new Set();
  for (const { text } of narratives) {
    for (const phrase of technicalPhrases(text)) {
      const normalized = normalizeEnglish(phrase);
      if (!normalized || isIgnoredPhrase(normalized) || isDynamicIgnoredPhrase(normalized, dynamicIgnored)) continue;
      if (!glossaryTerms.some((term) => term.includes(normalized) || normalized.includes(term))) unexplained.add(phrase);
    }
  }
  if (unexplained.size) {
    errors.push(issue("companyGlossary", `مصطلحات إنجليزية غير مشروحة للمستثمر: ${[...unexplained].slice(0, 8).join("، ")}.`));
  }

  return { errors, warnings };
}

function investorNarratives(input) {
  const values = [];
  const add = (path, value) => {
    if (typeof value === "string" && value.trim()) values.push({ path, text: value.trim() });
  };
  add("companyProfile.summary", input.companyProfile?.summary);
  add("companyProfile.businessModel", input.companyProfile?.businessModel);
  (input.companyProfile?.mainGrowthDrivers || []).forEach((value, index) => add(`companyProfile.mainGrowthDrivers.${index}`, value));
  add("businessQuality.rating", input.businessQuality?.rating);
  add("businessQuality.explanation", input.businessQuality?.explanation);
  for (const section of ["strengths", "weaknesses", "risks", "catalysts"]) {
    (input[section] || []).forEach((item, index) => {
      add(`${section}.${index}.title`, item?.title);
      add(`${section}.${index}.explanation`, item?.explanation);
    });
  }
  add("thesis.updatedSummary", input.thesis?.updatedSummary);
  add("thesis.changeReason", input.thesis?.changeReason);
  add("decision.rationale", input.decision?.rationale);
  add("forwardOutlook.summary", input.latestQuarter?.forwardOutlook?.summary);
  return values;
}

function technicalPhrases(text) {
  const phrases = text.match(TECHNICAL_PHRASE_RE) || [];
  for (const acronym of KNOWN_ACRONYMS) {
    if (new RegExp(`\\b${acronym}\\b`, "i").test(text)) phrases.push(acronym);
  }
  return phrases;
}

function isIgnoredPhrase(value) {
  if (IGNORED_PHRASES.has(value)) return true;
  const words = value.split(" ");
  return words.every((word) => word.length <= 5 && word === word.toUpperCase());
}

function dynamicIgnoredTerms(input = {}) {
  return [
    input.reportIdentity?.companyName,
    stripCompanySuffix(input.reportIdentity?.companyName),
    input.reportIdentity?.ticker
  ].map(normalizeEnglish).filter(Boolean);
}

function isDynamicIgnoredPhrase(value, ignored = []) {
  return ignored.some((term) => term === value || term.includes(value) || value.includes(term));
}

function stripCompanySuffix(value) {
  return String(value || "")
    .replace(/[,\s]+(?:incorporated|inc|corp(?:oration)?|company|co|limited|ltd|plc|llc)\.?\s*$/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function normalizeEnglish(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasArabic(value) {
  return /[\u0600-\u06ff]/.test(String(value || ""));
}

function issue(field, message) {
  return { field, message };
}
