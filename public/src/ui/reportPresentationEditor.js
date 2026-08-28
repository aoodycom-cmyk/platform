import { getExternalAnalysis } from "../externalAnalysis/storage.js";

export function installReportPresentationEditor(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.reportPresentationEditorInstalled === "true") return;
  root.dataset.reportPresentationEditorInstalled = "true";

  const mount = () => mountEditor(store, root);
  store.subscribe?.(mount);
  mount();

  root.addEventListener("change", async (event) => {
    const input = event.target.closest?.("[data-owner-logo-input]");
    if (!input) return;
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\/(?:png|jpe?g|webp)$/i.test(String(file.type || ""))) {
      return setNotice(store, "اختر صورة PNG أو JPG أو WEBP.");
    }
    try {
      const dataUrl = await resizeLogo(file);
      if (store.state.activePanel === "external-import") {
        updateExternalImportPresentation(store, { companyLogoDataUrl: dataUrl });
        return setNotice(store, "تم تجهيز الشعار وسيُحفظ مع التحليل.");
      }
      updateReports(store, (report, selected) => selected || sameTicker(store, report)
        ? withPresentation(report, { companyLogoDataUrl: dataUrl })
        : report);
      setNotice(store, "تم حفظ شعار الشركة وإظهاره في المكتبة والتقرير.");
    } catch (error) {
      setNotice(store, `تعذر حفظ الشعار: ${String(error?.message || error)}`);
    }
  });

  root.addEventListener("click", (event) => {
    const save = event.target.closest?.("[data-owner-presentation-save]");
    const removeLogo = event.target.closest?.("[data-owner-logo-remove]");
    if (!save && !removeLogo) return;

    if (removeLogo) {
      if (store.state.activePanel === "external-import") {
        updateExternalImportPresentation(store, { companyLogoDataUrl: null });
        return setNotice(store, "تم حذف الشعار من التحليل الجاري.");
      }
      updateReports(store, (report, selected) => selected || sameTicker(store, report)
        ? withPresentation(report, { companyLogoDataUrl: null })
        : report);
      setNotice(store, "تم حذف شعار الشركة.");
      return;
    }

    const priceInput = root.querySelector("[data-owner-current-price]");
    const morningstarInput = root.querySelector("[data-owner-morningstar-value]");
    const price = optionalPositiveNumber(priceInput?.value);
    const morningstar = optionalPositiveNumber(morningstarInput?.value);
    if (priceInput?.value.trim() && price === null) return setNotice(store, "السعر الحالي يجب أن يكون رقمًا موجبًا.");
    if (morningstarInput?.value.trim() && morningstar === null) return setNotice(store, "قيمة Morningstar يجب أن تكون رقمًا موجبًا.");

    if (store.state.activePanel === "external-import") {
      updateExternalImportPresentation(store, {
        currentPrice: price,
        morningstarFairValue: morningstar
      });
      return setNotice(store, "تم تجهيز السعر الحالي وقيمة Morningstar للحفظ مع التحليل.");
    }

    updateReports(store, (report, selected) => {
      if (!selected) return report;
      let next = withPresentation(report, { morningstarFairValue: morningstar });
      if (price !== null) next = withCurrentPrice(next, price);
      return next;
    });
    setNotice(store, "تم تحديث السعر الحالي وقيمة Morningstar.");
  });
}

export function withCurrentPrice(report = {}, currentPrice) {
  const next = clone(report);
  const price = Number(currentPrice);
  const base = Number(next.fairValueSummary?.fairValueBase);
  next.fairValueSummary = { ...(next.fairValueSummary || {}), currentPrice: price };
  next.fairValueSummary.upsideDownsidePercent = Number.isFinite(base) && price > 0 ? (base / price - 1) * 100 : null;
  next.fairValueSummary.marginOfSafetyPercent = Number.isFinite(base) && base !== 0 ? ((base - price) / base) * 100 : null;
  const v3 = next.metadata?.franklinV3Report;
  if (v3 && typeof v3 === "object") {
    v3.marketPrice = { ...(v3.marketPrice || {}), value: price };
    v3.valuation = { ...(v3.valuation || {}) };
    v3.valuation.upsideToBasePct = next.fairValueSummary.upsideDownsidePercent;
    v3.valuation.marginOfSafetyPct = next.fairValueSummary.marginOfSafetyPercent;
  }
  return next;
}

export function withPresentation(report = {}, patch = {}) {
  const next = clone(report);
  next.presentation = { ...(next.presentation || {}), ...patch };
  if (patch.companyLogoDataUrl === null) delete next.presentation.companyLogoDataUrl;
  if (patch.morningstarFairValue === null) delete next.presentation.morningstarFairValue;
  return next;
}

function mountEditor(store, root) {
  root.querySelector("[data-owner-presentation-editor]")?.remove();
  if (store.state.activePanel === "external-import") return mountImportEditor(store, root);
  if (store.state.activePanel !== "external-report") return;
  const report = selectedReport(store);
  const shell = root.querySelector(".external-report-shell");
  if (!report || !shell) return;
  const presentation = report.presentation || {};
  const logo = presentation.companyLogoDataUrl;
  const section = document.createElement("section");
  section.className = "owner-presentation-editor";
  section.dataset.ownerPresentationEditor = "true";
  section.innerHTML = `
    <details open>
      <summary><span>تخصيص عرض الشركة</span><small>خاص بالمالك</small></summary>
      <div class="owner-presentation-grid">
        <div class="owner-logo-control">
          <span class="owner-logo-preview">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : escapeHtml(String(report.company?.ticker || "—").slice(0, 3))}</span>
          <label>شعار الشركة<input type="file" accept="image/png,image/jpeg,image/webp" data-owner-logo-input></label>
          ${logo ? `<button type="button" data-owner-logo-remove>حذف الشعار</button>` : ""}
        </div>
        <label><span>السعر الحالي</span><input type="number" min="0.0001" step="0.01" inputmode="decimal" data-owner-current-price value="${fieldValue(report.fairValueSummary?.currentPrice)}"></label>
        <label><span>قيمة Morningstar</span><input type="number" min="0.0001" step="0.01" inputmode="decimal" data-owner-morningstar-value value="${fieldValue(presentation.morningstarFairValue)}" placeholder="مثال: 150"></label>
        <button type="button" class="primary-btn" data-owner-presentation-save>حفظ التعديلات</button>
      </div>
    </details>`;
  shell.prepend(section);
}

function mountImportEditor(store, root) {
  const panel = root.querySelector(".external-import-panel");
  const anchor = panel?.querySelector(".external-import-context");
  if (!panel || !anchor) return;
  const draft = store.state.externalImport?.draftReport;
  const owner = store.state.externalImport?.ownerPresentation || {};
  if (draft && reportNeedsOwnerPresentation(draft, owner)) {
    updateExternalImportPresentation(store, {});
    return;
  }
  const logo = owner.companyLogoDataUrl ?? draft?.presentation?.companyLogoDataUrl;
  const currentPrice = owner.currentPrice ?? draft?.fairValueSummary?.currentPrice;
  const morningstar = owner.morningstarFairValue ?? draft?.presentation?.morningstarFairValue;
  const section = document.createElement("section");
  section.className = "owner-presentation-editor owner-import-presentation-editor";
  section.dataset.ownerPresentationEditor = "true";
  section.innerHTML = `
    <div class="owner-presentation-visible-head">
      <strong>بيانات بطاقة الشركة</strong>
      <small>تُدخلها أنت يدويًا</small>
    </div>
    <div class="owner-presentation-grid">
      <div class="owner-logo-control">
        <span class="owner-logo-preview">${logo ? `<img src="${escapeHtml(logo)}" alt="">` : escapeHtml(String(draft?.company?.ticker || store.state.externalImport?.tickerHint || "LOGO").slice(0, 4))}</span>
        <label>إضافة شعار الشركة<input type="file" accept="image/png,image/jpeg,image/webp" data-owner-logo-input></label>
        ${logo ? `<button type="button" data-owner-logo-remove>حذف</button>` : ""}
      </div>
      <label><span>السعر الحالي القابل للتعديل</span><input type="number" min="0.0001" step="0.01" inputmode="decimal" data-owner-current-price value="${fieldValue(currentPrice)}" placeholder="مثال: 124"></label>
      <label><span>سعر Morningstar اليدوي</span><input type="number" min="0.0001" step="0.01" inputmode="decimal" data-owner-morningstar-value value="${fieldValue(morningstar)}" placeholder="مثال: 150"></label>
      <button type="button" class="primary-btn" data-owner-presentation-save>تثبيت بيانات البطاقة</button>
    </div>`;
  anchor.insertAdjacentElement("afterend", section);
}

function updateExternalImportPresentation(store, patch) {
  const externalImport = store.state.externalImport || {};
  const current = externalImport.ownerPresentation || {};
  const ownerPresentation = { ...current, ...patch };
  if (patch.companyLogoDataUrl === null) delete ownerPresentation.companyLogoDataUrl;
  if (patch.morningstarFairValue === null) delete ownerPresentation.morningstarFairValue;
  if (patch.currentPrice === null) delete ownerPresentation.currentPrice;
  let draftReport = externalImport.draftReport;
  if (draftReport) draftReport = applyOwnerPresentationToReport(draftReport, ownerPresentation);
  store.set({ externalImport: { ...externalImport, ownerPresentation, draftReport } });
}

function applyOwnerPresentationToReport(report, owner) {
  let next = report;
  const presentationPatch = {};
  if (Object.hasOwn(owner, "companyLogoDataUrl")) presentationPatch.companyLogoDataUrl = owner.companyLogoDataUrl;
  if (Object.hasOwn(owner, "morningstarFairValue")) presentationPatch.morningstarFairValue = owner.morningstarFairValue;
  if (Object.keys(presentationPatch).length) next = withPresentation(next, presentationPatch);
  if (owner.currentPrice) next = withCurrentPrice(next, owner.currentPrice);
  return next;
}

function reportNeedsOwnerPresentation(report, owner) {
  if (Object.hasOwn(owner, "companyLogoDataUrl") && report.presentation?.companyLogoDataUrl !== owner.companyLogoDataUrl) return true;
  if (Object.hasOwn(owner, "morningstarFairValue") && Number(report.presentation?.morningstarFairValue) !== Number(owner.morningstarFairValue)) return true;
  if (owner.currentPrice && Number(report.fairValueSummary?.currentPrice) !== Number(owner.currentPrice)) return true;
  return false;
}

function updateReports(store, updater) {
  const selection = store.state.externalReportSelection || {};
  const ticker = String(selection.ticker || "").toUpperCase();
  const collection = store.state.externalAnalyses || {};
  const list = collection[ticker] || [];
  const selectedId = selectedReport(store)?.id;
  const updated = list.map((report) => updater(report, report.id === selectedId));
  store.set({ externalAnalyses: { ...collection, [ticker]: updated } });
}

function selectedReport(store) {
  const selection = store.state.externalReportSelection || {};
  return getExternalAnalysis(store.state.externalAnalyses || {}, selection.ticker, selection.reportId || "latest");
}

function sameTicker(store, report) {
  return String(report.company?.ticker || "").toUpperCase() === String(store.state.externalReportSelection?.ticker || "").toUpperCase();
}

function optionalPositiveNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function fieldValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? String(number) : "";
}

function setNotice(store, notice) {
  store.set({ notice });
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function resizeLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("تعذر قراءة الصورة."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("ملف الصورة غير صالح."));
      image.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, size, size);
        const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        ctx.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        resolve(canvas.toDataURL("image/png", 0.92));
      };
      image.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install = () => window.__equityResearchStore && installReportPresentationEditor(window.__equityResearchStore, document.getElementById("app"));
  if (window.__equityResearchStore) install();
  else window.addEventListener("franklin:boot-ready", install, { once: true });
}

autoInstall();
