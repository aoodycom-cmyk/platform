const QUARTERLY_IMPORT_METHOD = "quarterly_earnings_lite";

export function installQuarterlySourceSafety(store, root = document.getElementById("app")) {
  if (!store || store.__quarterlySourceSafetyInstalled) return;
  store.__quarterlySourceSafetyInstalled = true;

  wrapPrompt(store);
  wrapParser(store);
  wrapSave(store);

  let frame = 0;
  const schedule = () => {
    cancelFrame(frame);
    frame = nextFrame(() => renderSourceProvenanceWarning(store, root));
  };
  store.subscribe(schedule);
  if (root) new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  setTimeout(schedule, 0);
}

export function appendQuarterlySourceContract(prompt = "") {
  const marker = "[Franklin source provenance contract]";
  const text = String(prompt || "");
  if (!text || text.includes(marker)) return text;
  return [
    text,
    "",
    marker,
    "متطلبات توثيق المصادر الإلزامية:",
    "- أضف داخل JSON حقلًا أعلى المستوى باسم sources؛ هذا استثناء مسموح من عبارة لا تضف حقولًا جديدة.",
    "- لا تنسخ مصادر التقرير السابق. أدرج فقط المصادر التي استخدمتها لنتائج هذا الربع.",
    "- استخدم Investor Relations أو SEC أو التقرير الرسمي أولًا.",
    "- إذا اعتمدت فقط على مواد أرباح ألصقها المستخدم ولم يتوفر رابط، أدرج مصدرًا بعنوان المواد المرفقة، sourceType = User-provided earnings materials، وurl = null.",
    "- يجب وجود مصدر واحد على الأقل، وبحد أقصى 5 مصادر.",
    "- اجعل id فريدًا، date بتاريخ YYYY-MM-DD، وusedFor قائمة غير فارغة بما يدعمه المصدر.",
    "- البنية المطلوبة:",
    JSON.stringify({
      sources: [
        { id: "S1", title: "اسم المصدر", url: "https://... أو null", sourceType: "Investor Relations | SEC | Earnings Call | Consensus Data | User-provided earnings materials", date: "YYYY-MM-DD", usedFor: ["revenue", "eps"] }
      ]
    }, null, 2)
  ].join("\n");
}

export function extractQuarterlySources(rawText = "") {
  const payload = parseJsonObject(rawText);
  const input = Array.isArray(payload?.sources) ? payload.sources : [];
  const sources = input.slice(0, 5).map(normalizeSource).filter(Boolean);
  const errors = [];
  if (!sources.length) {
    errors.push({
      field: "sources",
      message: "يجب توثيق مصدر واحد على الأقل خاص بنتائج هذا الربع؛ لا يجوز وراثة مصادر التقرير السابق."
    });
  }
  for (const [index, source] of sources.entries()) {
    if (source.url && !/^https?:\/\//i.test(source.url)) {
      errors.push({ field: `sources.${index}.url`, message: "رابط المصدر يجب أن يبدأ بـ https:// أو يكون null." });
    }
  }
  return { payload, sources, valid: errors.length === 0, errors };
}

export function attachQuarterlySources(report = {}, rawText = "") {
  const result = extractQuarterlySources(rawText);
  if (!result.valid) return { report, ...result };
  return {
    ...result,
    report: {
      ...report,
      sources: result.sources,
      metadata: {
        ...(report.metadata || {}),
        quarterlySourcesProvided: true,
        quarterlySourceCount: result.sources.length,
        quarterlySourcesCapturedAt: new Date().toISOString()
      }
    }
  };
}

function wrapPrompt(store) {
  const originalPrepare = store.prepareEarningsUpdatePrompt?.bind(store);
  if (originalPrepare) {
    store.prepareEarningsUpdatePrompt = (...args) => {
      const prompt = appendQuarterlySourceContract(originalPrepare(...args));
      if (store.state.earningsUpdate?.generatedPrompt !== prompt) {
        store.set({ earningsUpdate: { ...store.state.earningsUpdate, generatedPrompt: prompt } });
      }
      return prompt;
    };
  }

  const originalCurrent = store.currentEarningsUpdatePrompt?.bind(store);
  if (originalCurrent) {
    store.currentEarningsUpdatePrompt = (...args) => {
      const prompt = appendQuarterlySourceContract(originalCurrent(...args));
      if (store.state.earningsUpdate?.generatedPrompt !== prompt) {
        store.set({ earningsUpdate: { ...store.state.earningsUpdate, generatedPrompt: prompt } });
      }
      return prompt;
    };
  }
}

function wrapParser(store) {
  const original = store.parseEarningsUpdateJson?.bind(store);
  if (!original) return;
  store.parseEarningsUpdateJson = async (...args) => {
    await original(...args);
    const update = store.state.earningsUpdate || {};
    const report = update.parsedReport;
    if (!report || report.metadata?.importMethod !== QUARTERLY_IMPORT_METHOD) return;
    const attached = attachQuarterlySources(report, update.responseText || args[0] || "");
    const validation = mergeValidation(update.validation, attached.errors);
    store.set({
      earningsUpdate: {
        ...update,
        parsedReport: attached.valid ? attached.report : report,
        validation,
        preview: attached.valid ? update.preview : null
      },
      notice: attached.valid
        ? store.state.notice
        : (store.state.language === "ar"
          ? "تحديث الأرباح يحتاج مصدرًا خاصًا بهذا الربع قبل الحفظ."
          : "The earnings update needs a quarter-specific source before it can be saved.")
    });
  };
}

function wrapSave(store) {
  const original = store.saveEarningsUpdate?.bind(store);
  if (!original) return;
  store.saveEarningsUpdate = (...args) => {
    const update = store.state.earningsUpdate || {};
    const report = update.parsedReport;
    if (!report || report.metadata?.importMethod !== QUARTERLY_IMPORT_METHOD) return original(...args);
    const attached = attachQuarterlySources(report, update.responseText || report.rawAnalysisOriginal || "");
    if (!attached.valid) {
      store.set({
        earningsUpdate: {
          ...update,
          validation: mergeValidation(update.validation, attached.errors),
          preview: null
        },
        notice: store.state.language === "ar"
          ? "تم منع الحفظ: لا يوجد مصدر موثق لنتائج هذا الربع."
          : "Save blocked: no traceable source was supplied for this quarter."
      });
      return undefined;
    }
    store.set({ earningsUpdate: { ...update, parsedReport: attached.report } });
    return original(...args);
  };
}

function renderSourceProvenanceWarning(store, root) {
  if (!root) return;
  const old = root.querySelector(".franklin-quarterly-source-warning");
  const report = selectedReport(store.state);
  if (!report || report.metadata?.importMethod !== QUARTERLY_IMPORT_METHOD || report.metadata?.quarterlySourcesProvided === true) {
    old?.remove();
    return;
  }
  const ar = document.documentElement.dir === "rtl" || document.documentElement.lang === "ar";
  const banner = old || document.createElement("section");
  const className = "franklin-quarterly-source-warning";
  const html = `
    <strong>${ar ? "مصادر الربع غير موثقة" : "Quarterly sources are not traceable"}</strong>
    <p>${ar
      ? "قائمة المصادر الظاهرة قد تكون موروثة من التحليل الكامل السابق ولا تثبت مصدر أرقام هذا الربع. لا تعتمد على هذا التحديث لاتخاذ قرار قبل إعادة استيراده بمصدر رسمي أو مواد أرباح موثقة."
      : "The visible source list may be inherited from the prior full analysis and does not prove where this quarter's figures came from. Do not use this update for a decision until it is re-imported with an official source or traceable earnings materials."}</p>
  `;
  setClassName(banner, className);
  setHtml(banner, html);
  ensureStyles();
  if (!old) {
    const decisionBanner = root.querySelector(".franklin-financial-safety-banner");
    const appBar = root.querySelector(".report-app-bar");
    if (decisionBanner) decisionBanner.insertAdjacentElement("afterend", banner);
    else if (appBar) appBar.insertAdjacentElement("afterend", banner);
    else root.prepend(banner);
  }
}

function selectedReport(state = {}) {
  const selection = state.externalReportSelection || {};
  const reports = state.externalAnalyses?.[String(selection.ticker || "").trim().toUpperCase()] || [];
  return reports.find((item) => item.id === selection.reportId) || reports[0] || null;
}

function mergeValidation(current = {}, extraErrors = []) {
  const existing = Array.isArray(current.errors) ? current.errors : [];
  const extras = extraErrors.filter((error) => !existing.some((item) => item.field === error.field && item.message === error.message));
  const errors = [...existing, ...extras];
  return { ...current, valid: current.valid !== false && errors.length === 0, errors, warnings: current.warnings || [] };
}

function normalizeSource(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const id = text(value.id, 60);
  const title = text(value.title, 180);
  const sourceType = text(value.sourceType || value.type, 100);
  const url = text(value.url, 500);
  const date = text(value.date, 10);
  const usedFor = (Array.isArray(value.usedFor) ? value.usedFor : [])
    .map((item) => text(item, 100))
    .filter(Boolean);
  if (!title && !sourceType) return null;
  return {
    ...(id ? { id } : {}),
    title: title || sourceType,
    url: url || null,
    sourceType: sourceType || "Quarterly earnings source",
    ...(date ? { date } : {}),
    ...(usedFor.length ? { usedFor } : {})
  };
}

function parseJsonObject(rawText) {
  const textValue = String(rawText || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/[“”]/g, '"')
    .trim();
  const start = textValue.indexOf("{");
  const end = textValue.lastIndexOf("}");
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(textValue.slice(start, end + 1));
  } catch {
    return null;
  }
}

function text(value, maxLength) {
  const clean = String(value ?? "").trim();
  return clean ? clean.slice(0, maxLength) : null;
}

function nextFrame(callback) {
  if (typeof requestAnimationFrame === "function") return requestAnimationFrame(callback);
  return setTimeout(callback, 0);
}

function cancelFrame(frame) {
  if (!frame) return;
  if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
  else clearTimeout(frame);
}

function setClassName(element, className) {
  if (element.className !== className) element.className = className;
}

function setHtml(element, html) {
  if (element.dataset.franklinContentKey === html) return;
  element.innerHTML = html;
  element.dataset.franklinContentKey = html;
}

function ensureStyles() {
  if (document.getElementById("franklin-quarterly-source-styles")) return;
  const style = document.createElement("style");
  style.id = "franklin-quarterly-source-styles";
  style.textContent = `
    .franklin-quarterly-source-warning{margin:10px 14px 14px;padding:13px 14px;border:1px solid rgba(244,63,94,.55);border-radius:14px;background:rgba(244,63,94,.09);color:var(--ink,#fff);line-height:1.65}
    .franklin-quarterly-source-warning strong{display:block;margin-bottom:4px;font-size:13px;color:#fda4af}
    .franklin-quarterly-source-warning p{margin:0;font-size:12px;color:var(--ink-soft,#c5cad8)}
  `;
  document.head.append(style);
}
