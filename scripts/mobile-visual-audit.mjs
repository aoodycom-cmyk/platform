import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL || 'http://127.0.0.1:4321/';
const outDir = process.env.AUDIT_OUT || 'visual-audit';
await fs.mkdir(outDir, { recursive: true });

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
const consoleErrors = [];
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__equityResearchStore), null, { timeout: 15000 });

await page.evaluate(async () => {
  const store = window.__equityResearchStore;
  store.loadDemoExternalAnalysis?.();
  await new Promise(r => setTimeout(r, 150));
  const selection = store.state.externalReportSelection || {};
  const ticker = selection.ticker;
  const reports = [...(store.state.externalAnalyses?.[ticker] || [])];
  const index = reports.findIndex(r => r.id === selection.reportId);
  if (index >= 0) {
    const r = structuredClone(reports[index]);
    r.companyProfile = r.companyProfile || {
      overview: 'شركة تقنية تجريبية متخصصة في أشباه الموصلات والبنية التحتية للحوسبة.',
      whatCompanyDoes: 'تصمم وتبيع أنظمة وتقنيات متقدمة لعملاء المؤسسات ومراكز البيانات.',
      howCompanyMakesMoney: 'تولد الإيرادات من بيع الأنظمة والعقود والخدمات المتكررة.',
      businessModel: 'Hardware, software and recurring services.',
      revenueModel: 'Product sales and recurring contracts.',
      competitivePosition: 'Scaled technology platform with differentiated engineering.',
      customers: 'Enterprise and data-center customers.',
      keySegments: ['Systems', 'Services']
    };
    reports[index] = r;
    store.set({ externalAnalyses: { ...store.state.externalAnalyses, [ticker]: reports } });
  }
  store.openExternalReport?.(ticker, selection.reportId || 'latest');
});

await page.waitForTimeout(600);

const tabs = [
  ['summary','summary'],
  ['earnings','earnings'],
  ['company','company'],
  ['strengths','strengths-risks']
];

const report = { viewport: { width: 390, height: 844 }, pages: {}, consoleErrors };

for (const [tab, key] of tabs) {
  const button = page.locator(`[data-stock-page="${tab}"]`);
  if (await button.count()) {
    if (!(await button.isDisabled())) {
      await button.click();
      await page.waitForTimeout(500);
    }
  } else if (tab === 'summary') {
    // already on summary
  }
  await page.screenshot({ path: `${outDir}/${key}.png`, fullPage: true });
  report.pages[key] = await page.evaluate(() => {
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x:+r.x.toFixed(1), y:+r.y.toFixed(1), width:+r.width.toFixed(1), height:+r.height.toFixed(1) };
    };
    const css = el => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return { fontSize:s.fontSize, fontWeight:s.fontWeight, color:s.color, backgroundColor:s.backgroundColor, padding:s.padding };
    };
    const shared = document.querySelector('.franklin-shared-stock-header');
    const nav = document.querySelector('.franklin-stock-page-nav');
    const native = document.querySelector('.mobile-app-frame > .mobile-app-header:not(.franklin-shared-stock-header)');
    const content = document.querySelector('.mobile-page-content');
    const activeTab = document.querySelector('.franklin-stock-page-tabs button.active');
    const bodyWidth = document.documentElement.scrollWidth;
    return {
      activePanel: window.__equityResearchStore?.state?.activePanel,
      sharedHeader: { rect: rect(shared), css: css(shared), text: shared?.innerText?.trim()?.slice(0,240) || '' },
      nav: { rect: rect(nav), css: css(nav), text: nav?.innerText?.trim()?.slice(0,240) || '' },
      nativeHeaderDisplay: native ? getComputedStyle(native).display : null,
      activeTab: activeTab?.textContent?.trim() || null,
      contentRect: rect(content),
      horizontalOverflowPx: Math.max(0, bodyWidth - innerWidth),
      bodyScrollHeight: document.documentElement.scrollHeight,
      visibleBottomNav: [...document.querySelectorAll('.mobile-bottom-nav')].some(el => getComputedStyle(el).display !== 'none'),
      titleSamples: [...document.querySelectorAll('h1,h2,h3')].slice(0,8).map(el => ({ text:el.textContent.trim().slice(0,90), fontSize:getComputedStyle(el).fontSize, rect:rect(el) }))
    };
  });
}

await fs.writeFile(`${outDir}/audit.json`, JSON.stringify(report, null, 2));
console.log('FRANKLIN_VISUAL_AUDIT=' + JSON.stringify(report));
await browser.close();
