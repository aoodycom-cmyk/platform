import { chromium } from 'playwright';
import percySnapshot from '@percy/playwright';

const BASE_URL = process.env.FRANKLIN_AUDIT_URL || 'http://127.0.0.1:4321/';
const viewports = [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 430, height: 932 }
];
const widths = viewports.map(({ width }) => width);
const globalCaptures = [
  ['Library', 'home'],
  ['Export', 'social-export'],
  ['History', 'history'],
  ['Settings', 'settings'],
  ['Import', 'external-import']
];
const stockCaptures = [
  ['Summary', 'summary'],
  ['Earnings', 'earnings'],
  ['Company', 'company'],
  ['Strengths Risks', 'strengths']
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: viewports[0],
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  locale: 'ar-SA'
});
const page = await context.newPage();
const pageErrors = [];
const criticalResourceFailures = [];
page.on('pageerror', error => pageErrors.push(`pageerror: ${error.message}`));
page.on('response', response => {
  if (response.status() < 400) return;
  const url = response.url();
  if (/\.(?:js|css)(?:\?|$)/i.test(url)) criticalResourceFailures.push(`${response.status()} ${url}`);
});

await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__equityResearchStore), null, { timeout: 15000 });

await page.evaluate(async () => {
  const store = window.__equityResearchStore;
  store.loadDemoExternalAnalysis?.();
  await new Promise(resolve => setTimeout(resolve, 150));
  const selection = store.state.externalReportSelection || {};
  const ticker = selection.ticker || Object.keys(store.state.externalAnalyses || {})[0];
  const reports = [...(store.state.externalAnalyses?.[ticker] || [])];
  const reportId = selection.reportId || reports[0]?.id || 'latest';
  const index = reports.findIndex(report => report.id === reportId);
  if (index >= 0 && !reports[index].companyProfile) {
    const report = structuredClone(reports[index]);
    report.companyProfile = {
      overview: 'شركة تقنية تجريبية.',
      whatCompanyDoes: 'تصمم أنظمة ومنتجات متقدمة.',
      howCompanyMakesMoney: 'تحقق الإيرادات من المنتجات والخدمات والعقود.',
      businessModel: 'Hardware, software and recurring services.',
      revenueModel: 'Product sales and recurring contracts.',
      competitivePosition: 'Scaled technology platform.',
      customers: 'Enterprise and institutional customers.',
      keySegments: ['Systems', 'Services']
    };
    reports[index] = report;
    store.set({ externalAnalyses: { ...store.state.externalAnalyses, [ticker]: reports } });
  }
  store.set?.({ activePanel: 'home', notice: '' });
});
await settle();

const globalMeasurements = {};
for (const [name, panel] of globalCaptures) {
  await navigateApp(panel);
  await settle();
  globalMeasurements[name] = await measureGlobalPage();
  await percySnapshot(page, `Franklin · ${name}`, { widths, minHeight: 844 });
}

const stockMeasurements = {};
for (const [name, tab] of stockCaptures) {
  await navigateStock(tab);
  await settle();
  stockMeasurements[name] = await measureStockPage();
  await percySnapshot(page, `Franklin · ${name}`, { widths, minHeight: 844 });
}

const responsiveMeasurements = { global: {}, stock: {} };
for (const viewport of viewports) {
  await page.setViewportSize(viewport);
  for (const [name, panel] of globalCaptures) {
    await navigateApp(panel);
    await settle(120);
    responsiveMeasurements.global[`${name}@${viewport.width}`] = await measureGlobalPage();
  }
  for (const [name, tab] of stockCaptures) {
    await navigateStock(tab);
    await settle(120);
    responsiveMeasurements.stock[`${name}@${viewport.width}`] = await measureStockPage();
  }
}

const failures = [];
validateGlobalPages(globalMeasurements, failures);
validateStockPages(stockMeasurements, failures);

for (const viewport of viewports) {
  const globalAtWidth = Object.fromEntries(globalCaptures.map(([name]) => [name, responsiveMeasurements.global[`${name}@${viewport.width}`]]));
  const stockAtWidth = Object.fromEntries(stockCaptures.map(([name]) => [name, responsiveMeasurements.stock[`${name}@${viewport.width}`]]));
  validateGlobalPages(globalAtWidth, failures, `@${viewport.width}`);
  validateStockPages(stockAtWidth, failures, `@${viewport.width}`);
}

failures.push(...pageErrors.slice(0, 10));
failures.push(...criticalResourceFailures.slice(0, 10).map(item => `critical resource: ${item}`));

console.log('FRANKLIN_VISUAL_MEASUREMENTS=' + JSON.stringify({
  globalMeasurements,
  stockMeasurements,
  responsiveMeasurements,
  pageErrors,
  criticalResourceFailures
}, null, 2));

if (failures.length) {
  console.error('\nFRANKLIN VISUAL QUALITY GATE FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  await browser.close();
  process.exit(1);
}

console.log('FRANKLIN VISUAL QUALITY GATE PASSED');
await browser.close();

async function settle(delay = 350) {
  await page.waitForTimeout(delay);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function navigateApp(panel) {
  await page.evaluate(panel => {
    const store = window.__equityResearchStore;
    if (panel === 'external-import') {
      store.openExternalImport?.();
      if (store.state.activePanel !== 'external-import') store.set?.({ activePanel: 'external-import', notice: '' });
      return;
    }
    store.set?.({ activePanel: panel, notice: '' });
  }, panel);
}

async function navigateStock(tab) {
  await page.evaluate(tab => {
    const store = window.__equityResearchStore;
    const selection = store.state.externalReportSelection || {};
    const scorecard = store.state.quarterlyScorecard || {};
    const ticker = selection.ticker || scorecard.originTicker || scorecard.ticker || Object.keys(store.state.externalAnalyses || {})[0];
    const reports = store.state.externalAnalyses?.[ticker] || [];
    const reportId = selection.reportId || scorecard.originReportId || reports[0]?.id || 'latest';
    if (tab === 'summary') store.openExternalReport?.(ticker, reportId);
    if (tab === 'earnings') store.openQuarterlyScorecard?.(ticker, reportId);
    if (tab === 'company') store.openCompanyProfile?.(ticker, reportId);
    if (tab === 'strengths') {
      store.openExternalReport?.(ticker, reportId);
      store.set?.({ activePanel: 'strengths-risks', notice: '' });
    }
  }, tab);
}

async function measureGlobalPage() {
  return page.evaluate(() => {
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { x: round(value.x), y: round(value.y), width: round(value.width), height: round(value.height) };
    };
    const font = element => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        size: parseFloat(style.fontSize),
        weight: style.fontWeight,
        lineHeight: style.lineHeight,
        family: style.fontFamily
      };
    };
    const visible = element => element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().height > 0;
    const header = document.querySelector('.global-app-header');
    const frame = document.querySelector('.mobile-app-frame');
    const content = document.querySelector('.mobile-page-content');
    const brand = header?.querySelector('.mobile-brand');
    const logo = header?.querySelector('.company-logo.app-logo');
    const controls = [...(header?.querySelectorAll('.header-icon-button,.mobile-app-menu > summary,.v31-library-sort') || [])].filter(visible);
    const heading = [...document.querySelectorAll('.mobile-page-content h1,.mobile-page-content h2,.franklin-social-export-heading strong')].find(visible);
    const bodyCopy = [...document.querySelectorAll('.mobile-page-content p')].find(visible);
    const metadata = [...document.querySelectorAll('.mobile-page-content small,.mobile-page-content .eyebrow')].find(visible);
    const cloudTrigger = document.querySelector('.franklin-cloud-trigger');
    const bottomNav = [...document.querySelectorAll('.mobile-bottom-nav,.mobile-nav')].find(visible);
    const cloudRect = visible(cloudTrigger) ? cloudTrigger.getBoundingClientRect() : null;
    const navRect = bottomNav?.getBoundingClientRect();
    return {
      activePanel: window.__equityResearchStore?.state?.activePanel,
      header: rect(header),
      frame: rect(frame),
      content: rect(content),
      contentPadding: content ? { left: parseFloat(getComputedStyle(content).paddingLeft), right: parseFloat(getComputedStyle(content).paddingRight) } : null,
      logo: rect(logo),
      logoFilter: logo ? getComputedStyle(logo).filter : null,
      brandDirectChildren: brand?.children.length ?? 0,
      controlHeights: controls.map(control => round(control.getBoundingClientRect().height)),
      typography: {
        heading: font(heading),
        body: font(bodyCopy),
        metadata: font(metadata)
      },
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      cloudNavOverlap: cloudRect && navRect ? Math.max(0, round(cloudRect.bottom - navRect.top)) : 0,
      pageBackground: frame ? getComputedStyle(frame).backgroundColor : null,
      bodyBackground: getComputedStyle(document.body).backgroundColor
    };

    function round(value) {
      return +value.toFixed(1);
    }
  });
}

async function measureStockPage() {
  return page.evaluate(() => {
    const rect = element => {
      if (!element) return null;
      const value = element.getBoundingClientRect();
      return { x: round(value.x), y: round(value.y), width: round(value.width), height: round(value.height) };
    };
    const font = element => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        size: parseFloat(style.fontSize),
        weight: style.fontWeight,
        lineHeight: style.lineHeight,
        family: style.fontFamily
      };
    };
    const visible = element => element && getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().height > 0;
    const firstVisible = selector => [...document.querySelectorAll(selector)].find(visible);
    const header = document.querySelector('.franklin-shared-stock-header');
    const nav = document.querySelector('.franklin-stock-page-nav');
    const content = document.querySelector('.mobile-page-content');
    const companyLogo = header?.querySelector('.report-company-logo');
    const controls = [...(header?.querySelectorAll('.header-icon-button,.mobile-app-menu > summary') || [])].filter(visible);
    const bottomNav = [...document.querySelectorAll('.mobile-bottom-nav,.mobile-nav')].find(visible);
    return {
      activePanel: window.__equityResearchStore?.state?.activePanel,
      sharedHeader: rect(header),
      nav: rect(nav),
      content: rect(content),
      contentPadding: content ? { left: parseFloat(getComputedStyle(content).paddingLeft), right: parseFloat(getComputedStyle(content).paddingRight) } : null,
      companyLogo: rect(companyLogo),
      controlHeights: controls.map(control => round(control.getBoundingClientRect().height)),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      bottomNavVisible: Boolean(bottomNav),
      pageBackground: getComputedStyle(document.body).backgroundColor,
      typography: {
        companyName: font(header?.querySelector('.report-app-identity-copy strong')),
        tab: font(firstVisible('.franklin-stock-page-tabs button')),
        heroValue: font(firstVisible('.v31-current-price-hero > strong')),
        h1: font(firstVisible('.mobile-page-content h1')),
        h2: font(firstVisible('.mobile-page-content h2')),
        h3: font(firstVisible('.mobile-page-content h3')),
        body: font(firstVisible('.stock-report-section p,.stock-report-section li,.investment-summary-workspace > p,.fet-quarter-context')),
        table: font(firstVisible('.fet-table td,.fet-table th'))
      }
    };

    function round(value) {
      return +value.toFixed(1);
    }
  });
}

function validateGlobalPages(measurements, failures, suffix = '') {
  const reference = measurements.Library;
  if (!reference?.header || !reference?.content) {
    failures.push(`Library${suffix}: missing global header or content`);
    return;
  }
  for (const [name, value] of Object.entries(measurements)) {
    const label = `${name}${suffix}`;
    if (!value?.header || !value?.content) {
      failures.push(`${label}: missing global header or content`);
      continue;
    }
    if (value.horizontalOverflow > 0) failures.push(`${label}: horizontal overflow ${value.horizontalOverflow}px`);
    if (Math.abs(reference.header.height - value.header.height) > 1) failures.push(`${label}: header height ${value.header.height}px differs from Library ${reference.header.height}px`);
    if (value.header.height < 76 || value.header.height > 84) failures.push(`${label}: branded header must remain 76–84px tall`);
    if (Math.abs(reference.content.x - value.content.x) > 1 || Math.abs(reference.content.width - value.content.width) > 1) failures.push(`${label}: content geometry differs from Library`);
    if (Math.abs(value.content.x + value.contentPadding.left - 16) > 1 || Math.abs(value.content.width - value.contentPadding.left - value.contentPadding.right - (value.frame.width - 32)) > 1) failures.push(`${label}: content must retain 16px horizontal padding`);
    if (value.brandDirectChildren !== 2) failures.push(`${label}: global brand must contain the Franklin mark and wordmark`);
    if (!value.logo || value.logo.width < 34 || value.logo.width > 42.5) failures.push(`${label}: Franklin mark width must remain 34–42px`);
    if (!value.logoFilter || value.logoFilter === 'none') failures.push(`${label}: Franklin mark is not using its monochrome treatment`);
    if (value.controlHeights.some(height => height < 44 || height > 48.5)) failures.push(`${label}: header controls must retain a 44px touch target`);
    if (value.cloudNavOverlap > 0) failures.push(`${label}: Cloud control overlaps bottom navigation by ${value.cloudNavOverlap}px`);
    if (value.typography.heading?.size < 22 || value.typography.heading?.size > 27.5) failures.push(`${label}: page heading must remain 22–27px`);
    if (value.typography.metadata?.size < 12) failures.push(`${label}: metadata must remain at least 12px`);
    if (value.pageBackground !== reference.pageBackground) failures.push(`${label}: page background differs from Library`);
  }
}

function validateStockPages(measurements, failures, suffix = '') {
  const reference = measurements.Summary;
  if (!reference?.sharedHeader || !reference?.nav || !reference?.content) {
    failures.push(`Summary${suffix}: missing shared stock header, tab rail, or content`);
    return;
  }
  for (const [name, value] of Object.entries(measurements)) {
    const label = `${name}${suffix}`;
    if (!value?.sharedHeader || !value?.nav || !value?.content) {
      failures.push(`${label}: missing shared stock header, tab rail, or content`);
      continue;
    }
    if (value.horizontalOverflow > 0) failures.push(`${label}: horizontal overflow ${value.horizontalOverflow}px`);
    if (value.bottomNavVisible) failures.push(`${label}: bottom navigation is visible inside stock workspace`);
    if (Math.abs(reference.sharedHeader.height - value.sharedHeader.height) > 1) failures.push(`${label}: header height differs from Summary`);
    if (Math.abs(reference.nav.height - value.nav.height) > 1) failures.push(`${label}: tab rail height differs from Summary`);
    if (Math.abs(reference.content.x - value.content.x) > 1 || Math.abs(reference.content.y - value.content.y) > 1 || Math.abs(reference.content.width - value.content.width) > 1) failures.push(`${label}: content geometry differs from Summary`);
    if (Math.abs(value.content.x + value.contentPadding.left - 16) > 1 || Math.abs(value.content.width - value.contentPadding.left - value.contentPadding.right - (value.sharedHeader.width - 32)) > 1) failures.push(`${label}: content must retain 16px horizontal padding`);
    if (value.sharedHeader.height < 76 || value.sharedHeader.height > 84) failures.push(`${label}: company header must remain 76–84px tall`);
    if (value.nav.height > 50) failures.push(`${label}: stock tab rail is too tall at ${value.nav.height}px`);
    if (!value.companyLogo || value.companyLogo.width < 34 || value.companyLogo.width > 38) failures.push(`${label}: company logo must remain compact`);
    if (value.controlHeights.some(height => height < 44 || height > 48.5)) failures.push(`${label}: stock header controls must retain a 44px touch target`);
    if (value.typography.companyName?.size > 16) failures.push(`${label}: company name exceeds 16px`);
    if (value.typography.tab?.size > 13.5) failures.push(`${label}: stock tab text exceeds 13.5px`);
    if (value.typography.heroValue?.size > 32.5) failures.push(`${label}: primary financial value exceeds 32px`);
    if (value.typography.h1?.size > 26.5) failures.push(`${label}: h1 exceeds 26px`);
    if (value.typography.h2?.size > 24.5) failures.push(`${label}: h2 exceeds 24px`);
    if (value.typography.body?.size < 14 || value.typography.body?.size > 16.5) failures.push(`${label}: body copy must remain 14–16px`);
    if (value.typography.tab?.family !== reference.typography.tab?.family) failures.push(`${label}: stock typography family differs from Summary`);
    if (value.pageBackground !== reference.pageBackground) failures.push(`${label}: page background differs from Summary`);
  }
}
