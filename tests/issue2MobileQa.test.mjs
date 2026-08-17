import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const components = readFileSync(new URL("../src/ui/components.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const mobileStyles = readFileSync(new URL("../styles-mobile2.css", import.meta.url), "utf8");
const { compactEvidenceList, evidenceDetailFields } = await import("../src/ui/components.js");

assert.ok(components.includes("class=\"compact-evidence-row\""), "Catalysts, risks, and watch items must render as compact rows.");
assert.ok(components.includes("data-evidence-detail"), "Evidence rows must expose a detail action.");
assert.ok(components.includes('aria-label="${escapeHtml(actionLabel)}"'), "Evidence rows must announce that they open item details.");
assert.ok(components.includes('data-evidence-dialog-label="${escapeHtml(dialogLabel)}"'), "Each evidence row must provide a specific accessible dialog name.");
assert.ok(components.includes("data-evidence-template"), "Each evidence row must preserve its complete source detail.");
assert.ok(components.includes("function evidenceDetailDialog"), "The shared evidence Bottom Sheet must exist.");
assert.ok(components.includes("evidenceDialog.showModal()"), "Evidence details must open as a modal instead of navigating away.");
assert.ok(components.includes("event.target === evidenceDialog"), "Tapping the modal backdrop must close it.");
assert.ok(components.includes("event.key === \"Escape\""), "Escape must explicitly close the Bottom Sheet across browsers.");
assert.ok(components.includes("evidenceDialog?.addEventListener(\"cancel\""), "Native dialog cancel events must close the Bottom Sheet.");
assert.ok(components.includes("data-action=\"close-evidence-detail\""), "The Bottom Sheet must provide an explicit close action.");
assert.ok(components.includes("compactEvidenceList(catalysts, \"\", \"catalyst\")"), "Catalysts must use the shared compact evidence interaction.");
assert.ok(components.includes("compactEvidenceList(items, \"\", \"watch\")"), "Watch items must use the shared compact evidence interaction.");
assert.ok(components.includes("compactEvidenceList(risks, uiLabel(\"No verified risks were provided.\"), \"risk\")"), "Risks must use the shared compact evidence interaction.");
const evidenceListSource = components.slice(
  components.indexOf("function compactEvidenceList"),
  components.indexOf("function reportItemPreview")
);
assert.equal(evidenceListSource.includes("slice("), false, "Every supplied catalyst, risk, and watch item must remain accessible.");

const longPlainText = "Long plain catalyst text that must stay compact in the row while remaining complete and untruncated inside the detail sheet.";
const plainTextHtml = compactEvidenceList([longPlainText], "", "catalyst");
assert.ok(plainTextHtml.includes("plain-text-preview"), "Plain-string evidence must use the clamped mobile title treatment.");
assert.equal(plainTextHtml.includes("<small"), false, "Plain-string evidence must not duplicate the same text in a secondary row preview.");
assert.ok(plainTextHtml.split("<template")[1]?.includes(longPlainText), "The complete plain string must remain available inside the detail sheet.");

const checklistItem = { metric: "Revenue Growth", currentValue: "34%", focus: "Compare against guidance" };
const checklistFields = evidenceDetailFields(checklistItem);
assert.ok(checklistFields.some(({ value }) => value === "34%"), "Checklist currentValue must remain available in the detail sheet.");
assert.ok(checklistFields.some(({ value }) => value === "Compare against guidance"), "Checklist focus must remain available in the detail sheet.");
const checklistHtml = compactEvidenceList([checklistItem], "", "watch");
assert.ok(checklistHtml.includes("34%"), "Checklist currentValue must be rendered without inventing data.");
assert.ok(checklistHtml.includes("Compare against guidance"), "Checklist focus must be rendered without inventing data.");

assert.ok(styles.includes(".compact-evidence-row"), "Compact evidence row styles must exist.");
assert.ok(styles.includes("-webkit-line-clamp: 2"), "Evidence previews must be limited to two lines.");
assert.ok(styles.includes(".evidence-detail-dialog"), "The mobile Bottom Sheet must be styled.");
assert.ok(styles.includes("z-index: var(--layer-modal)"), "The Bottom Sheet must use the shared modal layer token.");
assert.ok(styles.includes("max-height: min(78dvh, 680px)"), "Long evidence details must scroll within a bounded sheet.");
assert.ok(styles.includes("overflow-y: auto"), "Long Bottom Sheet content must remain readable.");
assert.ok(styles.includes(".evidence-detail-close:focus-visible"), "The programmatically focused close button must have a visible keyboard focus state.");
assert.ok(components.includes("fallbackInertState"), "The non-modal fallback must make background surfaces inert.");
assert.ok(components.includes("event.key !== \"Tab\""), "The dialog must trap keyboard focus while open.");
assert.ok(components.includes("trigger?.focus()"), "Closing evidence details must restore focus to the triggering row.");
assert.ok(components.includes('evidenceDialog.setAttribute("aria-label", button.dataset.evidenceDialogLabel || genericEvidenceDialogLabel)'), "Opening evidence details must identify the selected item in the dialog accessible name.");
assert.ok(components.includes('evidenceDialog.setAttribute("aria-label", genericEvidenceDialogLabel)'), "Closing evidence details must restore the generic accessible name.");
assert.ok(styles.includes("@media (min-width: 641px)"), "Desktop evidence and History behavior must have an explicit non-mobile presentation.");
assert.equal(mobileStyles.includes("--m2-"), false, "Mobile 2.0 must reuse the canonical Franklin color tokens instead of maintaining a parallel palette.");

assert.ok(components.includes("class=\"history-analysis-card\""), "Previous analyses must use compact mobile cards.");
assert.ok(components.includes("class=\"history-company-title\""), "History company identity must have a dedicated wrapping container.");
assert.ok(components.includes("class=\"history-card-values\""), "History price and Base Fair Value must remain compact and readable.");
assert.ok(components.includes("data-external-ticker"), "History cards must preserve the existing report-open action.");
assert.ok(components.includes("nestedInteractive !== card"), "A History button must open its saved report while still ignoring nested controls.");
assert.ok(components.includes("data-external-history-id"), "History cards must use the dedicated saved-report handler.");
assert.ok(styles.includes(".history-report-list .history-analysis-card"), "History card layout must be isolated from legacy grids.");
assert.ok(styles.includes(".history-report-list .history-analysis-card:focus-visible"), "History cards must expose a visible keyboard focus state.");
assert.ok(styles.includes("grid-template-columns: minmax(0, 1fr)"), "History cards must use one safe content column.");
assert.ok(styles.includes("writing-mode: horizontal-tb"), "Long company names must never collapse into vertical text.");
assert.ok(styles.includes("overflow-x: hidden"), "The page must continue preventing horizontal overflow.");
assert.equal(/font-weight:\s*(650|750)\s*;/.test(styles), false, "New UI must use the established font-weight scale.");

console.log("Issue #2 mobile QA regression tests passed.");
