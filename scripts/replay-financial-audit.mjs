import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { basename } from "node:path";
import { normalizeFranklinV3Input } from "../src/externalAnalysis/v3InputNormalizer.js";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { recalculateValuationMethod } from "../src/financialSafety/financialVerification.js";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

export async function replayFinancialAuditFile(file) {
  const bytes = await readFile(file);
  const raw = bytes.toString("utf8");
  const input = normalizeFranklinV3Input(JSON.parse(raw));
  const validation = validateFranklinV3Report(input);
  let importResult;
  try {
    const parsed = await parseExternalAnalysisInput(raw, { strictJson: true });
    importResult = { accepted: true, status: parsed.report.metadata?.financialVerification?.status };
  } catch (error) {
    importResult = { accepted: false, code: error.code || "IMPORT_FAILED" };
  }
  const arithmeticOnly = (input.valuation?.valuationResults || []).map((method) => {
    // Diagnostic only: legacy files lack the metadata needed for approval. Do
    // not invent terminal derivation/provenance or inject these values into a report.
    const inputs = method.inputs || {};
    let value = recalculateValuationMethod(method).value;
    if (String(method.method).toUpperCase().includes("DCF") && Array.isArray(inputs.forecastFreeCashFlows)
      && inputs.forecastFreeCashFlows.length === inputs.discountPeriods?.length) {
      const factor = 1 + inputs.discountRatePct / 100;
      const pv = inputs.forecastFreeCashFlows.reduce((sum, flow, index) => sum + flow / factor ** inputs.discountPeriods[index], 0);
      value = (pv + inputs.terminalValue / factor ** inputs.terminalDiscountPeriod + inputs.cash - inputs.debt) / inputs.dilutedShares;
    }
    return { method: method.method, weight: method.weight, reported: method.fairValue, arithmeticOnlyValue: Number.isFinite(value) ? value : null,
      matchesReported: Number.isFinite(value) && Math.abs(value - method.fairValue) <= Math.max(0.01, Math.abs(value) * 0.001) };
  });
  const before = hash(bytes);
  const after = hash(await readFile(file));
  if (before !== after) throw new Error("SOURCE_CHANGED_DURING_REPLAY");
  const weighted = arithmeticOnly.filter((m) => m.weight > 0);
  const arithmeticOnlyBase = weighted.length && weighted.every((m) => Number.isFinite(m.arithmeticOnlyValue))
    ? weighted.reduce((sum, m) => sum + m.arithmeticOnlyValue * m.weight / 100, 0) : null;
  return {
    file: basename(file), ticker: input.reportIdentity?.ticker, sha256: before, sourceUnchanged: true,
    schemaValid: validation.valid, structuralErrors: validation.errors.map((e) => ({ field: e.field || e.path, message: e.message })),
    status: validation.financialVerification.status,
    findings: validation.financialVerification.findings.map((f) => ({ code: f.code, field: f.field })),
    importResult, arithmeticOnly, arithmeticOnlyBase, arithmeticOnlyIsFinancialApproval: false
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node scripts/replay-financial-audit.mjs "path/to/original.json" [...]');
    process.exitCode = 1;
  } else {
    for (const file of files) console.log(JSON.stringify(await replayFinancialAuditFile(file)));
  }
}
