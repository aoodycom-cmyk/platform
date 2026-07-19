const GITHUB_PAGES_HOST = "aoodycom-cmyk.github.io";

export function apiUrl(pathname) {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const configured = normalizeBackendUrl(globalThis.FRANKLIN_BACKEND_URL);
  if (configured) return `${configured}${cleanPath}`;
  return cleanPath;
}

export function isBackendConfigured() {
  return Boolean(normalizeBackendUrl(globalThis.FRANKLIN_BACKEND_URL)) || globalThis.location?.hostname !== GITHUB_PAGES_HOST;
}

function normalizeBackendUrl(value) {
  const clean = String(value || "").trim().replace(/\/+$/, "");
  if (!clean || clean.includes("YOUR-") || clean.includes("replace_")) return "";
  try {
    const url = new URL(clean);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return "";
    return url.origin;
  } catch {
    return "";
  }
}
