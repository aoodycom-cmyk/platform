const CACHE_NAME = "franklin-research-v10-static";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./src/main.js",
  "./src/pwa.js",
  "./assets/app-icon.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./docs/investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.md",
  "./docs/investment_analyst_brain_v1/01_COMPANY_CLASSIFICATION.md",
  "./docs/investment_analyst_brain_v1/02_BUSINESS_QUALITY.md",
  "./docs/investment_analyst_brain_v1/03_VALUATION_MODEL_SELECTION.md",
  "./docs/investment_analyst_brain_v1/04_FORECAST_POLICY.md",
  "./docs/investment_analyst_brain_v1/05_WACC_POLICY.md",
  "./docs/investment_analyst_brain_v1/06_SCENARIO_POLICY.md",
  "./docs/investment_analyst_brain_v1/07_FAIR_VALUE_POLICY.md",
  "./docs/investment_analyst_brain_v1/08_RECOMMENDATION_POLICY.md",
  "./docs/investment_analyst_brain_v1/09_MONITORING_POLICY.md",
  "./docs/investment_analyst_brain_v1/10_REPORT_TEMPLATE.md",
  "./docs/investment_analyst_brain_v1/11_OUTPUT_SCHEMA.json",
  "./docs/investment_analyst_brain_v1/12_MASTER_ANALYST_PROMPT.md"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("./offline.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && isSafeStaticAsset(url)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

function isSafeStaticAsset(url) {
  return [
    ".html",
    ".css",
    ".js",
    ".json",
    ".webmanifest",
    ".png",
    ".svg"
  ].some((extension) => url.pathname.endsWith(extension));
}
