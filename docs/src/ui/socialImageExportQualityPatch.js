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
export const SOCIAL_EXPORT_HD_LABEL = `PNG · ${SOCIAL_EXPORT_PIXEL_WIDTH} × ${SOCIAL_EXPORT_PIXEL_HEIGHT} · HD`;

export function updateSocialExportHdLabel(root) {
  const label = root?.querySelector?.("[data-franklin-social-export-panel] .franklin-social-export-heading small");
  if (!label || label.textContent === SOCIAL_EXPORT_HD_LABEL) return false;
  label.textContent = SOCIAL_EXPORT_HD_LABEL;
  return true;
}

export function installSocialImageExportQualityPatch(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.socialImageQualityPatchInstalled === "true") return;
  root.dataset.socialImageQualityPatchInstalled = "true";

  const markHiRes = () => updateSocialExportHdLabel(root);
  markHiRes();
  const observer = new MutationObserver(markHiRes);
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-social-image-export]");
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const selection = store.state.externalReportSelection || {};
    const ticker = button.dataset.socialExportTicker || selection.ticker;
    const reportId = button.dataset.socialExportReportId || selection.reportId || "latest";
    const report = getExternalAnalysis(store.state.externalAnalyses || {}, ticker, reportId);
    if (!report) return toast("تعذر العثور على التقرير المحفوظ.", "error");

    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "جارٍ تجهيز صورة HD…";
    try {
      const renderer = button.dataset.socialImageExport === "investment"
        ? renderInvestmentInfographicPng
        : renderEarningsTrackerPng;
      let blob = await renderAtNativeScale(renderer, report);
      if (report.presentation?.companyLogoDataUrl) {
        blob = await overlayCompanyLogo(blob, report.presentation.companyLogoDataUrl);
      }
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

async function overlayCompanyLogo(blob, logoUrl) {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const [base, logo] = await Promise.all([loadImage(sourceUrl), loadImage(logoUrl)]);
    const canvas = document.createElement("canvas");
    canvas.width = SOCIAL_EXPORT_PIXEL_WIDTH;
    canvas.height = SOCIAL_EXPORT_PIXEL_HEIGHT;
    const context = canvas.getContext("2d");
    context.drawImage(base, 0, 0, canvas.width, canvas.height);

    const size = 196;
    const x = canvas.width - size - 72;
    const y = 72;
    context.save();
    roundedRect(context, x, y, size, size, 34);
    context.clip();
    context.fillStyle = "#f7f8fa";
    context.fillRect(x, y, size, size);
    const padding = 22;
    const scale = Math.min((size - padding * 2) / logo.naturalWidth, (size - padding * 2) / logo.naturalHeight);
    const width = logo.naturalWidth * scale;
    const height = logo.naturalHeight * scale;
    context.drawImage(logo, x + (size - width) / 2, y + (size - height) / 2, width, height);
    context.restore();
    return await canvasBlob(canvas);
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("تعذر تحميل شعار الشركة داخل صورة التقرير."));
    image.src = source;
  });
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error("تعذر إنشاء صورة التقرير.")),
    "image/png"
  ));
}

async function renderAtNativeScale(renderer, report) {
  return renderer(report, new Date(), { scale: SOCIAL_EXPORT_SCALE });
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
