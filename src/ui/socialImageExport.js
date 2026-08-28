import { getExternalAnalysis } from "../externalAnalysis/storage.js";

export const SOCIAL_EXPORT_WIDTH = 1080;
export const SOCIAL_EXPORT_HEIGHT = 1350;

const C = {
  bg: "#070a12",
  panel: "#0d111b",
  panel2: "#111827",
  border: "#29344a",
  text: "#f5f7fb",
  muted: "#9aa6ba",
  teal: "#2dd4bf",
  blue: "#6ea8ff",
  green: "#55d49b",
  amber: "#e7b65b",
  red: "#f17b89"
};

const STATUS_AR = {
  EXCEEDED: "تجاوز",
  PASSED: "تحقق",
  PARTIALLY_PASSED: "جزئي",
  FAILED: "فشل",
  NOT_REPORTED: "بانتظار الإعلان"
};

const ACTION_AR = {
  BUY: "شراء",
  ADD: "زيادة",
  HOLD: "احتفاظ",
  WATCH: "مراقبة",
  REDUCE: "تخفيف",
  SELL: "بيع"
};

export function buildInvestmentInfographicModel(report = {}) {
  const v3 = canonical(report);
  const identity = v3?.reportIdentity || {};
  const company = v3?.company || {};
  const fair = report.fairValueSummary || {};
  const current = v3?.valuation?.current || {};
  const decision = v3?.decision || report.decision || {};
  const profile = v3?.companyProfile || report.companyProfile || {};

  return {
    ticker: identity.ticker || report.company?.ticker || "—",
    companyName: identity.companyName || report.company?.name || "—",
    sector: company.sector || report.company?.sector || null,
    industry: company.industry || report.company?.industry || null,
    reportPeriod: report.reportPeriod || identityPeriod(identity),
    analysisDate: identity.analysisDate || report.analysisDate || null,
    currency: company.tradingCurrency || report.company?.currency || "USD",
    decision: upper(decision.action),
    decisionConfidence: num(decision.confidence),
    investmentScore: num(decision.investmentScore),
    marketPrice: num(v3?.marketPrice?.value ?? fair.currentPrice),
    bear: num(current.bear ?? fair.fairValueLow),
    base: num(current.base ?? fair.fairValueBase),
    bull: num(current.bull ?? fair.fairValueHigh),
    probabilityWeighted: num(current.probabilityWeighted ?? fair.probabilityWeightedFairValue),
    upsideToBasePct: num(v3?.valuation?.upsideToBasePct ?? fair.upsideDownsidePercent),
    marginOfSafetyPct: num(v3?.valuation?.marginOfSafetyPct ?? fair.marginOfSafetyPercent),
    companySummary: text(profile.summary),
    businessModel: text(profile.businessModel),
    latestQuarterSummary: text(v3?.latestQuarter?.summary),
    latestMetrics: latestMetrics(v3, report),
    strengths: narrative(v3?.strengths, report.quality?.strengths).slice(0, 3),
    risks: narrative(v3?.risks, report.risks).slice(0, 3),
    thesis: text(v3?.thesis?.updatedSummary || report.thesis?.fullSummary || report.thesis?.shortSummary),
    catalysts: narrative(v3?.catalysts, report.catalysts).slice(0, 3),
    sourceCount: Array.isArray(v3?.sources) ? v3.sources.length : Array.isArray(report.sources) ? report.sources.length : 0,
    dataQualityScore: num(v3?.dataQuality?.score)
  };
}

export function buildEarningsTrackerModel(report = {}) {
  const v3 = canonical(report);
  const evaluated = evaluatedRequirements(v3, report);
  const source = evaluated || openRequirements(v3, report);
  const targetQuarter = source?.targetQuarter || source?.earningsPeriod || report.reportPeriod || identityPeriod(v3?.reportIdentity || {}) || "—";
  const rows = Array.isArray(source?.requirements) ? source.requirements.slice(0, 8) : [];
  const isEvaluated = Boolean(evaluated);

  return {
    ticker: v3?.reportIdentity?.ticker || report.company?.ticker || "—",
    companyName: v3?.reportIdentity?.companyName || report.company?.name || "—",
    targetQuarter,
    reportPeriod: report.reportPeriod || identityPeriod(v3?.reportIdentity || {}),
    decision: upper(v3?.decision?.action || report.decision?.action),
    baseFairValue: num(v3?.valuation?.current?.base ?? report.fairValueSummary?.fairValueBase),
    marketPrice: num(v3?.marketPrice?.value ?? report.fairValueSummary?.currentPrice),
    mode: source?.mode || v3?.nextRequirements?.mode || report.priceTargetRequirements?.mode || null,
    targetValue: num(source?.targetValue ?? v3?.nextRequirements?.targetValue ?? report.priceTargetRequirements?.targetValue),
    targetScenario: source?.targetScenario || v3?.nextRequirements?.targetScenario || report.priceTargetRequirements?.targetScenario || null,
    isEvaluated,
    expectedSourceNote: "المتوقع = Consensus إن توفر، وإلا Guidance أو نطاق المتابعة الموثق.",
    rows: rows.map((item) => trackerRow(item, v3, report, targetQuarter, isEvaluated))
  };
}

export async function renderInvestmentInfographicPng(report, exportedAt = new Date()) {
  return renderPng((ctx) => drawInvestment(ctx, buildInvestmentInfographicModel(report), exportedAt));
}

export async function renderEarningsTrackerPng(report, exportedAt = new Date()) {
  return renderPng((ctx) => drawTracker(ctx, buildEarningsTrackerModel(report), exportedAt));
}

export async function exportInvestmentInfographicPng(report, exportedAt = new Date()) {
  const blob = await renderInvestmentInfographicPng(report, exportedAt);
  const ticker = filePart(report?.company?.ticker || canonical(report)?.reportIdentity?.ticker || "company");
  return deliver(blob, `franklin-${ticker}-investment-infographic.png`, `${ticker} — Franklin Investment Infographic`);
}

export async function exportEarningsTrackerPng(report, exportedAt = new Date()) {
  const blob = await renderEarningsTrackerPng(report, exportedAt);
  const ticker = filePart(report?.company?.ticker || canonical(report)?.reportIdentity?.ticker || "earnings");
  return deliver(blob, `franklin-${ticker}-earnings-tracker.png`, `${ticker} — Franklin Earnings Tracker`);
}

export function installSocialImageExport(store, root = document.getElementById("app")) {
  if (!store || !root || root.dataset.socialImageExportInstalled === "true") return;
  root.dataset.socialImageExportInstalled = "true";
  installStyles();

  const mount = () => mountPanel(store, root);
  store.subscribe?.(mount);
  mount();

  root.addEventListener("click", async (event) => {
    const button = event.target.closest?.("[data-social-image-export]");
    if (!button) return;
    const report = socialExportReport(store, button);
    if (!report) return toast("تعذر العثور على التقرير المحفوظ.", "error");

    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "جارٍ تجهيز الصورة…";
    try {
      if (button.dataset.socialImageExport === "investment") await exportInvestmentInfographicPng(report);
      else await exportEarningsTrackerPng(report);
      toast("الصورة جاهزة للمشاركة أو الحفظ.", "success");
    } catch (error) {
      if (error?.name !== "AbortError") toast(`تعذر التصدير: ${String(error?.message || error)}`, "error");
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}

function mountPanel(store, root) {
  root.querySelector(".franklin-social-export-panel")?.remove();
}

function socialExportReport(store, button) {
  const selection = store.state.externalReportSelection || {};
  const ticker = button.dataset.socialExportTicker || selection.ticker;
  const reportId = button.dataset.socialExportReportId || selection.reportId || "latest";
  return getExternalAnalysis(store.state.externalAnalyses || {}, ticker, reportId);
}

function autoInstall() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const install = () => {
    if (window.__equityResearchStore) installSocialImageExport(window.__equityResearchStore, document.getElementById("app"));
  };
  if (window.__equityResearchStore) install();
  else window.addEventListener("franklin:boot-ready", install, { once: true });
}

function latestMetrics(v3, report) {
  const m = v3?.latestQuarter?.coreMetrics || {};
  const f = report.financialHighlights || {};
  const core = [
    metric("Revenue", metricDisplay(m.revenue, f.revenue), m.revenue?.yoyPct),
    metric("EPS", metricDisplay(m.eps, f.epsReported), m.eps?.yoyPct),
    metric("Gross Margin", pct(m.grossMarginPct?.actualValue), null),
    metric("Operating Margin", pct(m.operatingMarginPct?.actualValue ?? f.operatingMarginPct), null),
    metric("FCF", metricDisplay(m.freeCashFlow, f.freeCashFlow), m.freeCashFlow?.yoyPct)
  ].filter((item) => item.value !== "—");
  const kpis = (v3?.latestQuarter?.companySpecificKpis || []).slice(0, 2).map((item) =>
    metric(item.arabicName || item.name || "KPI", item.actualDisplay || value(item.actualValue, item.unit), item.yoyPct)
  );
  return [...core, ...kpis].slice(0, 6);
}

function trackerRow(item, v3, report, targetQuarter, isEvaluated) {
  const status = isEvaluated ? upper(item?.status || "NOT_REPORTED") : "NOT_REPORTED";
  return {
    metric: text(item?.arabicName || item?.name || item?.metric || "مؤشر"),
    previous: item?.baselineDisplay || item?.previousDisplay || value(item?.baselineValue ?? item?.previousValue, item?.unit),
    expected: expected(item, v3, report, targetQuarter) || "—",
    target: item?.requiredDisplay || threshold(item),
    actual: isEvaluated ? item?.actualDisplay || value(item?.actualValue, item?.unit) : "بانتظار الإعلان",
    status,
    statusLabel: STATUS_AR[status] || status
  };
}

function expected(item, v3, report, targetQuarter) {
  const key = metricKey(item?.metric || item?.name || item?.arabicName);
  const core = v3?.latestQuarter?.coreMetrics || {};
  const coreMetric = key === "revenue" ? core.revenue : key === "eps" ? core.eps : key === "grossmargin" ? core.grossMarginPct : key === "operatingmargin" ? core.operatingMarginPct : key === "fcf" ? core.freeCashFlow : null;
  const reportPeriod = report.reportPeriod || identityPeriod(v3?.reportIdentity || {});
  if (samePeriod(targetQuarter, reportPeriod) && coreMetric?.consensusValue !== null && coreMetric?.consensusValue !== undefined) {
    return value(coreMetric.consensusValue, coreMetric.unit || item?.unit);
  }
  const guidance = [...(v3?.latestQuarter?.guidance || []), ...(report.guidance || [])].find((entry) => {
    const periodOk = !entry?.period || samePeriod(entry.period, targetQuarter);
    return periodOk && metricMatch(entry?.topic, item?.metric || item?.name || item?.arabicName);
  });
  if (guidance?.currentGuidance) return String(guidance.currentGuidance);
  const monitor = (v3?.monitoringChecklist || report.monitoringChecklist || []).find((entry) => metricMatch(entry?.metric, item?.metric || item?.name || item?.arabicName));
  return monitor?.expectedRange ? String(monitor.expectedRange) : null;
}

function evaluatedRequirements(v3, report) {
  return [v3?.previousRequirementsEvaluation, report.previousRequirementsEvaluation].find((candidate) =>
    Array.isArray(candidate?.requirements) && candidate.requirements.some((item) =>
      upper(item?.status || "NOT_REPORTED") !== "NOT_REPORTED" || item?.actualValue !== null && item?.actualValue !== undefined || Boolean(item?.actualDisplay)
    )
  ) || null;
}

function openRequirements(v3, report) {
  if (v3?.nextRequirements?.requirements?.length) return v3.nextRequirements;
  if (report.priceTargetRequirements?.requirements?.length) return report.priceTargetRequirements;
  return { requirements: [] };
}

async function renderPng(draw) {
  if (typeof document === "undefined") throw new Error("PNG export requires a browser.");
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = SOCIAL_EXPORT_WIDTH;
  canvas.height = SOCIAL_EXPORT_HEIGHT;
  draw(canvas.getContext("2d"));
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("تعذر إنشاء PNG.")), "image/png", 1));
}

function drawInvestment(ctx, m, exportedAt) {
  background(ctx);
  brand(ctx, "INVESTMENT INFOGRAPHIC", exportedAt);
  panel(ctx, 54, 108, 972, 150);
  ltr(ctx, "left"); font(ctx, 48, 900); fill(ctx, C.text); ctx.fillText(m.ticker, 82, 162);
  font(ctx, 20, 700); fill(ctx, C.muted); fit(ctx, m.companyName, 82, 199, 390);
  font(ctx, 14, 650); ctx.fillText([m.sector, m.industry].filter(Boolean).join(" · "), 82, 227);
  badge(ctx, m.decision, 704, 132, 286, 42);
  mini(ctx, "السعر", money(m.marketPrice), 704, 218);
  mini(ctx, "Base", money(m.base), 850, 218);
  mini(ctx, "إلى Base", signedPct(m.upsideToBasePct), 990, 218, tone(m.upsideToBasePct));

  panel(ctx, 54, 280, 972, 180); title(ctx, "الشركة باختصار", "النشاط · نموذج العمل · محركات النمو", 990, 316);
  rtl(ctx, "right"); font(ctx, 18, 700); fill(ctx, C.text); wrap(ctx, m.companySummary || m.businessModel || "لا يوجد ملخص متاح.", 990, 354, 910, 28, 3);
  font(ctx, 14, 600); fill(ctx, C.muted); wrap(ctx, m.businessModel || m.latestQuarterSummary, 990, 428, 910, 21, 2);

  panel(ctx, 54, 482, 972, 190); title(ctx, `آخر ربع ${m.reportPeriod || ""}`.trim(), "الأرقام التشغيلية الأهم", 990, 518);
  const metrics = m.latestMetrics.length ? m.latestMetrics : [metric("Data", "—", null)];
  const cell = 910 / metrics.length;
  metrics.forEach((item, i) => {
    const x = 82 + i * cell;
    if (i) line(ctx, x - 10, 556, x - 10, 646);
    ltr(ctx, "left"); font(ctx, 12, 700); fill(ctx, C.muted); fit(ctx, item.label, x, 575, cell - 20);
    font(ctx, 22, 850); fill(ctx, C.text); fit(ctx, item.value, x, 611, cell - 20);
    if (item.change !== null) { font(ctx, 11, 750); fill(ctx, tone(item.change)); ctx.fillText(`${item.change > 0 ? "+" : ""}${item.change.toFixed(1)}% YoY`, x, 640); }
  });

  panel(ctx, 54, 694, 972, 164); title(ctx, "القيمة العادلة", "Bear / Base / Bull", 990, 730);
  [["Bear",m.bear,C.red],["Base",m.base,C.teal],["Bull",m.bull,C.green]].forEach(([label,val,color],i) => {
    box(ctx, 82 + i*216, 760, 196, 72, C.panel2, C.border, 14);
    ltr(ctx,"left"); font(ctx,12,800); fill(ctx,color); ctx.fillText(label,98+i*216,782); font(ctx,28,900); fill(ctx,C.text); ctx.fillText(money(val),98+i*216,816);
  });
  rtl(ctx,"right"); font(ctx,12,700); fill(ctx,C.muted); ctx.fillText("القيمة المرجحة",990,780); font(ctx,27,900); fill(ctx,C.blue); ctx.fillText(money(m.probabilityWeighted),990,816); font(ctx,11,650); fill(ctx,C.muted); ctx.fillText(`هامش الأمان ${signedPct(m.marginOfSafetyPct)}`,990,840);

  panel(ctx,54,880,474,220); panel(ctx,552,880,474,220); title(ctx,"نقاط القوة","ما يدعم الفرضية",500,914,C.green); title(ctx,"المخاطر","ما قد يكسر الفرضية",998,914,C.red);
  bullets(ctx,m.strengths,500,954,414,C.green); bullets(ctx,m.risks,998,954,414,C.red);

  panel(ctx,54,1122,972,160); title(ctx,"الفرضية الاستثمارية","الخلاصة والمحفزات القادمة",990,1157);
  rtl(ctx,"right"); font(ctx,15,650); fill(ctx,C.text); wrap(ctx,m.thesis || "لا توجد فرضية مختصرة متاحة.",990,1192,910,22,3);
  font(ctx,12,700); fill(ctx,C.teal); fit(ctx,m.catalysts.map((x)=>x.title).filter(Boolean).join("  •  ") || "المحفزات تظهر هنا عند توفرها",990,1260,910,"right");
  footer(ctx,`تحليل ${m.analysisDate || "—"} · ${m.sourceCount || 0} مصادر · لأغراض البحث وليست توصية مالية`);
}

function drawTracker(ctx, m, exportedAt) {
  background(ctx); brand(ctx,"EARNINGS TRACKER",exportedAt);
  panel(ctx,54,108,972,174);
  ltr(ctx,"left"); font(ctx,46,900); fill(ctx,C.text); ctx.fillText(m.ticker,82,160); font(ctx,19,700); fill(ctx,C.muted); fit(ctx,m.companyName,82,198,420); font(ctx,15,750); fill(ctx,C.blue); ctx.fillText(String(m.targetQuarter),82,232);
  badge(ctx,m.decision,730,132,260,42); mini(ctx,"Base Fair Value",money(m.baseFairValue),990,218); mini(ctx,"السعر",money(m.marketPrice),830,218); mini(ctx,"الوضع",modeAr(m.mode),666,218,C.teal);
  rtl(ctx,"right"); font(ctx,12,650); fill(ctx,C.muted); ctx.fillText(m.isEvaluated ? "بعد الإعلان: مقارنة الخطة بالفعلي" : "قبل الإعلان: الفعلي يظهر تلقائيًا بعد التحديث",990,260);

  const rows = m.rows.length ? m.rows : [{metric:"لا توجد متطلبات",previous:"—",expected:"—",target:"—",actual:"—",status:"NOT_REPORTED",statusLabel:"—"}];
  const cols = [
    ["metric","المؤشر",226],["previous","السابق",142],["expected","المتوقع",170],["target","خطة الاستهداف",178],["actual","الفعلي",148],["statusLabel","الحالة",108]
  ];
  const tableY=310, headH=68, rowH=Math.max(78,Math.min(104,Math.floor(830/rows.length))), tableH=headH+rowH*rows.length;
  panel(ctx,54,tableY,972,tableH);
  let right=1026; const geometry=cols.map(([key,label,width])=>{const g={key,label,width,right,left:right-width,center:right-width/2};right-=width;return g;});
  box(ctx,55,tableY+1,970,headH-1,C.panel2,null,16);
  geometry.forEach((g,i)=>{rtl(ctx,"center");font(ctx,13,800);fill(ctx,g.key==="target"?C.teal:C.muted);ctx.fillText(g.label,g.center,tableY+40);if(i)line(ctx,g.right,tableY+14,g.right,tableY+tableH-14);});
  rows.forEach((row,ri)=>{
    const top=tableY+headH+ri*rowH; line(ctx,72,top,1008,top);
    geometry.forEach((g)=>{const valueText=String(row[g.key]||"—");ctx.direction=hasArabic(valueText)?"rtl":"ltr";ctx.textAlign="center";font(ctx,g.key==="metric"?14:13,g.key==="metric"||g.key==="statusLabel"?800:700);fill(ctx,g.key==="statusLabel"?statusColor(row.status):g.key==="target"?C.teal:C.text);centerWrap(ctx,valueText,g.center,top+rowH/2,g.width-16,rowH-14,18,2);});
  });
  const noteY=Math.min(1240,tableY+tableH+34);rtl(ctx,"right");font(ctx,12,650);fill(ctx,C.muted);wrap(ctx,m.expectedSourceNote,1026,noteY,972,19,2);
  rtl(ctx,"right");font(ctx,12,750);fill(ctx,C.teal);ctx.fillText(`${Number.isFinite(m.targetValue)?`الهدف التالي ${money(m.targetValue)}`:"خطة المتابعة محفوظة"}${m.targetScenario?` · ${scenarioAr(m.targetScenario)}`:""}`,1026,1276);
  footer(ctx,"Franklin Research · السابق ≠ المتوقع ≠ مستهدف Franklin · لأغراض البحث وليست توصية مالية");
}

function background(ctx){fill(ctx,C.bg);ctx.fillRect(0,0,1080,1350);const g=ctx.createLinearGradient(0,0,1080,1350);g.addColorStop(0,"rgba(45,212,191,.08)");g.addColorStop(1,"rgba(110,168,255,.04)");fill(ctx,g);ctx.fillRect(0,0,1080,1350);}
function brand(ctx,label,date){ltr(ctx,"left");font(ctx,23,850);fill(ctx,C.text);ctx.fillText("FRANKLIN RESEARCH",54,56);font(ctx,13,750);fill(ctx,C.teal);ctx.fillText(label,54,84);ctx.textAlign="right";font(ctx,12,650);fill(ctx,C.muted);ctx.fillText(String(date?.toISOString?.()||date||"").slice(0,10),1026,58);}
function panel(ctx,x,y,w,h){box(ctx,x,y,w,h,C.panel,C.border,20);}
function box(ctx,x,y,w,h,borderFill,stroke,r=14){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();if(borderFill){fill(ctx,borderFill);ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function title(ctx,a,b,x,y,color=C.teal){rtl(ctx,"right");font(ctx,19,850);fill(ctx,C.text);ctx.fillText(a,x,y);font(ctx,11,700);fill(ctx,color);ctx.fillText(b,x,y+24);}
function badge(ctx,action,x,y,w,h){const color=actionColor(action);box(ctx,x,y,w,h,rgba(color,.13),color,13);rtl(ctx,"center");font(ctx,16,850);fill(ctx,color);ctx.fillText(`${ACTION_AR[action]||action||"غير محدد"} · ${action||"—"}`,x+w/2,y+h/2+5);}
function mini(ctx,label,val,x,y,color=C.text){rtl(ctx,"right");font(ctx,10,700);fill(ctx,C.muted);ctx.fillText(label,x,y-20);font(ctx,18,850);fill(ctx,color);fit(ctx,val,x,y+5,138,"right");}
function bullets(ctx,items,x,y,w,color){(items.length?items:[{title:"—",explanation:""}]).slice(0,3).forEach((item,i)=>{const yy=y+i*46;fill(ctx,color);ctx.beginPath();ctx.arc(x-3,yy+5,4,0,Math.PI*2);ctx.fill();rtl(ctx,"right");font(ctx,13,800);fill(ctx,C.text);fit(ctx,item.title||item.explanation||"—",x-17,yy+8,w-20,"right");if(item.explanation){font(ctx,10,600);fill(ctx,C.muted);fit(ctx,item.explanation,x-17,yy+27,w-20,"right");}});}
function footer(ctx,msg){rtl(ctx,"right");font(ctx,11,600);fill(ctx,C.muted);ctx.fillText(msg,1026,1322);}
function line(ctx,x1,y1,x2,y2){ctx.strokeStyle=C.border;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function rtl(ctx,align="right"){ctx.direction="rtl";ctx.textAlign=align;ctx.textBaseline="middle";}
function ltr(ctx,align="left"){ctx.direction="ltr";ctx.textAlign=align;ctx.textBaseline="middle";}
function font(ctx,size,weight){ctx.font=`${weight} ${size}px -apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Tahoma,Arial,sans-serif`;}
function fill(ctx,color){ctx.fillStyle=color;}
function fit(ctx,input,x,y,maxWidth,align){const s=text(input)||"—";if(align)ctx.textAlign=align;let out=s;while(out.length>3&&ctx.measureText(out).width>maxWidth)out=`${out.slice(0,-2).trim()}…`;ctx.fillText(out,x,y);}
function wrap(ctx,input,x,y,maxWidth,lineHeight,maxLines){const words=(text(input)||"—").split(" ");let lineText="";const lines=[];for(const word of words){const next=lineText?`${lineText} ${word}`:word;if(!lineText||ctx.measureText(next).width<=maxWidth)lineText=next;else{lines.push(lineText);lineText=word;if(lines.length>=maxLines-1)break;}}if(lineText&&lines.length<maxLines)lines.push(lineText);lines.forEach((lineText,i)=>fit(ctx,lineText,x,y+i*lineHeight,maxWidth,"right"));}
function centerWrap(ctx,input,x,y,maxWidth,maxHeight,lineHeight,maxLines){const words=(text(input)||"—").split(" ");let lineText="";const lines=[];for(const word of words){const next=lineText?`${lineText} ${word}`:word;if(!lineText||ctx.measureText(next).width<=maxWidth)lineText=next;else{lines.push(lineText);lineText=word;if(lines.length>=maxLines-1)break;}}if(lineText&&lines.length<maxLines)lines.push(lineText);const start=y-(Math.min(maxHeight,lines.length*lineHeight)/2)+lineHeight/2;lines.forEach((lineText,i)=>ctx.fillText(lineText,x,start+i*lineHeight));}

async function deliver(blob,fileName,title){const file=typeof File!=="undefined"?new File([blob],fileName,{type:"image/png"}):null;if(file&&navigator.share){try{if(!navigator.canShare||navigator.canShare({files:[file]})){await navigator.share({title,files:[file]});return {shared:true,downloaded:false,blob};}}catch(error){if(error?.name==="AbortError")throw error;}}const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);return {shared:false,downloaded:true,blob};}

function installStyles(){if(document.getElementById("franklin-social-export-styles"))return;const style=document.createElement("style");style.id="franklin-social-export-styles";style.textContent=`.franklin-social-export-panel{margin:0 0 18px;padding:16px;border:1px solid rgba(45,212,191,.3);border-radius:18px;background:linear-gradient(145deg,rgba(45,212,191,.08),rgba(17,24,39,.72))}.franklin-social-export-heading{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:12px}.franklin-social-export-heading>div{display:grid;gap:3px}.franklin-social-export-heading span{font-size:11px;font-weight:800;color:#2dd4bf}.franklin-social-export-heading strong{font-size:19px;color:#f5f7fb}.franklin-social-export-heading small{direction:ltr;font-size:11px;color:#93a0b5}.franklin-social-export-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.franklin-social-export-actions button{min-height:88px;padding:14px;text-align:right;border:1px solid #2b3549;border-radius:15px;background:#0d111b;color:#f5f7fb;font:inherit;display:grid;align-content:center;gap:5px}.franklin-social-export-actions button:first-child{border-color:rgba(45,212,191,.45)}.franklin-social-export-actions b{font-size:14px}.franklin-social-export-actions span{font-size:11px;line-height:1.5;color:#99a5b8}.franklin-social-export-toast{position:fixed;z-index:25000;left:50%;bottom:max(86px,calc(env(safe-area-inset-bottom) + 74px));transform:translateX(-50%);max-width:min(88vw,430px);padding:11px 15px;border-radius:999px;background:#101624;border:1px solid #2b3549;color:#f5f7fb;font:700 12px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;box-shadow:0 18px 45px rgba(0,0,0,.38);text-align:center}.franklin-social-export-toast.success{border-color:rgba(45,212,191,.55)}.franklin-social-export-toast.error{border-color:rgba(241,123,137,.65)}@media(max-width:640px){.franklin-social-export-actions{grid-template-columns:1fr}.franklin-social-export-actions button{min-height:76px}}`;document.head.appendChild(style);}
function toast(message,tone){document.querySelector(".franklin-social-export-toast")?.remove();const node=document.createElement("div");node.className=`franklin-social-export-toast ${tone||""}`;node.textContent=message;document.body.appendChild(node);setTimeout(()=>node.remove(),2800);}

function canonical(report){const v=report?.metadata?.franklinV3Report;return v&&typeof v==="object"?v:null;}
function narrative(a,b){const source=Array.isArray(a)&&a.length?a:Array.isArray(b)?b:[];return source.map((item)=>typeof item==="string"?{title:text(item),explanation:""}:{title:text(item?.title||item?.name||item?.metric),explanation:text(item?.explanation||item?.interpretation||item?.whyItMatters)}).filter((item)=>item.title||item.explanation);}
function metric(label,val,change){return {label,value:val||"—",change:Number.isFinite(Number(change))?Number(change):null};}
function metricDisplay(m,fallback){if(m?.actualDisplay)return String(m.actualDisplay);if(m?.actualValue!==null&&m?.actualValue!==undefined)return value(m.actualValue,m.unit);return fallback!==null&&fallback!==undefined&&fallback!==""?String(fallback):"—";}
function threshold(item){if(item?.requiredValue===null||item?.requiredValue===undefined)return "—";const prefix=item?.type==="minimum"?"≥ ":item?.type==="maximum"?"≤ ":"";return `${prefix}${value(item.requiredValue,item.unit)}`;}
function value(input,unit){if(input===null||input===undefined||input==="")return "—";if(typeof input==="string"&&!Number.isFinite(Number(input)))return input;const n=Number(input);if(!Number.isFinite(n))return String(input);const u=String(unit||"");if(u==="%")return `${short(n)}%`;if(/USD/i.test(u)&&Math.abs(n)>=1e9)return `$${short(n/1e9)}B`;if(/USD/i.test(u)&&Math.abs(n)>=1e6)return `$${short(n/1e6)}M`;if(/USD|share/i.test(u)&&Math.abs(n)<1e5)return `$${short(n)}`;if(/HK\$/i.test(u)&&Math.abs(n)>=1e9)return `HK$${short(n/1e9)}B`;if(/HK\$/i.test(u))return `HK$${short(n)}`;return `${short(n)}${u&&u!=="text"&&u!=="qualitative"?` ${u}`:""}`;}
function pct(v){return Number.isFinite(Number(v))?`${short(Number(v))}%`:"—";}
function money(v){return Number.isFinite(Number(v))?`$${Number(v).toLocaleString("en-US",{maximumFractionDigits:2})}`:"—";}
function signedPct(v){const n=Number(v);return Number.isFinite(n)?`${n>0?"+":""}${n.toFixed(1)}%`:"—";}
function short(v){return Number(v).toLocaleString("en-US",{maximumFractionDigits:Math.abs(v)<10?2:1});}
function text(v){return String(v||"").replace(/\s+/g," ").trim();}
function upper(v){return text(v).toUpperCase()||null;}
function num(v){if(v===null||v===undefined||v==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function identityPeriod(i){return i?.fiscalQuarter&&i?.fiscalYear?`${i.fiscalQuarter} ${i.fiscalYear}`:null;}
function metricKey(v){const s=text(v).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g," ");if(/revenue|إيراد/.test(s))return "revenue";if(/eps|ربحية|سهم/.test(s))return "eps";if(/gross.*margin|هامش.*إجمالي/.test(s))return "grossmargin";if(/operating.*margin|هامش.*تشغيل/.test(s))return "operatingmargin";if(/free.*cash|fcf|تدفق.*حر/.test(s))return "fcf";return s.replace(/\s+/g,"");}
function metricMatch(a,b){const x=metricKey(a),y=metricKey(b);return Boolean(x&&y&&(x===y||(x.length>4&&y.length>4&&(x.includes(y)||y.includes(x)))));}
function samePeriod(a,b){const x=upper(a).replace(/[^A-Z0-9]/g,""),y=upper(b).replace(/[^A-Z0-9]/g,"");return Boolean(x&&y&&(x===y||x.includes(y)||y.includes(x)));}
function hasArabic(v){return /[\u0600-\u06ff]/.test(String(v||""));}
function actionColor(v){return v==="BUY"||v==="ADD"?C.green:v==="SELL"||v==="REDUCE"?C.red:v==="HOLD"?C.amber:v==="WATCH"?C.blue:C.muted;}
function statusColor(v){return v==="EXCEEDED"||v==="PASSED"?C.green:v==="PARTIALLY_PASSED"?C.amber:v==="FAILED"?C.red:C.muted;}
function tone(v){const n=Number(v);return !Number.isFinite(n)?C.muted:n>2?C.green:n<-2?C.red:C.amber;}
function modeAr(v){return v==="ADVANCE_TARGET"?"رفع الهدف":v==="DEFEND_BASE"?"دفاع عن Base":v==="RECOVERY"?"تعافي":v||"—";}
function scenarioAr(v){return v==="BULL"?"Bull":v==="INTERMEDIATE"?"Intermediate":v==="BASE_DEFENSE"?"Base Defense":v==="RECOVERY"?"Recovery":v;}
function rgba(hex,a){const h=String(hex).replace("#","");const n=parseInt(h,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`;}
function filePart(v){return text(v).toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"")||"franklin";}

autoInstall();
