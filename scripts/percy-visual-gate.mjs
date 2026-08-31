import { chromium } from 'playwright';
import percySnapshot from '@percy/playwright';

const BASE_URL = process.env.FRANKLIN_AUDIT_URL || 'http://127.0.0.1:4321/';
const widths = [390, 393, 430];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  locale: 'ar-SA'
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });

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
  store.openExternalReport?.(ticker, reportId);
});
await page.waitForTimeout(700);

const captures = [
  ['Summary', async () => navigate('summary')],
  ['Earnings', async () => navigate('earnings')],
  ['Company', async () => navigate('company')],
  ['Strengths Risks', async () => navigate('strengths')]
];

const measurements = {};
for (const [name, open] of captures) {
  await open();
  await page.waitForTimeout(650);
  measurements[name] = await measureStockPage();
  await percySnapshot(page, `Franklin · ${name}`, { widths, minHeight: 844 });
}

await page.evaluate(() => window.__equityResearchStore?.set?.({ activePanel: 'social-export', notice: '' }));
await page.waitForTimeout(650);
const exportMetrics = await page.evaluate(() => {
  const el = document.querySelector('.panel-social-export, .social-export-page, .mobile-page-content');
  const body = getComputedStyle(document.body);
  const style = el ? getComputedStyle(el) : null;
  return {
    found: Boolean(el),
    background: style?.backgroundColor || null,
    bodyBackground: body.backgroundColor,
    overflow: Math.max(0, document.documentElement.scrollWidth - innerWidth)
  };
});
await percySnapshot(page, 'Franklin · Export', { widths, minHeight: 844 });

const failures = [];
const stock = Object.values(measurements);
if (stock.length) {
  const reference = stock[0];
  for (const [name, m] of Object.entries(measurements)) {
    if (!m.sharedHeader || !m.nav) failures.push(`${name}: missing shared stock header or tab rail`);
    if (m.horizontalOverflow > 0) failures.push(`${name}: horizontal overflow ${m.horizontalOverflow}px`);
    if (m.bottomNavVisible) failures.push(`${name}: bottom navigation is visible inside stock workspace`);
    if (reference.sharedHeader && m.sharedHeader && Math.abs(reference.sharedHeader.height - m.sharedHeader.height) > 1) failures.push(`${name}: header height ${m.sharedHeader.height}px differs from Summary ${reference.sharedHeader.height}px`);
    if (reference.nav && m.nav && Math.abs(reference.nav.height - m.nav.height) > 1) failures.push(`${name}: tab rail height ${m.nav.height}px differs from Summary ${reference.nav.height}px`);
    if (reference.fontFamily && m.fontFamily && reference.fontFamily !== m.fontFamily) failures.push(`${name}: font family differs from Summary`);
    if (reference.pageBackground && m.pageBackground && reference.pageBackground !== m.pageBackground) failures.push(`${name}: page background differs from Summary (${m.pageBackground} vs ${reference.pageBackground})`);
  }
}
if (!exportMetrics.found) failures.push('Export: page root not found');
if (exportMetrics.overflow > 0) failures.push(`Export: horizontal overflow ${exportMetrics.overflow}px`);
if (exportMetrics.background && exportMetrics.bodyBackground && exportMetrics.background !== exportMetrics.bodyBackground) failures.push(`Export: background differs from app background (${exportMetrics.background} vs ${exportMetrics.bodyBackground})`);
if (errors.length) failures.push(...errors.slice(0, 10));

console.log('FRANKLIN_VISUAL_MEASUREMENTS=' + JSON.stringify({ measurements, exportMetrics, errors }, null, 2));
if (failures.length) {
  console.error('\nFRANKLIN VISUAL QUALITY GATE FAILED');
  failures.forEach(failure => console.error(`- ${failure}`));
  await browser.close();
  process.exit(1);
}
console.log('FRANKLIN VISUAL QUALITY GATE PASSED');
await browser.close();

async function navigate(tab) {
  await page.evaluate(tab => {
    const store = window.__equityResearchStore;
    const selection = store.state.externalReportSelection || {};
    const scorecard = store.state.quarterlyScorecard || {};
    const ticker = selection.ticker || scorecard.originTicker || scorecard.ticker;
    const reportId = selection.reportId || scorecard.originReportId || 'latest';
    if (tab === 'summary') store.openExternalReport?.(ticker, reportId);
    if (tab === 'earnings') store.openQuarterlyScorecard?.(ticker, reportId);
    if (tab === 'company') store.openCompanyProfile?.(ticker, reportId);
    if (tab === 'strengths') store.set?.({ activePanel: 'strengths-risks', notice: '' });
  }, tab);
}

async function measureStockPage() {
  return page.evaluate(() => {
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), width: +r.width.toFixed(1), height: +r.height.toFixed(1) };
    };
    const header = document.querySelector('.franklin-shared-stock-header');
    const nav = document.querySelector('.franklin-stock-page-nav');
    const content = document.querySelector('.mobile-page-content');
    const bottomNav = [...document.querySelectorAll('.mobile-bottom-nav,.mobile-nav')].find(el => getComputedStyle(el).display !== 'none');
    const contentStyle = content ? getComputedStyle(content) : null;
    return {
      activePanel: window.__equityResearchStore?.state?.activePanel,
      sharedHeader: rect(header),
      nav: rect(nav),
      content: rect(content),
      horizontalOverflow: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      bottomNavVisible: Boolean(bottomNav),
      fontFamily: contentStyle?.fontFamily || null,
      fontSize: contentStyle?.fontSize || null,
      pageBackground: getComputedStyle(document.body).backgroundColor
    };
  });
}
