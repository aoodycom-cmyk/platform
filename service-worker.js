const CACHE_NAME = "franklin-research-v11-franklin-mobile-v2-v47";
const STATIC_ASSETS = [
  "./offline.html",
  "./rescue.html",
  "./backend-config.js",
  "./styles.css",
  "./styles-mobile2.css",
  "./styles-mobile-scorecard-figma.css",
  "./styles-quarterly-earnings-entry.css",
  "./styles-desktop.css",
  "./styles-premium.css",
  "./styles-v11-mobile-cleanup.css",
  "./styles-visual-system.css",
  "./styles-franklin-v2.css",
  "./styles-design-director-v45.css",
  "./styles-mobile-hotfix-v46.css",
  "./manifest.webmanifest",
  "./src/main.js",
  "./src/pwa.js",
  "./src/cloud/franklinCloud.js",
  "./src/financialSafety/financialSafety.js",
  "./src/financialSafety/quarterlySourceSafety.js",
  "./src/financialSafety/decisionReadinessUi.js",
  "./src/ui/foundation.js",
  "./src/ui/mobile2Enhancer.js",
  "./src/ui/quarterlyScorecardMobileFigma.js",
  "./src/ui/quarterlyEarningsEntry.js",
  "./src/ui/quarterlyEarningsJsonPromptV2.js",
  "./src/ui/quarterlyScorecardExport.js",
  "./src/ui/reportPresentationEditor.js",
  "./src/ui/clipboard.js",
  "./src/externalAnalysis/schema.js",
  "./src/externalAnalysis/requirements.js",
  "./src/externalAnalysis/historicalRequirements.js",
  "./src/externalAnalysis/earningsPeriod.js",
  "./src/externalAnalysis/quarterlyScorecard.js",
  "./src/externalAnalysis/quarterlyEarningsLite.js",
  "./src/externalAnalysis/quarterlyForwardOutlook.js",
  "./src/externalAnalysis/fairValueAdapter.js",
  "./src/externalAnalysis/v3Contract.js",
  "./src/externalAnalysis/v3Adapter.js",
  "./src/externalAnalysis/v3Validator.js",
  "./src/externalAnalysis/parser.js",
  "./src/externalAnalysis/externalAnalysisSchemaValidator.js",
  "./src/externalAnalysis/chatgptContract.js",
  "./src/externalAnalysis/storage.js",
  "./src/externalAnalysis/reportAdapter.js",
  "./src/externalAnalysis/backup.js",
  "./src/externalAnalysis/supplementSchema.js",
  "./src/externalAnalysis/supplementParser.js",
  "./src/externalAnalysis/supplementValidator.js",
  "./src/externalAnalysis/supplementMerge.js",
  "./src/externalAnalysis/missingFields.js",
  "./src/data/externalDemo.js",
  "./assets/app-icon.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./investment_analyst_brain_v1/00_METHODOLOGY_CONTRACT.md",
  "./investment_analyst_brain_v1/01_COMPANY_CLASSIFICATION.md",
  "./investment_analyst_brain_v1/02_BUSINESS_QUALITY.md",
  "./investment_analyst_brain_v1/03_VALUATION_MODEL_SELECTION.md",
  "./investment_analyst_brain_v1/04_FORECAST_POLICY.md",
  "./investment_analyst_brain_v1/05_WACC_POLICY.md",
  "./investment_analyst_brain_v1/06_SCENARIO_POLICY.md",
  "./investment_analyst_brain_v1/07_FAIR_VALUE_POLICY.md",
  "./investment_analyst_brain_v1/08_RECOMMENDATION_POLICY.md",
  "./investment_analyst_brain_v1/09_MONITORING_POLICY.md",
  "./investment_analyst_brain_v1/10_REPORT_TEMPLATE.md",
  "./investment_analyst_brain_v1/11_OUTPUT_SCHEMA.json",
  "./investment_analyst_brain_v1/12_MASTER_ANALYST_PROMPT.md"
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

  if (isVersionedAppAsset(url)) {
    event.respondWith(fetchAndCache(event.request, url).catch(() => caches.match(event.request)));
    return;
  }

  event.respondWith(caches.match(event.request).then((cached) => cached || fetchAndCache(event.request, url)));
});

function fetchAndCache(request, url) {
  return fetch(request).then((response) => {
    if (response.ok && isSafeStaticAsset(url)) {
      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return response;
  });
}

function isVersionedAppAsset(url) {
  return url.searchParams.has("v") || [".css", ".js"].some((extension) => url.pathname.endsWith(extension));
}

function isSafeStaticAsset(url) {
  return [
    ".css",
    ".js",
    ".json",
    ".webmanifest",
    ".png",
    ".svg"
  ].some((extension) => url.pathname.endsWith(extension));
}
