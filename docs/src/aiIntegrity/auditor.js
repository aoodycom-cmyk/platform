export const CLAIM_STATUSES = Object.freeze(["VERIFIED", "SUPPORTED", "CONFLICTED", "UNVERIFIED", "UNSUPPORTED"]);
export const CLAIM_TYPES = Object.freeze(["FACTUAL", "DERIVED", "INTERPRETIVE", "FORWARD_LOOKING", "SUBJECTIVE"]);
export const MATERIALITY = Object.freeze(["CRITICAL", "MAJOR", "MODERATE", "MINOR"]);

export function auditAnalysisIntegrity(payload = {}, options = {}) {
  const claims = Array.isArray(payload.claims) ? payload.claims.map(normalizeClaim) : [];
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const sourceMap = new Map();
  const duplicateSourceIds = new Set();
  for (const source of sources) {
    if (!source?.id) continue;
    if (sourceMap.has(source.id)) duplicateSourceIds.add(source.id);
    else sourceMap.set(source.id, source);
  }

  const auditedClaims = claims.map((claim) => auditClaim(claim, sourceMap, duplicateSourceIds, payload, options));
  const contradictions = contradictionAudit(auditedClaims, payload, sourceMap);
  for (const issue of contradictions) {
    for (const claimId of issue.claimIds || []) {
      const claim = auditedClaims.find((item) => item.id === claimId);
      if (claim) {
        claim.status = "CONFLICTED";
        claim.auditorResult = "CONFLICTED";
        claim.confidence = .2;
        claim.findings.push(issue);
      }
    }
  }
  const temporal = temporalAudit(auditedClaims, sourceMap, payload, options);
  const recommendation = recommendationAudit(payload);
  for (const issue of temporal) {
    const claim = auditedClaims.find((item) => item.id === issue.claimId);
    if (claim) {
      claim.status = issue.code.includes("CONFLICT") ? "CONFLICTED" : "UNSUPPORTED";
      claim.auditorResult = claim.status;
      claim.confidence = .1;
      claim.findings.push(issue);
    }
  }
  const findings = [
    ...auditedClaims.flatMap((claim) => claim.findings),
    ...contradictions,
    ...temporal,
    ...recommendation
  ];
  const finalStatus = findings.some((item) => item.severity === "CRITICAL") ? "UNSUPPORTED"
    : findings.some((item) => item.code.includes("CONFLICT")) ? "CONFLICTED"
      : auditedClaims.some((item) => ["UNVERIFIED", "UNSUPPORTED"].includes(item.status)) ? "UNVERIFIED"
        : auditedClaims.every((item) => item.status === "VERIFIED") ? "VERIFIED" : "SUPPORTED";

  return {
    claims: auditedClaims,
    auditors: {
      source: summarize(auditedClaims.flatMap((claim) => claim.auditors.source)),
      hallucination: summarize(auditedClaims.flatMap((claim) => claim.auditors.hallucination)),
      financial: summarize(auditedClaims.flatMap((claim) => claim.auditors.financial)),
      contradiction: summarize(contradictions),
      temporal: summarize(temporal),
      recommendation: summarize(recommendation),
      citationIntegrity: summarize(auditedClaims.flatMap((claim) => claim.auditors.citationIntegrity))
    },
    findings,
    finalStatus
  };
}

function auditClaim(claim, sourceMap, duplicateIds, payload) {
  const sourceFindings = [];
  const hallucinationFindings = [];
  const financialFindings = [];
  const citationFindings = [];
  const source = sourceMap.get(claim.sourceId);
  let status = claim.type === "SUBJECTIVE" ? "SUPPORTED" : "UNVERIFIED";

  if (!claim.sourceId || !source) {
    sourceFindings.push(finding("SOURCE_UNAVAILABLE", claim, null, "Referenced evidence source is unavailable.", materiality(claim)));
    hallucinationFindings.push(finding("MISSING_SOURCE", claim, null, "Claim has no existing evidence source.", materiality(claim)));
    status = claim.type === "FACTUAL" ? "UNSUPPORTED" : "UNVERIFIED";
  } else if (duplicateIds.has(claim.sourceId)) {
    citationFindings.push(finding("DUPLICATE_SOURCE_CONFLICT", claim, source, "Source ID is duplicated and ambiguous.", "MAJOR"));
    status = "CONFLICTED";
  } else {
    const facts = Array.isArray(source.facts) ? source.facts : [];
    const sameMetric = facts.filter((fact) => normalized(fact.metric) === normalized(claim.metric));
    const aligned = sameMetric.find((fact) => factAligned(claim, fact, payload));
    if (aligned && valuesEqual(claim, aligned)) {
      status = claim.type === "FACTUAL" ? "VERIFIED" : "SUPPORTED";
    } else if (aligned) {
      citationFindings.push(finding("VALUE_MISMATCH", claim, source, evidenceMessage(aligned), materiality(claim)));
      status = "UNSUPPORTED";
    } else if (sameMetric.length) {
      const fact = sameMetric[0];
      citationFindings.push(finding(alignmentCode(claim, fact, payload), claim, source, evidenceMessage(fact), materiality(claim)));
      status = "UNSUPPORTED";
    } else if (claim.type === "INTERPRETIVE" && faithfulParaphrase(claim.text, source.text)) {
      status = "SUPPORTED";
    } else {
      hallucinationFindings.push(finding("CLAIM_NOT_IN_EVIDENCE", claim, source, "Cited source does not contain aligned evidence.", materiality(claim)));
      status = claim.type === "SUBJECTIVE" ? "UNVERIFIED" : "UNSUPPORTED";
    }
  }

  if (claim.kind === "guidance") financialFindings.push(...guidanceAudit(claim, source));
  if (claim.kind === "beat_miss" && !claim.comparator) {
    financialFindings.push(finding("UNDEFINED_BEAT_COMPARATOR", claim, source, "Beat/miss claim must identify consensus, guidance, or prior-period comparator.", "MAJOR"));
    status = "UNSUPPORTED";
  }
  if (claim.type === "FACTUAL" && ["wacc", "terminal growth", "target multiple", "forecast margin"].includes(normalized(claim.metric))) {
    financialFindings.push(finding("ASSUMPTION_AS_FACT", claim, source, "Valuation assumption is presented as company-reported fact.", "MAJOR"));
    status = "UNSUPPORTED";
  }
  if (financialFindings.length) status = status === "CONFLICTED" ? status : "UNSUPPORTED";

  return {
    ...claim,
    status,
    confidence: status === "VERIFIED" ? 1 : status === "SUPPORTED" ? .7 : status === "CONFLICTED" ? .2 : .1,
    auditorResult: status,
    auditors: { source: sourceFindings, hallucination: hallucinationFindings, financial: financialFindings, citationIntegrity: citationFindings },
    findings: [...sourceFindings, ...hallucinationFindings, ...financialFindings, ...citationFindings]
  };
}

function contradictionAudit(claims, payload, sourceMap) {
  const findings = [];
  for (let i = 0; i < claims.length; i += 1) for (let j = i + 1; j < claims.length; j += 1) {
    const a = claims[i]; const b = claims[j];
    if (normalized(a.metric) === normalized(b.metric) && samePeriod(a.period, b.period) &&
        a.currency === b.currency && a.unit === b.unit && Number.isFinite(a.value) && Number.isFinite(b.value) && !valuesEqual(a, b)) {
      const aSource = sourceMap.get(a.sourceId); const bSource = sourceMap.get(b.sourceId);
      const primary = [aSource, bSource].find((source) => normalized(source?.type) === "primary");
      findings.push({
        ...pairFinding("INTERNAL_VALUE_CONTRADICTION", a, b, "Same metric and period have different values; provenance is preserved pending resolution.", materiality(a)),
        sourceIds: [a.sourceId, b.sourceId],
        primarySourceId: primary?.id || null
      });
    }
  }
  const scenarios = payload.scenarios || {};
  if ([scenarios.bear, scenarios.base, scenarios.bull].every(Number.isFinite) &&
      !(scenarios.bear <= scenarios.base && scenarios.base <= scenarios.bull)) {
    findings.push(genericFinding("SCENARIO_ORDER_CONTRADICTION", "Bear/Base/Bull values are not ordered.", "MAJOR"));
  }
  if ([scenarios.bear, scenarios.base, scenarios.bull].every(Number.isFinite) &&
      scenarios.bear === scenarios.base && scenarios.base === scenarios.bull) {
    findings.push(genericFinding("IDENTICAL_SCENARIOS", "Distinct scenarios contain identical values.", "MODERATE"));
  }
  return findings;
}

function temporalAudit(claims, sourceMap, payload, options) {
  const findings = [];
  const analysisDate = dateValue(payload.analysisDate);
  const maxAgeDays = options.maxSourceAgeDays ?? 550;
  for (const claim of claims) {
    const source = sourceMap.get(claim.sourceId);
    const sourceDate = dateValue(source?.date);
    if (analysisDate && sourceDate && sourceDate > analysisDate) findings.push(finding("FUTURE_SOURCE", claim, source, "Source date is after analysis date.", "MAJOR"));
    if (analysisDate && sourceDate && (analysisDate - sourceDate) / 86400000 > maxAgeDays && claim.current) findings.push(finding("STALE_CURRENT_CLAIM", claim, source, "Stale evidence is presented as current.", materiality(claim)));
    if (payload.companyId && source?.companyId && normalized(payload.companyId) !== normalized(source.companyId)) findings.push(finding("WRONG_COMPANY", claim, source, `Evidence belongs to ${source.companyId}, not ${payload.companyId}.`, "CRITICAL"));
  }
  return findings;
}

function recommendationAudit(payload) {
  const recommendation = normalized(payload.recommendation?.action);
  const price = Number(payload.marketPrice); const fairValue = Number(payload.fairValue);
  if (!recommendation || !Number.isFinite(price) || price <= 0 || !Number.isFinite(fairValue)) return [];
  const upside = (fairValue - price) / price;
  if (["buy", "strong buy"].includes(recommendation) && upside < -.1 && !payload.recommendation?.exceptionalReason) {
    return [genericFinding("BUY_WITH_DOWNSIDE", `BUY conflicts with ${(upside * 100).toFixed(1)}% modeled downside.`, "CRITICAL")];
  }
  if (recommendation === "sell" && upside > .2 && !payload.recommendation?.exceptionalReason) {
    return [genericFinding("SELL_WITH_UPSIDE", `SELL conflicts with ${(upside * 100).toFixed(1)}% modeled upside.`, "CRITICAL")];
  }
  return [];
}

function guidanceAudit(claim, source) {
  const findings = [];
  if (Number.isFinite(claim.low) && Number.isFinite(claim.high) && Number.isFinite(claim.midpoint) &&
      Math.abs(claim.midpoint - (claim.low + claim.high) / 2) > 1e-9) {
    findings.push(finding("GUIDANCE_MIDPOINT_ERROR", claim, source, "Guidance midpoint does not equal (low + high) / 2.", "MAJOR"));
  }
  if (claim.withdrawn && (Number.isFinite(claim.low) || Number.isFinite(claim.high))) {
    findings.push(finding("WITHDRAWN_GUIDANCE_AS_ACTIVE", claim, source, "Withdrawn guidance is represented as active.", "CRITICAL"));
  }
  return findings;
}

function factAligned(claim, fact, payload) {
  return samePeriod(claim.period, fact.period) &&
    equalOptional(claim.unit, fact.unit) && equalOptional(claim.currency, fact.currency) &&
    equalOptional(claim.accountingBasis, fact.accountingBasis) &&
    equalOptional(payload.companyId, fact.companyId);
}
function valuesEqual(a, b) {
  if (Number.isFinite(a.value) || Number.isFinite(b.value)) return Number.isFinite(a.value) && Number.isFinite(b.value) && Math.abs(a.value - b.value) <= 1e-9 * Math.max(1, Math.abs(b.value));
  return normalized(a.text) === normalized(b.text);
}
function alignmentCode(claim, fact, payload) {
  if (!samePeriod(claim.period, fact.period)) return "PERIOD_MISMATCH";
  if (!equalOptional(claim.accountingBasis, fact.accountingBasis)) return "ACCOUNTING_BASIS_MISMATCH";
  if (!equalOptional(claim.unit, fact.unit)) return "UNIT_MISMATCH";
  if (!equalOptional(claim.currency, fact.currency)) return "CURRENCY_MISMATCH";
  if (!equalOptional(payload.companyId, fact.companyId)) return "WRONG_COMPANY";
  return "SOURCE_ALIGNMENT_MISMATCH";
}
function faithfulParaphrase(claim, evidence) {
  const evidenceTokens = new Set(normalized(evidence).split(/\s+/).filter((token) => token.length > 3));
  const claimTokens = normalized(claim).split(/\s+/).filter((token) => token.length > 3);
  return claimTokens.length > 0 && claimTokens.filter((token) => evidenceTokens.has(token)).length / claimTokens.length >= .6;
}
function normalizeClaim(claim, index) {
  return {
    id: String(claim?.id || `CLAIM-${index + 1}`), text: String(claim?.text || ""), type: CLAIM_TYPES.includes(claim?.type) ? claim.type : "FACTUAL",
    metric: String(claim?.metric || ""), value: Number.isFinite(claim?.value) ? claim.value : claim?.value,
    unit: claim?.unit ?? null, currency: claim?.currency ?? null, period: claim?.period ?? null,
    accountingBasis: claim?.accountingBasis ?? null, sourceId: claim?.sourceId ?? null,
    kind: claim?.kind ?? null, current: Boolean(claim?.current), low: claim?.low ?? null, high: claim?.high ?? null,
    midpoint: claim?.midpoint ?? null, withdrawn: Boolean(claim?.withdrawn), comparator: claim?.comparator ?? null
  };
}
function finding(code, claim, source, evidence, severity) { return { code, claimId: claim.id, claim: claim.text, sourceId: source?.id || claim.sourceId || null, evidence, period: claim.period, severity }; }
function pairFinding(code, a, b, evidence, severity) { return { code, claimIds: [a.id, b.id], claims: [a.text, b.text], evidence, severity }; }
function genericFinding(code, evidence, severity) { return { code, evidence, severity }; }
function materiality(claim) { return ["revenue", "eps", "guidance", "debt", "cash", "fair value", "recommendation"].includes(normalized(claim.metric)) ? "CRITICAL" : "MAJOR"; }
function evidenceMessage(fact) { return `Evidence found: ${fact.value ?? fact.text ?? "different claim"}; period ${fact.period || "unspecified"}; basis ${fact.accountingBasis || "unspecified"}.`; }
function summarize(findings) { return { passed: findings.length === 0, findingCount: findings.length, findings }; }
function normalized(value) { return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " "); }
function equalOptional(a, b) { return !a || !b || normalized(a) === normalized(b); }
function samePeriod(a, b) { return equalOptional(a, b); }
function dateValue(value) { const parsed = Date.parse(value || ""); return Number.isFinite(parsed) ? parsed : null; }
