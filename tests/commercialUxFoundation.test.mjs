import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const backendConfig = readFileSync(new URL("../backend-config.js", import.meta.url), "utf8");
const commercialUx = readFileSync(new URL("../src/financialSafety/commercialUx.js", import.meta.url), "utf8");
const decisionReadiness = readFileSync(new URL("../src/financialSafety/decisionReadinessUi.js", import.meta.url), "utf8");

assert.ok(backendConfig.includes("franklin-silent-boot-style"), "Normal boot must hide the legacy textual placeholder before paint.");
assert.ok(backendConfig.includes("data-franklin-boot-placeholder"), "Silent boot must target only the boot placeholder.");
assert.ok(backendConfig.includes("Safari لم يكمل فتح Franklin"), "True Safari recovery must still be revealed on failure.");
assert.ok(backendConfig.includes("franklin:boot-ready"), "Silent boot protection must release after a successful mount.");

assert.ok(commercialUx.includes("franklin-analysis-status"), "Report warnings must consolidate into one analysis status component.");
assert.ok(commercialUx.includes('severity: "info"'), "Analysis status must support quiet informational state.");
assert.ok(commercialUx.includes('severity: "warning"'), "Analysis status must support warning state.");
assert.ok(commercialUx.includes('severity: "critical"'), "Analysis status must preserve critical integrity state.");
assert.ok(commercialUx.includes("oldFinancial.hidden = true"), "Legacy financial safety banner must be hidden after consolidation.");
assert.ok(commercialUx.includes("oldSources.hidden = true"), "Legacy source warning must be hidden after consolidation.");
assert.ok(commercialUx.includes("<details"), "Technical status detail must use progressive disclosure.");
assert.equal(commercialUx.includes("تصحيح JSON"), false, "Normal commercial status UI must not expose JSON-repair language.");

assert.ok(decisionReadiness.includes("يحتاج مراجعة"), "Home cards must use concise investor-facing status copy.");
assert.equal(decisionReadiness.includes("غير جاهز للقرار — راجع تنبيهات التقرير"), false, "Home cards must not use verbose diagnostic copy.");
assert.ok(decisionReadiness.includes("box-shadow:none"), "Blocked home cards must not glow like error-console cards.");

console.log("Commercial UX foundation tests passed.");
