import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  JSON_IMPORT_MAX_BYTES,
  inspectJsonImportText,
  readLocalJsonFile,
  stripJsonCodeFence
} from "../src/externalAnalysis/jsonFileImport.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import {
  findConflictingExternalAnalysis,
  findDuplicateExternalAnalysis,
  saveExternalAnalysis
} from "../src/externalAnalysis/storage.js";

const now = new Date("2026-08-28T12:00:00.000Z");
const initial = externalReport("INITIAL", "Q2 2026", "2026-08-28");
const earnings = externalReport("EARNINGS_REVALUATION", "Q3 2026", "2026-10-28");
const raw = JSON.stringify(initial);

// 1. Raw JSON file is read as UTF-8 and parsed locally.
const selected = await readLocalJsonFile(mockFile("franklin-analysis.json", raw));
assert.equal(selected.text, raw);
assert.equal(inspectJsonImportText(selected.text).summary.ticker, "TEST");

// 2. A complete fenced JSON code block is supported without changing its body.
const fenced = `\`\`\`json\n${raw}\n\`\`\``;
assert.equal(stripJsonCodeFence(fenced), raw);
assert.equal(inspectJsonImportText(fenced).summary.companyName, "Test Company");

// 3. Interrupted JSON is reported as incomplete, not as a raw JSON.parse error.
await assertRejectCode(() => inspectJsonImportText(raw.slice(0, -12)), "INCOMPLETE_JSON", /ملف التحليل غير مكتمل/);

// 4. Syntactically invalid but structurally closed JSON has a dedicated error.
await assertRejectCode(() => inspectJsonImportText('{"schemaVersion": }'), "INVALID_JSON", /ملف غير صالح/);

// 5. Only .json file names are accepted.
await assertRejectCode(() => readLocalJsonFile(mockFile("analysis.txt", raw)), "UNSUPPORTED_EXTENSION", /امتداد الملف غير مدعوم/);

// 6. Empty files are blocked.
await assertRejectCode(() => readLocalJsonFile(mockFile("empty.json", "")), "EMPTY_FILE", /ملف التحليل فارغ/);

// Oversized files are rejected before their content is read.
await assertRejectCode(() => readLocalJsonFile({ ...mockFile("large.json", raw), size: JSON_IMPORT_MAX_BYTES + 1 }), "FILE_TOO_LARGE", /حجم ملف التحليل غير مسموح/);

// An opening JSON fence without its closing fence is an interrupted response.
await assertRejectCode(() => inspectJsonImportText(`\`\`\`json\n${raw}`), "INCOMPLETE_JSON", /ملف التحليل غير مكتمل/);

// Missing core v3 sections are classified as an incomplete report.
await assertRejectCode(
  () => inspectJsonImportText(JSON.stringify({ schemaVersion: "franklin-fair-value/v3", reportIdentity: {} })),
  "INCOMPLETE_REPORT",
  /ملف التحليل غير مكتمل/
);

// 7. Duplicate identity is detected before save.
const parsedInitial = await parseExternalAnalysisInput(raw, { now, strictJson: true });
const saved = saveExternalAnalysis({}, parsedInitial.report, { now });
assert.ok(findDuplicateExternalAnalysis(saved.collection, parsedInitial.report));

// 8. Franklin v3 contract failures remain validator failures with structured fields.
const brokenV3 = {
  schemaVersion: "franklin-fair-value/v3",
  reportIdentity: { ticker: "TEST", analysisDate: "2026-08-28" },
  valuation: {},
  sources: []
};
const brokenInspection = inspectJsonImportText(JSON.stringify(brokenV3));
assert.equal(brokenInspection.validation.valid, false);
assert.ok(brokenInspection.validation.errors.some((item) => item.field === "methodologyVersion"));

// 9. Initial analysis import succeeds.
assert.equal(parsedInitial.report.metadata.analysisType, "INITIAL");
assert.equal(parsedInitial.report.company.ticker, "TEST");

// 10. Earnings update import succeeds and remains an earnings update.
const parsedEarnings = await parseExternalAnalysisInput(JSON.stringify(earnings), { now, strictJson: true });
assert.equal(parsedEarnings.report.metadata.analysisType, "EARNINGS_REVALUATION");
assert.equal(parsedEarnings.report.reportPeriod, "Q3 2026");

// 11. File and paste paths produce identical normalized reports for identical JSON.
const pasted = await parseExternalAnalysisInput(raw, { now });
assert.deepEqual(parsedInitial.report, pasted.report);

// Composite identity detects conflicting content for the same ticker/type/period/date.
const conflictingRaw = JSON.stringify({ ...initial, thesis: { shortSummary: "محتوى مختلف" } });
const conflicting = await parseExternalAnalysisInput(conflictingRaw, { now, strictJson: true });
assert.ok(findConflictingExternalAnalysis(saved.collection, conflicting.report));

// 12. Small-mobile UI retains a large file picker, stacked tabs, RTL, and local-only wording.
const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const storeSource = readFileSync(new URL("../src/state/store.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles-mobile-hotfix-v46.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.match(components, /اختيار ملف التحليل/);
assert.match(components, /موصى به للتحليلات الطويلة/);
assert.match(components, /data-external-json-file/);
assert.match(components, /accept="\.json,application\/json"/);
assert.match(components, /تحقق واستورد التحليل/);
assert.match(components, /التفاصيل التقنية/);
assert.match(css, /@media \(max-width: 520px\)/);
assert.match(css, /\.json-import-tabs \{ grid-template-columns: 1fr;/);
assert.match(css, /\.json-file-picker \{ min-height: 148px;/);
assert.match(html, /dir="rtl"/);
assert.equal((storeSource.match(/inputMode: inputMethod/g) || []).length, 3, "Full, supplement, and error import states must preserve the selected input method.");

console.log("Franklin local JSON file import: PASS");

function externalReport(analysisType, reportPeriod, analysisDate) {
  return {
    schemaVersion: "external-analysis-report/v2",
    source: "ChatGPT",
    analysisDate,
    reportPeriod,
    company: { ticker: "TEST", name: "Test Company", currency: "USD" },
    market: { priceAtAnalysis: 80 },
    fairValueSummary: { fairValueLow: 70, fairValueBase: 100, fairValueHigh: 130, currentPrice: 80 },
    thesis: { shortSummary: "فرضية استثمار مكتملة." },
    risks: [{ title: "مخاطرة", explanation: "شرح المخاطرة." }],
    decision: { action: "HOLD", rationale: "مبررات القرار." },
    sources: [{ title: "Investor Relations", url: "https://example.com" }],
    metadata: { analysisType }
  };
}

function mockFile(name, content) {
  const bytes = new TextEncoder().encode(content);
  return {
    name,
    size: bytes.byteLength,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }
  };
}

async function assertRejectCode(run, code, messagePattern) {
  try {
    await run();
    assert.fail(`Expected ${code}`);
  } catch (error) {
    assert.equal(error.code, code);
    assert.match(error.userMessage, messagePattern);
    assert.doesNotMatch(error.userMessage, /Unexpected end of JSON input/i);
  }
}
