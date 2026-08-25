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
      const blob = await renderAtNativeScale(renderer, report);
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
