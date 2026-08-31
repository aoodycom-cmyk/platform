import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL || 'http://127.0.0.1:4321/';
const outDir = process.env.AUDIT_OUT || 'visual-audit-v63';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'dark', locale: 'ar-SA' });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__equityResearchStore), null, { timeout: 15000 });

await page.evaluate(async () => {
  const s = window.__equityResearchStore;
  s.loadDemoExternalAnalysis?.();
  await new Promise(r => setTimeout(r, 200));
  const q = s.state.externalReportSelection || {};
  const t = q.ticker;
  const reports = [...(s.state.externalAnalyses?.[t] || [])];
  const i = reports.findIndex(r => r.id === q.reportId);
  if (i >= 0) {
    const r = structuredClone(reports[i]);
    r.companyProfile = r.companyProfile || {
      overview: 'شركة تقنية تجريبية.', whatCompanyDoes: 'تصمم أنظمة متقدمة.', howCompanyMakesMoney: 'تولد الإيرادات من المنتجات والخدمات.',
      businessModel: 'Hardware, software and recurring services.', revenueModel: 'Product sales and recurring contracts.', competitivePosition: 'Scaled technology platform.',
      customers: 'Enterprise and data-center customers.', keySegments: ['Systems','Services']
    };
    reports[i] = r;
    s.set({ externalAnalyses: { ...s.state.externalAnalyses, [t]: reports } });
  }
  s.openExternalReport?.(t, q.reportId || 'latest');
});
await page.waitForTimeout(800);

const report = { viewport: { width: 390, height: 844 }, pages: {}, controls: {}, consoleErrors };
const stockTabs = [['summary','summary'], ['earnings','earnings'], ['company','company'], ['strengths','strengths-risks']];
for (const [tab,key] of stockTabs) {
  await page.evaluate(tab => {
    const s = window.__equityResearchStore, q = s.state.externalReportSelection || {}, c = s.state.quarterlyScorecard || {};
    const t = q.ticker || c.originTicker || c.ticker, id = q.reportId || c.originReportId || 'latest';
    if (tab === 'summary') s.openExternalReport?.(t,id);
    if (tab === 'earnings') s.openQuarterlyScorecard?.(t,id);
    if (tab === 'company') s.openCompanyProfile?.(t,id);
    if (tab === 'strengths') s.set?.({ activePanel:'strengths-risks', notice:'' });
  }, tab);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/${key}.png`, fullPage: true });
  report.pages[key] = await page.evaluate(() => {
    const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x:+r.x.toFixed(1), y:+r.y.toFixed(1), width:+r.width.toFixed(1), height:+r.height.toFixed(1) }; };
    const cs = e => e ? getComputedStyle(e) : null;
    const shared = document.querySelector('.franklin-shared-stock-header');
    const nav = document.querySelector('.franklin-stock-page-nav');
    const content = document.querySelector('.mobile-page-content');
    const bodySample = content?.querySelector('p,li,td');
    const h1 = content?.querySelector('h1'); const h2 = content?.querySelector('h2'); const h3 = content?.querySelector('h3');
    const visibleButtons = [...(content?.querySelectorAll('button') || [])].filter(e => cs(e)?.display !== 'none' && rect(e)?.width > 0).slice(0, 12).map(e => ({ text:(e.textContent||'').trim().replace(/\s+/g,' ').slice(0,60), class:e.className, action:e.dataset.action||null, panel:e.dataset.panel||null, rect:rect(e) }));
    return {
      activePanel: window.__equityResearchStore?.state?.activePanel,
      header: rect(shared), nav: rect(nav), content: rect(content), horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth-innerWidth),
      fonts: { body: cs(bodySample)?.fontSize || null, h1: cs(h1)?.fontSize || null, h2: cs(h2)?.fontSize || null, h3: cs(h3)?.fontSize || null },
      colors: { bodyBg: cs(document.body)?.backgroundColor, frameBg: cs(document.querySelector('.mobile-app-frame'))?.backgroundColor, contentBg: cs(content)?.backgroundColor },
      bottomNavVisible: [...document.querySelectorAll('.mobile-bottom-nav,.mobile-nav')].some(e => cs(e)?.display !== 'none' && rect(e)?.width > 0),
      visibleButtons
    };
  });
}

await page.evaluate(() => { const s=window.__equityResearchStore,q=s.state.externalReportSelection||{}; s.openExternalReport?.(q.ticker,q.reportId||'latest'); });
await page.waitForTimeout(600);
await page.click('[data-stock-back]'); await page.waitForTimeout(300);
report.controls.backWorks = await page.evaluate(() => window.__equityResearchStore?.state?.activePanel === 'home');
await page.evaluate(() => { const s=window.__equityResearchStore; const all=Object.values(s.state.externalAnalyses||{}).flat(); const r=all[0]; if(r) s.openExternalReport?.(r.company?.ticker,r.id||'latest'); });
await page.waitForTimeout(600);
await page.click('.franklin-stock-menu summary');
report.controls.menuOpens = await page.evaluate(() => Boolean(document.querySelector('.franklin-stock-menu')?.open));

await page.evaluate(() => window.__equityResearchStore?.set?.({ activePanel:'social-export', notice:'' }));
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/export.png`, fullPage: true });
report.pages.export = await page.evaluate(() => {
  const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return{x:+r.x.toFixed(1),y:+r.y.toFixed(1),width:+r.width.toFixed(1),height:+r.height.toFixed(1)}};
  const cs=e=>e?getComputedStyle(e):null; const content=document.querySelector('.mobile-page-content'); const exp=document.querySelector('.social-export-page');
  return { activePanel:window.__equityResearchStore?.state?.activePanel, content:rect(content), exportRect:rect(exp), colors:{bodyBg:cs(document.body)?.backgroundColor,frameBg:cs(document.querySelector('.mobile-app-frame'))?.backgroundColor,exportBg:cs(exp)?.backgroundColor}, horizontalOverflowPx:Math.max(0,document.documentElement.scrollWidth-innerWidth) };
});

await fs.writeFile(`${outDir}/audit.json`, JSON.stringify(report,null,2));
console.log('FRANKLIN_VISUAL_AUDIT='+JSON.stringify(report));
await browser.close();
