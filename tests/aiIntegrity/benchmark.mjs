const attacks = ["value", "metric", "period", "basis", "unit", "currency", "company", "missing-source", "stale", "paraphrase"];

export const hallucinationCases = Array.from({ length: 200 }, (_, index) => {
  const attack = attacks[index % attacks.length];
  const metric = ["revenue", "eps", "guidance", "backlog", "debt", "cash"][index % 6];
  const official = metric === "eps" ? 1.27 : 4.83 + index / 100;
  const source = {
    id: `SRC-${index}`, companyId: "ACME", date: "2026-07-20", type: "primary",
    text: "Management expects moderate growth and disciplined capital spending.",
    facts: [{ metric, value: official, unit: metric === "eps" ? "per share" : "billions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP", companyId: "ACME" }]
  };
  const claim = {
    id: `ADV-${String(index + 1).padStart(3, "0")}`, type: "FACTUAL", metric, value: official,
    unit: metric === "eps" ? "per share" : "billions", currency: "USD", period: "Q2 FY2026",
    accountingBasis: "GAAP", sourceId: source.id, current: true,
    text: `${metric} was ${official} in Q2 FY2026`
  };
  if (attack === "value") claim.value = official + (metric === "eps" ? .45 : -.45);
  if (attack === "metric") claim.metric = metric === "revenue" ? "backlog" : "revenue";
  if (attack === "period") claim.period = "Q1 FY2026";
  if (attack === "basis") claim.accountingBasis = "NON_GAAP";
  if (attack === "unit") claim.unit = "millions";
  if (attack === "currency") claim.currency = "EUR";
  if (attack === "company") source.companyId = source.facts[0].companyId = "ACNIE";
  if (attack === "missing-source") claim.sourceId = "FAKE-SOURCE";
  if (attack === "stale") source.date = "2023-01-01";
  if (attack === "paraphrase") { claim.metric = "management growth"; claim.value = 20; claim.unit = "percent"; claim.text = "Management expects 20% revenue growth."; }
  return { id: claim.id, attack, payload: { companyId: "ACME", analysisDate: "2026-08-01", claims: [claim], sources: [source] }, expected: "DETECTED" };
});

export const conflictCases = Array.from({ length: 50 }, (_, index) => {
  const metric = ["revenue", "eps", "guidance", "cash", "debt"][index % 5];
  const primaryValue = 10 + index;
  return {
    id: `CONFLICT-${String(index + 1).padStart(3, "0")}`,
    payload: {
      companyId: "ACME", analysisDate: "2026-08-01",
      sources: [
        { id: `PRI-${index}`, companyId: "ACME", date: "2026-07-20", type: "primary", facts: [{ metric, value: primaryValue, unit: "millions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP" }] },
        { id: `SEC-${index}`, companyId: "ACME", date: "2026-07-21", type: "secondary", facts: [{ metric, value: primaryValue + 2, unit: "millions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP" }] }
      ],
      claims: [
        { id: `CP-${index}`, type: "FACTUAL", metric, value: primaryValue, unit: "millions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP", sourceId: `PRI-${index}`, text: `${metric} primary value` },
        { id: `CS-${index}`, type: "FACTUAL", metric, value: primaryValue + 2, unit: "millions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP", sourceId: `SEC-${index}`, text: `${metric} secondary value` }
      ]
    }
  };
});

export const cleanCases = Array.from({ length: 50 }, (_, index) => {
  const metric = ["revenue", "eps", "cash", "debt", "backlog"][index % 5]; const value = 2 + index / 10;
  const source = { id: `CLEAN-SRC-${index}`, companyId: "CLEAN", date: "2026-07-20", type: "primary", facts: [{ metric, value, unit: "millions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP" }] };
  return { id: `CLEAN-${String(index + 1).padStart(3, "0")}`, payload: { companyId: "CLEAN", analysisDate: "2026-08-01", sources: [source], claims: [{ id: `CC-${index}`, type: "FACTUAL", metric, value, unit: "millions", currency: "USD", period: "Q2 FY2026", accountingBasis: "GAAP", sourceId: source.id, text: `${metric} was ${value}` }] } };
});
