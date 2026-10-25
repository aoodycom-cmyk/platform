import assert from "node:assert/strict";
import test from "node:test";
import { readLocalJsonFile, inspectJsonImportText, describeImportValidationErrors } from "../src/externalAnalysis/jsonFileImport.js";
import { assertDispatchedRouteAccepted, dispatchJsonPayload, JSON_IMPORT_ROUTES } from "../src/externalAnalysis/jsonContractRouter.js";
import { FRANKLIN_FAIR_VALUE_SCHEMA_VERSION } from "../src/externalAnalysis/v3Contract.js";
import { validateFranklinV3Report } from "../src/externalAnalysis/v3Validator.js";
import { validateExternalAnalysisSupplement } from "../src/externalAnalysis/supplementValidator.js";
import { parseExternalAnalysisInput } from "../src/externalAnalysis/parser.js";
import { localizedValidationMessage } from "../src/ui/components.js";

const log = console.log;
let canonical;
try { console.log = () => {}; ({ canonical } = await import("./intcOwnerAcceptance.test.mjs")); }
finally { console.log = log; }

// Synthetic fixture: the existing golden report's numbers are not CRDO research.
const crdo = structuredClone(canonical);
crdo.reportIdentity.ticker = "CRDO";
crdo.reportIdentity.companyName = "CRDO import regression fixture";

test("literal V3 survives file bytes, inspection, normalization, validation and parsing", async () => {
  const raw = JSON.stringify(crdo);
  const bytes = new TextEncoder().encode(raw);
  const selected = await readLocalJsonFile({ name: "CRDO-regression.json", size: bytes.byteLength, arrayBuffer: async () => bytes.buffer });
  assert.equal(selected.text, raw);
  const inspected = inspectJsonImportText(selected.text);
  assert.equal(inspected.value.schemaVersion, "franklin-fair-value/v3");
  assert.equal(inspected.normalizedValue.schemaVersion, FRANKLIN_FAIR_VALUE_SCHEMA_VERSION);
  assert.equal(validateFranklinV3Report(inspected.normalizedValue).valid, true);
  assert.equal(inspected.validation.valid, true);
  const parsed = await parseExternalAnalysisInput(selected.text, { strictJson: true });
  assert.equal(parsed.report.company.ticker, "CRDO");
  assert.deepEqual(parsed.report.metadata.franklinV3Report, crdo);
});

test("a supported V3 rejected by a different import route is a route error, not a schema error", () => {
  assert.throws(() => inspectJsonImportText(JSON.stringify(crdo), { intendedRoute: JSON_IMPORT_ROUTES.BACKUP }), (error) => error.code === "WRONG_IMPORT_ROUTE");
  const dispatched = dispatchJsonPayload(crdo, { intendedRoute: JSON_IMPORT_ROUTES.BACKUP });
  assert.equal(dispatched.validation.valid, true);
  assert.throws(() => assertDispatchedRouteAccepted(dispatched, crdo), (error) => {
    assert.equal(error.code, "WRONG_IMPORT_ROUTE");
    assert.equal(error.diagnostic.field, "$");
    assert.equal(error.diagnostic.received, "franklin-fair-value/v3");
    assert.equal(error.diagnostic.intendedRoute, "backup");
    assert.equal(error.diagnostic.actualRoute, "full-analysis");
    assert.match(error.userMessage, /إصدار JSON مدعوم/);
    assert.match(error.userMessage, /مستورد التحليل الكامل/);
    assert.equal(localizedValidationMessage(error.importErrors[0]), error.userMessage);
    return true;
  });
});

test("root JSONPaths retain the actual value and are never prefixed twice", () => {
  const [shown] = describeImportValidationErrors([{ field: "$.schemaVersion", expected: "external-analysis-supplement/v1", message: "Wrong supplement schema." }], crdo);
  assert.equal(shown.currentValue, "franklin-fair-value/v3");
  assert.equal(shown.received, "franklin-fair-value/v3");
  assert.equal(localizedValidationMessage(shown), shown.messageAr);
  assert.equal(shown.receivedType, "string");
  assert.match(shown.message, /المسار \$\.schemaVersion\./);
  assert.doesNotMatch(shown.message, /\$\.\$\./);
  const [nested] = describeImportValidationErrors([{ field: "$.sources[0].id", message: "Source error." }], crdo);
  assert.equal(nested.received, crdo.sources[0].id);
});

test("version errors report the actual validator contract, including supplement errors", () => {
  const errors = validateExternalAnalysisSupplement({ schemaVersion: crdo.schemaVersion, fields: {} }).errors;
  const [shown] = describeImportValidationErrors(errors.filter((issue) => issue.field === "schemaVersion"), crdo);
  assert.equal(shown.requiredValue, "external-analysis-supplement/v1");
  assert.equal(shown.received, "franklin-fair-value/v3");
  assert.equal(localizedValidationMessage(shown), shown.messageAr);
  const bad = { ...crdo, schemaVersion: "franklin-fair-value/v999" };
  const issue = validateFranklinV3Report(bad).errors[0];
  assert.equal(issue.expected, "franklin-fair-value/v3");
  assert.equal(issue.received, bad.schemaVersion);
  assert.throws(() => inspectJsonImportText(JSON.stringify(bad)), (error) => error.code === "UNSUPPORTED_SCHEMA");
});

test("valid schema cannot conceal errors in another report field", () => {
  const bad = structuredClone(crdo);
  bad.marketPrice.sourceId = "MISSING-SOURCE";
  const inspected = inspectJsonImportText(JSON.stringify(bad));
  assert.equal(inspected.validation.valid, false);
  const shown = describeImportValidationErrors(inspected.validation.errors, inspected.value);
  assert.ok(shown.some((issue) => issue.field === "marketPrice.sourceId"));
  assert.ok(shown.every((issue) => !/^(?:\$\.)?schemaVersion$/.test(issue.field)));
});
