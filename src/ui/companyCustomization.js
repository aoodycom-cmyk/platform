const CUSTOM_KEY = "franklinCompanyCustomizationV1";

export function installCompanyCustomization(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.companyCustomizationInstalled === "true") return;
  root.dataset.companyCustomizationInstalled = "true";
  installStyles();

  const apply = () => {
    reapplyStoredCustomizations(store);
    mountPanel(store, root);
    paintLogos(store, root);
  };

  apply();
  store.subscribe?.(() => {
    mountPanel(store, root);
    paintLogos(store, root);
  });
  new MutationObserver(() => paintLogos(store, root)).observe(root, { childList: true, subtree: true });

  root.addEventListener("change", async (event) => {
    const fileInput = event.target.closest?.("[data-company-logo-upload]");
    if (!fileInput) return;
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) return toast("اختر ملف صورة صالحًا.", "error");
    try {
      const logoDataUrl = await compressLogo(file);
      const ticker = selectedTicker(store);
      if (!ticker) return;
      const custom = readCustom();
      custom[ticker] = { ...(custom[ticker] || {}), logoDataUrl, updatedAt: new Date().toISOString() };
      writeCustom(custom);
      applyCustomizationToReports(store, ticker, custom[ticker]);
      toast("تم اعتماد شعار الشركة.", "success");
    } catch (error) {
      toast(`تعذر حفظ الشعار: ${String(error?.message || error)}`, "error");
    }
  });

  root.addEventListener("click", (event) => {
    const savePrice = event.target.closest?.("[data-save-current-price]");
    const resetPrice = event.target.closest?.("[data-reset-current-price]");
    const removeLogo = event.target.closest?.("[data-remove-company-logo]");
    if (!savePrice && !resetPrice && !removeLogo) return;
    const ticker = selectedTicker(store);
    if (!ticker) return;
    const custom = readCustom();
    const current = { ...(custom[ticker] || {}) };

    if (removeLogo) {
      delete current.logoDataUrl;
      current.updatedAt = new Date().toISOString();
      custom[ticker] = current;
      writeCustom(custom);
      applyCustomizationToReports(store, ticker, current);
      toast("تم حذف الشعار المخصص.", "success");
      return;
    }

    if (resetPrice) {
      if (Number.isFinite(Number(current.analysisPrice))) {
        updateReportPrice(store, ticker, Number(current.analysisPrice));
      }
      delete current.currentPrice;
      delete current.analysisPrice;
      current.updatedAt = new Date().toISOString();
      custom[ticker] = current;
      writeCustom(custom);
      toast("تمت إعادة سعر التحليل الأصلي.", "success");
      return;
    }

    const input = root.querySelector("[data-current-price-input]");
    const value = Number(input?.value);
    if (!Number.isFinite(value) || value <= 0) return toast("أدخل سعرًا موجبًا صالحًا.", "error");
    const report = selectedReport(store);
    if (!Number.isFinite(Number(current.analysisPrice))) current.analysisPrice = Number(report?.fairValueSummary?.currentPrice) || null;
    current.currentPrice = value;
    current.updatedAt = new Date().toISOString();
    custom[ticker] = current;
    writeCustom(custom);
    updateReportPrice(store, ticker, value);
    toast("تم تحديث السعر وحساب الخصم إلى Base.", "success");
  });
}

export function readCompanyCustomization(ticker) {
  return readCustom()[String(ticker || "").trim().toUpperCase()] || null;
}

function mountPanel(store, root) {
  root.querySelector("[data-company-customization-panel]")?.remove();
  if (store.state.activePanel !== "external-report") return;
  const report = selectedReport(store);
  if (!report) return;
  const ticker = report.company?.ticker || selectedTicker(store);
  const custom = readCompanyCustomization(ticker) || {};
  const price = Number(custom.currentPrice ?? report.fairValueSummary?.currentPrice);
  const base = Number(report.fairValueSummary?.fairValueBase);
  const upside = Number.isFinite(price) && price > 0 && Number.isFinite(base) ? (base / price - 1) * 100 : null;
  const discount = Number.isFinite(price) && Number.isFinite(base) && base !== 0 ? ((base - price) / base) * 100 : null;
  const host = root.querySelector(".mobile-page-content");
  if (!host) return;
  const section = document.createElement("section");
  section.className = "franklin-company-customization";
  section.dataset.companyCustomizationPanel = "true";
  section.innerHTML = `
    <div class="fcc-head"><div><span>تخصيص التقرير</span><strong>${escapeHtml(ticker)}</strong></div><small>يؤثر على العرض والتصدير فقط</small></div>
    <div class="fcc-grid">
      <div class="fcc-logo-card">
        <div class="fcc-logo-preview">${custom.logoDataUrl ? `<img src="${escapeHtml(custom.logoDataUrl)}" alt="">` : `<span>${escapeHtml(ticker.slice(0,3))}</span>`}</div>
        <div><strong>شعار الشركة</strong><small>PNG / JPG / WEBP</small></div>
        <label class="fcc-upload">رفع شعار<input type="file" accept="image/*" data-company-logo-upload hidden></label>
        ${custom.logoDataUrl ? `<button type="button" data-remove-company-logo>حذف</button>` : ""}
      </div>
      <div class="fcc-price-card">
        <label><span>السعر الحالي</span><input type="number" min="0.0001" step="0.01" inputmode="decimal" data-current-price-input value="${Number.isFinite(price) ? price : ""}"></label>
        <div class="fcc-derived"><span>إلى Base <b dir="ltr">${fmtPct(upside)}</b></span><span>سعر الخصم <b dir="ltr">${fmtPct(discount)}</b></span></div>
        <div class="fcc-actions"><button type="button" class="fcc-save" data-save-current-price>تحديث السعر</button><button type="button" data-reset-current-price ${Number.isFinite(Number(custom.currentPrice)) ? "" : "disabled"}>إعادة الأصلي</button></div>
      </div>
    </div>`;
  const social = host.querySelector("[data-franklin-social-export-panel]");
  if (social) social.insertAdjacentElement("afterend", section);
  else host.prepend(section);
}

function reapplyStoredCustomizations(store) {
  const custom = readCustom();
  for (const [ticker, value] of Object.entries(custom)) applyCustomizationToReports(store, ticker, value, { silent: true });
}

function applyCustomizationToReports(store, ticker, custom, options = {}) {
  const list = store.state.externalAnalyses?.[ticker];
  if (!Array.isArray(list) || !list.length) return;
  let changed = false;
  const nextList = list.map((report) => {
    const next = structuredCloneSafe(report);
    if (custom.logoDataUrl && next.company?.logoUrl !== custom.logoDataUrl) {
      next.company = { ...(next.company || {}), logoUrl: custom.logoDataUrl };
      changed = true;
    }
    if (!custom.logoDataUrl && next.company?.logoUrl) {
      next.company = { ...(next.company || {}) };
      delete next.company.logoUrl;
      changed = true;
    }
    if (Number.isFinite(Number(custom.currentPrice)) && Number(next.fairValueSummary?.currentPrice) !== Number(custom.currentPrice)) {
      applyPriceToReport(next, Number(custom.currentPrice));
      changed = true;
    }
    return next;
  });
  if (changed && !options.silent) store.set({ externalAnalyses: { ...(store.state.externalAnalyses || {}), [ticker]: nextList } });
  else if (changed && options.silent) store.state.externalAnalyses = { ...(store.state.externalAnalyses || {}), [ticker]: nextList };
}

function updateReportPrice(store, ticker, price) {
  const list = store.state.externalAnalyses?.[ticker];
  if (!Array.isArray(list)) return;
  const nextList = list.map((report) => {
    const next = structuredCloneSafe(report);
    applyPriceToReport(next, price);
    return next;
  });
  store.set({ externalAnalyses: { ...(store.state.externalAnalyses || {}), [ticker]: nextList } });
}

function applyPriceToReport(report, price) {
  const base = Number(report.fairValueSummary?.fairValueBase);
  const fair = { ...(report.fairValueSummary || {}), currentPrice: price };
  fair.upsideDownsidePercent = Number.isFinite(base) && price > 0 ? (base / price - 1) * 100 : null;
  fair.marginOfSafetyPercent = Number.isFinite(base) && base !== 0 ? ((base - price) / base) * 100 : null;
  report.fairValueSummary = fair;
}

function paintLogos(store, root) {
  const custom = readCustom();
  root.querySelectorAll(".library-company-card[data-external-ticker]").forEach((card) => paintLogo(card.querySelector(".company-logo"), custom[String(card.dataset.externalTicker || "").toUpperCase()]?.logoDataUrl));
  const ticker = selectedTicker(store);
  if (ticker && custom[ticker]?.logoDataUrl) root.querySelectorAll(".report-app-bar .company-logo").forEach((node) => paintLogo(node, custom[ticker].logoDataUrl));
}

function paintLogo(node, dataUrl) {
  if (!node || !dataUrl) return;
  let image = node.querySelector("img");
  if (!image) {
    image = document.createElement("img");
    image.alt = "";
    node.prepend(image);
  }
  if (image.src !== dataUrl) image.src = dataUrl;
  image.hidden = false;
  node.querySelector(".company-logo-fallback")?.setAttribute("hidden", "");
  node.classList.add("has-image");
  node.classList.remove("is-fallback");
}

async function compressLogo(file) {
  const bitmap = await createImageBitmap(file);
  const max = 384;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas.toDataURL("image/png");
}

function selectedTicker(store) { return String(store.state.externalReportSelection?.ticker || "").trim().toUpperCase(); }
function selectedReport(store) {
  const ticker = selectedTicker(store);
  const id = store.state.externalReportSelection?.reportId;
  const list = store.state.externalAnalyses?.[ticker] || [];
  return list.find((item) => item?.id === id) || list[0] || null;
}
function readCustom() { try { const v = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; } }
function writeCustom(value) { localStorage.setItem(CUSTOM_KEY, JSON.stringify(value || {})); }
function structuredCloneSafe(value) { return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
function fmtPct(value) { return Number.isFinite(Number(value)) ? `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(1)}%` : "—"; }
function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function toast(message, tone) { document.querySelector(".fcc-toast")?.remove(); const n=document.createElement("div"); n.className=`fcc-toast ${tone||""}`; n.textContent=message; document.body.appendChild(n); setTimeout(()=>n.remove(),2600); }
function installStyles() {
  if (document.getElementById("franklin-company-customization-styles")) return;
  const style=document.createElement("style"); style.id="franklin-company-customization-styles"; style.textContent=`
  .franklin-company-customization{margin:0 0 18px;padding:16px;border:1px solid rgba(96,165,250,.28);border-radius:18px;background:#0d111b}.fcc-head{display:flex;justify-content:space-between;align-items:end;gap:10px;margin-bottom:12px}.fcc-head>div{display:grid;gap:2px}.fcc-head span{font-size:11px;font-weight:800;color:#60a5fa}.fcc-head strong{font-size:18px}.fcc-head small{color:#8b98ad;font-size:10px}.fcc-grid{display:grid;grid-template-columns:1fr 1.35fr;gap:10px}.fcc-logo-card,.fcc-price-card{padding:12px;border:1px solid #29344a;border-radius:14px;background:#101624}.fcc-logo-card{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:10px}.fcc-logo-preview{width:52px;height:52px;border:1px solid #344156;border-radius:12px;display:grid;place-items:center;overflow:hidden;background:#0b101a;color:#2dd4bf;font-weight:900}.fcc-logo-preview img{width:100%;height:100%;object-fit:contain;padding:4px}.fcc-logo-card>div:nth-child(2){display:grid;gap:2px}.fcc-logo-card small{font-size:10px;color:#8b98ad}.fcc-upload,.fcc-logo-card button,.fcc-actions button{min-height:38px;padding:8px 10px;border:1px solid #344156;border-radius:10px;background:#161d2b;color:#f5f7fb;font-weight:800;font-size:11px;display:inline-flex;align-items:center;justify-content:center}.fcc-upload{cursor:pointer}.fcc-price-card{display:grid;gap:10px}.fcc-price-card label{display:grid;gap:5px}.fcc-price-card label span{font-size:11px;color:#9aa6ba}.fcc-price-card input{direction:ltr;text-align:left}.fcc-derived{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fcc-derived span{padding:9px;border-radius:10px;background:#0b101a;color:#9aa6ba;font-size:11px}.fcc-derived b{display:block;margin-top:3px;color:#f5f7fb;font-size:15px}.fcc-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fcc-actions .fcc-save{border-color:rgba(45,212,191,.45);background:rgba(45,212,191,.12);color:#2dd4bf}.fcc-toast{position:fixed;z-index:26000;left:50%;bottom:max(88px,calc(env(safe-area-inset-bottom) + 74px));transform:translateX(-50%);padding:10px 14px;border:1px solid #344156;border-radius:999px;background:#101624;color:#fff;font:700 12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif}.fcc-toast.success{border-color:rgba(45,212,191,.5)}.fcc-toast.error{border-color:rgba(241,123,137,.6)}
  @media(max-width:640px){.fcc-grid{grid-template-columns:1fr}.fcc-head{align-items:start}.fcc-logo-card{grid-template-columns:52px 1fr auto}.fcc-head small{max-width:140px;text-align:left}}
  `; document.head.appendChild(style);
}

function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install=()=>{ if(window.__equityResearchStore) installCompanyCustomization(window.__equityResearchStore,document.getElementById("app")); };
  if(window.__equityResearchStore) install(); else window.addEventListener("franklin:boot-ready",install,{once:true});
}
autoInstall();
