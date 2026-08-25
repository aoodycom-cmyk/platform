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
    <details>
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

function fieldValue(value) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "";
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
