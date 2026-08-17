import { createQuarterlyScorecardExportModel } from "../externalAnalysis/quarterlyScorecard.js";

const WIDTH = 1080;
const HEIGHT = 1350;
const COLORS = {
  background: "#070a12",
  surface: "#0d111b",
  elevated: "#111827",
  border: "#263244",
  text: "#f3f6fa",
  muted: "#91a0b5",
  blue: "#4f8cff",
  green: "#35c98a",
  amber: "#d8a33c",
  red: "#df5f6f",
  neutral: "#667388"
};

export async function renderQuarterlyScorecardPng(scorecard, exportedAt = new Date()) {
  if (typeof document === "undefined") throw new Error("PNG export requires a browser document.");
  if (document.fonts?.ready) await document.fonts.ready;
  const model = createQuarterlyScorecardExportModel(scorecard, exportedAt);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  drawScorecard(canvas.getContext("2d"), model);
  return canvasToBlob(canvas);
}

export async function downloadQuarterlyScorecardPng(scorecard, exportedAt = new Date()) {
  const blob = await renderQuarterlyScorecardPng(scorecard, exportedAt);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `franklin-${scorecard.ticker || "scorecard"}-${scorecard.year || "year"}.png`;
  link.click();
  URL.revokeObjectURL(url);
  return blob;
}

export async function shareQuarterlyScorecardPng(scorecard, exportedAt = new Date()) {
  if (!navigator.share) return { shared: false, reason: "unsupported" };
  const blob = await renderQuarterlyScorecardPng(scorecard, exportedAt);
  const file = new File([blob], `franklin-${scorecard.ticker || "scorecard"}-${scorecard.year || "year"}.png`, { type: "image/png" });
  if (navigator.canShare && !navigator.canShare({ files: [file] })) return { shared: false, reason: "unsupported_files" };
  await navigator.share({
    title: `${scorecard.ticker || "Franklin"} — متابعة الأرباع`,
    text: `Franklin Research · ${scorecard.year || ""}`,
    files: [file]
  });
  return { shared: true };
}

function drawScorecard(ctx, model) {
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  drawBrand(ctx, model);
  drawTarget(ctx, model);
  drawQuarterSummary(ctx, model);
  drawMatrix(ctx, model);
  drawFooter(ctx, model);
}

function drawBrand(ctx, model) {
  ctx.textBaseline = "middle";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 28, 800);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("FRANKLIN RESEARCH", 1016, 62);
  setFont(ctx, 22, 600);
  ctx.fillStyle = COLORS.blue;
  ctx.fillText("بطاقة تنفيذ الفرضية الاستثمارية", 1016, 104);

  roundedRect(ctx, 64, 145, 952, 120, 18, COLORS.surface, COLORS.border);
  setFont(ctx, 52, 800);
  ctx.fillStyle = COLORS.text;
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillText(model.ticker || "—", 94, 190);
  setFont(ctx, 22, 500);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(model.companyName || "", 94, 228);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 34, 800);
  ctx.fillStyle = COLORS.text;
  ctx.fillText("متابعة الأرباع", 986, 184);
  setFont(ctx, 20, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(String(model.year || "—"), 986, 226);
}

function drawTarget(ctx, model) {
  roundedRect(ctx, 64, 286, 952, 112, 18, COLORS.elevated, COLORS.border);
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 18, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("السعر المستهدف", 986, 322);
  setFont(ctx, 38, 800);
  ctx.fillStyle = COLORS.text;
  ctx.fillText(formatMoney(model.target?.value), 986, 364);
  ctx.textAlign = "left";
  setFont(ctx, 18, 600);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("المسار", 94, 322);
  setFont(ctx, 26, 800);
  ctx.fillStyle = trajectoryColor(model.trajectory);
  ctx.fillText(trajectoryLabel(model.trajectory), 94, 364);
}

function drawQuarterSummary(ctx, model) {
  const x = 64;
  const y = 420;
  const gap = 14;
  const cellWidth = (952 - gap * 3) / 4;
  model.quarters.forEach((quarter, index) => {
    const cellX = x + index * (cellWidth + gap);
    const emphasized = quarter.quarter === latestReportedQuarter(model.quarters);
    roundedRect(ctx, cellX, y, cellWidth, 120, 15, emphasized ? "#12213a" : COLORS.surface, emphasized ? COLORS.blue : COLORS.border);
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    setFont(ctx, 20, 700);
    ctx.fillStyle = emphasized ? COLORS.blue : COLORS.muted;
    ctx.fillText(`Q${quarter.quarter}`, cellX + cellWidth / 2, y + 34);
    setFont(ctx, 34, 800);
    ctx.fillStyle = quarter.evaluated && Number.isFinite(quarter.weightedAchievement) ? COLORS.text : COLORS.neutral;
    ctx.fillText(quarter.evaluated && Number.isFinite(quarter.weightedAchievement) ? `${Math.round(quarter.weightedAchievement)}%` : "—", cellX + cellWidth / 2, y + 78);
    setFont(ctx, 14, 600);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(quarter.evaluated ? "REPORTED" : "AWAITING", cellX + cellWidth / 2, y + 105);
  });
}

function drawMatrix(ctx, model) {
  const x = 64;
  const y = 566;
  const width = 952;
  const availableHeight = 670;
  const rows = model.rows || [];
  const rowHeight = Math.max(34, Math.min(72, Math.floor((availableHeight - 54) / Math.max(rows.length, 1))));
  roundedRect(ctx, x, y, width, Math.min(availableHeight, 54 + rowHeight * Math.max(rows.length, 1)), 18, COLORS.surface, COLORS.border);
  ctx.fillStyle = COLORS.elevated;
  roundedRect(ctx, x + 1, y + 1, width - 2, 52, 17, COLORS.elevated, null);
  const quarterXs = [704, 546, 388, 230];
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 18, 700);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText("المؤشر / المطلوب", 986, y + 27);
  quarterXs.forEach((quarterX, index) => {
    ctx.textAlign = "center";
    ctx.direction = "ltr";
    ctx.fillText(`Q${index + 1}`, quarterX, y + 27);
  });

  rows.forEach((row, rowIndex) => {
    const rowY = y + 54 + rowIndex * rowHeight;
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath();
    ctx.moveTo(x + 18, rowY);
    ctx.lineTo(x + width - 18, rowY);
    ctx.stroke();
    ctx.direction = "rtl";
    ctx.textAlign = "right";
    setFont(ctx, rowHeight < 46 ? 14 : 17, 700);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(truncate(row.label, rowHeight < 46 ? 24 : 31), 986, rowY + rowHeight * 0.38);
    const latestRequired = latestCell(row.cells);
    setFont(ctx, rowHeight < 46 ? 11 : 13, 500);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`المطلوب ${formatThreshold(latestRequired)}`, 986, rowY + rowHeight * 0.72);

    quarterXs.forEach((quarterX, index) => {
      const cell = row.cells?.[index + 1];
      ctx.textAlign = "center";
      ctx.direction = "ltr";
      setFont(ctx, rowHeight < 46 ? 13 : 16, 700);
      ctx.fillStyle = statusColor(cell?.status);
      ctx.fillText(formatActual(cell), quarterX, rowY + rowHeight * 0.42);
      setFont(ctx, rowHeight < 46 ? 10 : 12, 700);
      ctx.fillText(statusShort(cell?.status), quarterX, rowY + rowHeight * 0.72);
    });
  });
}

function drawFooter(ctx, model) {
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  setFont(ctx, 16, 500);
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`تم التصدير ${String(model.exportedAt || "").slice(0, 10)}`, 1016, 1310);
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("franklin research", 64, 1310);
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create PNG export.")), "image/png", 1);
  });
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function setFont(ctx, size, weight) {
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
}

function latestCell(cells = {}) {
  return [4, 3, 2, 1].map((quarter) => cells?.[quarter]).find(Boolean) || null;
}

function latestReportedQuarter(quarters = []) {
  return [...quarters].reverse().find((quarter) => quarter.evaluated)?.quarter || null;
}

function formatActual(cell) {
  if (!cell || !cell.reported) return "—";
  if (cell.actualDisplay) return String(cell.actualDisplay);
  if (cell.actualValue === null || cell.actualValue === undefined || cell.actualValue === "") return "—";
  return `${cell.actualValue}${cell.unit === "%" ? "%" : ""}`;
}

function formatThreshold(cell) {
  if (!cell) return "—";
  if (cell.requiredDisplay) return cell.requiredDisplay;
  if (cell.requiredValue === null || cell.requiredValue === undefined || cell.requiredValue === "") return "—";
  const type = String(cell.type || "").toLowerCase();
  const prefix = type.includes("minimum") ? "≥ " : type.includes("maximum") ? "≤ " : "";
  return `${prefix}${cell.requiredValue}${cell.unit === "%" ? "%" : ""}`;
}

function formatMoney(value) {
  return Number.isFinite(value) ? `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";
}

function statusShort(status) {
  const labels = { EXCEEDED: "تجاوز", PASSED: "تحقق", PARTIALLY_PASSED: "جزئي", FAILED: "فشل", NOT_REPORTED: "—" };
  return labels[status] || "—";
}

function statusColor(status) {
  if (status === "EXCEEDED") return COLORS.green;
  if (status === "PASSED") return "#6fd7a9";
  if (status === "PARTIALLY_PASSED") return COLORS.amber;
  if (status === "FAILED") return COLORS.red;
  return COLORS.neutral;
}

function trajectoryColor(value) {
  if (value === "improving") return COLORS.green;
  if (value === "weakening") return COLORS.red;
  if (value === "stable") return COLORS.amber;
  return COLORS.neutral;
}

function trajectoryLabel(value) {
  if (value === "improving") return "يتحسن";
  if (value === "weakening") return "يضعف";
  if (value === "stable") return "مستقر";
  return "غير متوفر";
}

function truncate(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}
