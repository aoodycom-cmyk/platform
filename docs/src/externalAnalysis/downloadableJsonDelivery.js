export function buildDownloadableJsonDeliveryInstructions({ fileName, schemaVersion }) {
  const safeFileName = normalizeFileName(fileName);
  const rootSchemaInstruction = schemaVersion
    ? `The first property immediately after the opening brace must be exactly \"schemaVersion\": \"${schemaVersion}\". Do not nest the report inside result, report, data, response, or any other wrapper object.`
    : "schemaVersion must be a top-level property of the JSON object, never inside a wrapper object.";

  return [
    "FILE DELIVERY — MANDATORY PRIMARY MODE",
    "Do not print the completed JSON in the chat and do not place it in a Markdown code fence when file attachments are available.",
    `Create one downloadable UTF-8 JSON file named \"${safeFileName}\" and attach it to the response.`,
    "The file contents must be the complete raw JSON object only: it begins with the opening object brace and ends with the closing object brace.",
    rootSchemaInstruction,
    "The complete file contents must pass JSON.parse() without cleanup, comments, Markdown, or text outside the JSON object.",
    "Do not shorten, summarize, omit, split, or reduce any financial field to make the file smaller.",
    "Before attaching the file, read it back completely and verify that all objects, arrays, and strings are closed and that schemaVersion, reportIdentity, valuation, and sources are present.",
    "The visible chat response must contain only one short Arabic sentence confirming completion plus the downloadable .json attachment.",
    "FALLBACK ONLY — if the environment genuinely cannot create or attach a file, return exactly one fenced JSON code block beginning with ```json and ending with ```, with no prose before or after it. The fenced content must pass JSON.parse() after removing only the two fences."
  ];
}

function normalizeFileName(value) {
  const base = String(value || "franklin-analysis.json")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base.toLowerCase().endsWith(".json") ? base : `${base}.json`;
}
