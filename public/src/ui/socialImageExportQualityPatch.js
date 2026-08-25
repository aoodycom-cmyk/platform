import { getExternalAnalysis } from "../externalAnalysis/storage.js";
import {
  renderEarningsTrackerPng,
  renderInvestmentInfographicPng,
  SOCIAL_EXPORT_HEIGHT,
  SOCIAL_EXPORT_WIDTH
} from "./socialImageExport.js";

export const SOCIAL_EXPORT_SCALE = 2;
export const SOCIAL_EXPORT_PIXEL_WIDTH = SOCIAL_EXPORT_WIDTH * SOCIAL_EXPORT_SCALE;
export const SOCIAL_EXPORT_PIXEL_HEIGHT = SOCIAL_EXPORT_HEIGHT * SOCIAL_EXPORT_SCALE;

export function installSocialImageExportQualityPatch(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.socialImageQualityPatchInstalled === "true") return;
  root.dataset.socialImageQualityPatchInstalled = "true";

  const markHiRes = () => {
    const label = root.querySelector("[data-franklin-social-export-panel] .franklin-social-export-heading small");
    if (label) label.textContent = `PNG · ${SOCIAL_EXPORT_PIXEL_WIDTH} × ${SOCIAL_EXPORT_PIXEL_HEIGHT} · HD`;
  };
  markHiRes();
  const observer = new MutationObserver(markHiRes);
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-social-image-export]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const selection = store.state.externalReportSelection || {};
    const report = getExternalAnalysis(store.state.externalAnalyses || {}, selection.ticker, selection.reportId || "latest");
    if (!report) return toast("تعذر العثور على التقرير المحفوظ.", "error");

    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "جارٍ تجهيز صورة HD…";
    try {
      const renderer = button.dataset.socialImageExport === "investment"
        ? renderInvestmentInfographicPng
        : renderEarningsTrackerPng;
      const exportReport = effectiveReport(report);
      let blob = await renderAtNativeScale(renderer, exportReport);
      if (report?.company?.logoUrl) blob = await overlayCompanyLogo(blob, report.company.logoUrl);
      const ticker = filePart(report?.company?.ticker || report?.metadata?.franklinV3Report?.reportIdentity?.ticker || "franklin");
      const suffix = button.dataset.socialImageExport === "investment" ? "investment-infographic" : "earnings-tracker";
      await deliver(blob, `franklin-${ticker}-${suffix}-hd.png`, `${ticker.toUpperCase()} — Franklin HD`);
      toast(`تم إنشاء الصورة بجودة HD · ${SOCIAL_EXPORT_PIXEL_WIDTH}×${SOCIAL_EXPORT_PIXEL_HEIGHT}`, "success");
    } catch (error) {
      if (error?.name !== "AbortError") toast(`تعذر التصدير: ${String(error?.message || error)}`, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
      markHiRes();
    }
  }, { capture: true });
}

export function effectiveReport(report = {}) {
  const clone = typeof structuredClone === "function" ? structuredClone(report) : JSON.parse(JSON.stringify(report));
  const price = Number(clone?.fairValueSummary?.currentPrice);
  const base = Number(clone?.fairValueSummary?.fairValueBase);
  const v3 = clone?.metadata?.franklinV3Report;
  if (Number.isFinite(price) && price > 0 && v3 && typeof v3 === "object") {
    v3.marketPrice = { ...(v3.marketPrice || {}), value: price };
    v3.valuation = { ...(v3.valuation || {}) };
    v3.valuation.upsideToBasePct = Number.isFinite(base) ? (base / price - 1) * 100 : null;
    v3.valuation.marginOfSafetyPct = Number.isFinite(base) && base !== 0 ? ((base - price) / base) * 100 : null;
  }
  return clone;
}

async function renderAtNativeScale(renderer, report) {
  const originalCreateElement = document.createElement.bind(document);
  document.createElement = function patchedCreateElement(tagName, ...args) {
    const element = originalCreateElement(tagName, ...args);
    if (String(tagName).toLowerCase() !== "canvas") return element;

    return new Proxy(element, {
      set(target, property, value) {
        if (property === "width" && Number(value) === SOCIAL_EXPORT_WIDTH) {
          target.width = SOCIAL_EXPORT_PIXEL_WIDTH;
          return true;
        }
        if (property === "height" && Number(value) === SOCIAL_EXPORT_HEIGHT) {
          target.height = SOCIAL_EXPORT_PIXEL_HEIGHT;
          return true;
        }
        return Reflect.set(target, property, value, target);
      },
      get(target, property) {
        if (property === "getContext") {
          return (...contextArgs) => {
            const context = target.getContext(...contextArgs);
            if (contextArgs[0] === "2d" && context) {
              context.setTransform(SOCIAL_EXPORT_SCALE, 0, 0, SOCIAL_EXPORT_SCALE, 0, 0);
              context.imageSmoothingEnabled = true;
              context.imageSmoothingQuality = "high";
            }
            return context;
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
  };

  try {
    return await renderer(report);
  } finally {
    document.createElement = originalCreateElement;
  }
}

async function overlayCompanyLogo(blob, logoUrl) {
  const [baseImage, logoImage] = await Promise.all([loadImage(URL.createObjectURL(blob), true), loadImage(logoUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = SOCIAL_EXPORT_PIXEL_WIDTH;
  canvas.height = SOCIAL_EXPORT_PIXEL_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(baseImage.image, 0, 0, canvas.width, canvas.height);

  const size = 112 * SOCIAL_EXPORT_SCALE;
  const x = 54 * SOCIAL_EXPORT_SCALE;
  const y = 108 * SOCIAL_EXPORT_SCALE;
  const radius = 20 * SOCIAL_EXPORT_SCALE;
  roundedRect(ctx, x, y, size, size, radius);
  ctx.fillStyle = "#0b101a";
  ctx.fill();
  ctx.strokeStyle = "#344156";
  ctx.lineWidth = 2 * SOCIAL_EXPORT_SCALE;
  ctx.stroke();

  const pad = 12 * SOCIAL_EXPORT_SCALE;
  ctx.save();
  roundedRect(ctx, x + pad, y + pad, size - pad * 2, size - pad * 2, 14 * SOCIAL_EXPORT_SCALE);
  ctx.clip();
  drawContain(ctx, logoImage.image, x + pad, y + pad, size - pad * 2, size - pad * 2);
  ctx.restore();

  baseImage.revoke?.();
  return new Promise((resolve, reject) => canvas.toBlob((out) => out ? resolve(out) : reject(new Error("تعذر إضافة شعار الشركة.")), "image/png", 1));
}

function loadImage(src, revoke = false) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, revoke: revoke ? () => URL.revokeObjectURL(src) : null });
    image.onerror = () => { if (revoke) URL.revokeObjectURL(src); reject(new Error("تعذر تحميل شعار الشركة.")); };
    image.src = src;
  });
}

function drawContain(ctx, image, x, y, w, h) {
  const ratio = Math.min(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * ratio;
  const dh = image.naturalHeight * ratio;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function deliver(blob, fileName, title) {
  const file = typeof File !== "undefined" ? new File([blob], fileName, { type: "image/png" }) : null;
  if (file && navigator.share) {
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] });
        return;
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
  setTimeout(() => URL.revokeObjectURL(url), 2500);
}

function toast(message, tone) {
  document.querySelector(".franklin-social-export-toast")?.remove();
  const node = document.createElement("div");
  node.className = `franklin-social-export-toast ${tone || ""}`;
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function filePart(value) {
  return String(value || "franklin").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "franklin";
}

function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install = () => {
    if (window.__equityResearchStore) installSocialImageExportQualityPatch(window.__equityResearchStore, document.getElementById("app"));
  };
  if (window.__equityResearchStore) install();
  else window.addEventListener("franklin:boot-ready", install, { once: true });
}

autoInstall();
