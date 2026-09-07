import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const path = resolve("tests/corpus/real-world/source-packages.json");
const corpus = JSON.parse(await readFile(path, "utf8"));
for (const company of corpus.companies) {
  for (const period of company.periods) {
    const guidance = period.guidance || {};
    if (guidance.status === "VERIFIED") {
      guidance.determination = "GUIDANCE PRESENT";
    } else if (guidance.evidenceExcerpt) {
      guidance.status = "GUIDANCE_PRESENT_UNSTRUCTURED";
      guidance.determination = "GUIDANCE PRESENT";
      guidance.reason = "Official outlook language was found but complete structured guidance was not independently verified.";
    } else {
      guidance.status = "NOT_APPLICABLE";
      guidance.determination = "NO FORMAL GUIDANCE";
      guidance.reason ||= "No company guidance language was found in the selected official exhibit.";
    }
    period.guidance = guidance;
  }
}
await writeFile(path, `${JSON.stringify(corpus, null, 2)}\n`);
console.log("Reclassified Phase 5D guidance without promoting unstructured outlook language.");
