import { Agent, run } from '@openai/agents';
import { codexTool } from '@openai/agents-extensions/experimental/codex';
import { z } from 'zod';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = process.env.GITHUB_WORKSPACE || path.resolve(here, '../..');
const outputDir = process.env.ORCHESTRATOR_OUTPUT_DIR || path.join(repoRoot, '.orchestrator-run');
const task = (process.env.ORCHESTRATOR_TASK || process.argv.slice(2).join(' ')).trim();
const maxRounds = Math.max(1, Math.min(6, Number(process.env.ORCHESTRATOR_MAX_ROUNDS || 3)));
const managerModel = process.env.ORCHESTRATOR_MANAGER_MODEL || 'gpt-5.6-sol';
const codexModel = process.env.ORCHESTRATOR_CODEX_MODEL || 'gpt-5.4';
const allowSelfModify = String(process.env.ALLOW_SELF_MODIFY || '').toLowerCase() === 'true';

if (!task) {
  throw new Error('ORCHESTRATOR_TASK is required.');
}
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is required for the Executive AI and reviewers.');
}
if (!process.env.CODEX_API_KEY) {
  process.env.CODEX_API_KEY = process.env.OPENAI_API_KEY;
}

fs.mkdirSync(outputDir, { recursive: true });
const charter = fs.readFileSync(path.join(repoRoot, 'orchestrator', 'EXECUTIVE_CHARTER.md'), 'utf8');

const PlanSchema = z.object({
  objective: z.string(),
  acceptanceCriteria: z.array(z.string()).min(1),
  constraints: z.array(z.string()),
  uxRequirements: z.array(z.string()),
  financialBoundaries: z.array(z.string()),
  testPlan: z.array(z.string()),
});

const ReviewSchema = z.object({
  status: z.enum(['PASS', 'FAIL']),
  summary: z.string(),
  findings: z.array(z.object({
    severity: z.enum(['critical', 'high', 'medium', 'low']),
    area: z.string(),
    detail: z.string(),
    evidence: z.string(),
  })),
  requiredFixes: z.array(z.string()),
});

const DecisionSchema = z.object({
  status: z.enum(['APPROVE', 'REWORK', 'BLOCK']),
  summary: z.string(),
  reasons: z.array(z.string()),
  codexInstructions: z.array(z.string()),
});

const planner = new Agent({
  name: 'Franklin Product Manager',
  model: managerModel,
  outputType: PlanSchema,
  instructions: `
You are the product manager for Franklin, an Arabic-first investment-analysis application.
Convert the owner's high-level request into an implementation brief for Codex.
Do not invent investment conclusions or financial assumptions.
Treat the Executive Charter below as higher authority than older repository documents when they conflict.
Protect RTL Arabic, mobile usability, backward compatibility, data safety, and existing financial contracts.
Acceptance criteria must be objectively reviewable.

EXECUTIVE CHARTER:\n${charter}
`,
});

const productReviewer = new Agent({
  name: 'Franklin Product and UX Reviewer',
  model: managerModel,
  outputType: ReviewSchema,
  instructions: `
You are an independent product and UX reviewer. You did not implement the change.
Return FAIL for missing acceptance criteria, broken product behavior, unnecessary scope expansion, weak mobile behavior, or RTL/bidirectional text regressions.
Use only the evidence supplied in the review bundle. Do not assume a change works because tests pass.
Critical/high findings must appear in requiredFixes.
`,
});

const financialReviewer = new Agent({
  name: 'Franklin Financial Governance Reviewer',
  model: managerModel,
  outputType: ReviewSchema,
  instructions: `
You independently enforce the Fair Value financial authority boundary.
Franklin and Codex may verify arithmetic and implement supplied specifications, but they must not originate or silently change valuation methods, Bear/Base/Bull judgments, probabilities, fair values, recommendations, company KPIs, guidance interpretation, thesis impact, risks, or catalysts.
Fail any change that moves financial judgment into deterministic app code when the task did not explicitly supply that analyst judgment.
Also fail invented company data, unsafe JSON-contract changes, or loss of historical data.
If the change is unrelated to finance and preserves the boundary, say PASS.

EXECUTIVE CHARTER:\n${charter}
`,
});

const qaReviewer = new Agent({
  name: 'Franklin QA and Security Reviewer',
  model: managerModel,
  outputType: ReviewSchema,
  instructions: `
You are the independent QA/security reviewer for a production investment application.
Review the supplied diff and gate outputs for correctness, edge cases, state migration risk, security, secret leakage, data loss, error handling, maintainability, and regression risk.
Passing automated tests is necessary but not sufficient.
Return concise, actionable findings backed by supplied evidence.
`,
});

const executive = new Agent({
  name: 'Franklin Executive AI',
  model: managerModel,
  outputType: DecisionSchema,
  instructions: `
You are the final executive release authority for Franklin.
You coordinate product, financial governance, engineering, and QA.
Never APPROVE when a deterministic gate failed, a protected path was changed without authorization, or any reviewer has unresolved critical/high findings.
For REWORK, give Codex a small ordered set of precise fixes, not a redesign.
Use BLOCK only when the task cannot be safely completed under the charter.

EXECUTIVE CHARTER:\n${charter}
`,
});

const codexContext = {};
const engineer = new Agent({
  name: 'Franklin Codex Engineering Dispatcher',
  model: managerModel,
  instructions: `
You dispatch repository implementation to the Codex tool. You MUST use the Codex tool for each engineering turn.
Tell Codex to inspect before editing, implement the supplied brief, run targeted checks while working, avoid commits/pushes, and obey the Executive Charter.
Do not substitute your own hypothetical code for a real Codex workspace edit.
`,
  modelSettings: { toolChoice: 'required' },
  tools: [
    codexTool({
      name: 'engineer',
      useRunContextThreadId: true,
      sandboxMode: 'workspace-write',
      workingDirectory: repoRoot,
      defaultThreadOptions: {
        model: codexModel,
        approvalPolicy: 'never',
        networkAccessEnabled: false,
        webSearchEnabled: false,
      },
    }),
  ],
});

function crop(value, max = 120000) {
  const text = String(value || '');
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n...[truncated ${text.length - max} chars]`;
}

function command(commandName, args, { max = 120000 } = {}) {
  const result = spawnSync(commandName, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    env: process.env,
  });
  const output = crop(`${result.stdout || ''}${result.stderr || ''}`, max);
  return {
    pass: result.status === 0,
    exitCode: result.status ?? -1,
    command: [commandName, ...args].join(' '),
    output,
  };
}

function git(args, options = {}) {
  return command('git', args, options);
}

function changedFiles(baselineSha) {
  const result = git(['diff', '--name-only', baselineSha], { max: 30000 });
  if (!result.pass) throw new Error(`Unable to list changed files: ${result.output}`);
  return result.output.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function protectedViolations(files) {
  if (allowSelfModify) return [];
  return files.filter((file) => file === '.github/workflows/ai-orchestrator.yml' || file.startsWith('orchestrator/'));
}

function runGates(baselineSha) {
  const files = changedFiles(baselineSha);
  const violations = protectedViolations(files);
  return {
    files,
    protectedPaths: {
      pass: violations.length === 0,
      violations,
    },
    gates: [
      { name: 'Diff whitespace validation', ...git(['diff', '--check', baselineSha]) },
      { name: 'Production build', ...command('npm', ['run', 'build']) },
      { name: 'Full regression suite', ...command('npm', ['test']) },
    ],
  };
}

function buildReviewBundle({ plan, round, baselineSha, engineeringOutput, gateResult }) {
  const stat = git(['diff', '--stat', baselineSha], { max: 30000 });
  const diff = git(['diff', '--no-ext-diff', '--unified=2', baselineSha], { max: 150000 });
  return {
    ownerTask: task,
    round,
    plan,
    engineeringOutput: crop(engineeringOutput, 20000),
    changedFiles: gateResult.files,
    protectedPaths: gateResult.protectedPaths,
    diffStat: stat.output,
    diff: diff.output,
    deterministicGates: gateResult.gates.map((gate) => ({
      name: gate.name,
      pass: gate.pass,
      exitCode: gate.exitCode,
      output: crop(gate.output, 35000),
    })),
  };
}

function hasHighSeverity(review) {
  return review.findings.some((finding) => finding.severity === 'critical' || finding.severity === 'high');
}

function hardFailure(gateResult, reviews) {
  return !gateResult.protectedPaths.pass
    || gateResult.gates.some((gate) => !gate.pass)
    || Object.values(reviews).some((review) => review.status === 'FAIL' || hasHighSeverity(review));
}

function engineeringPrompt(plan, round, rework = []) {
  return `
Work on Franklin repository task, round ${round} of ${maxRounds}.

OWNER TASK:
${task}

APPROVED PRODUCT BRIEF:
${JSON.stringify(plan, null, 2)}

EXECUTIVE CHARTER:
${charter}

${rework.length ? `REWORK REQUIRED:\n- ${rework.join('\n- ')}` : 'This is the first implementation pass.'}

Implementation rules:
- Inspect relevant files and existing tests before editing.
- Make the smallest coherent production-quality change that meets all acceptance criteria.
- Preserve existing data and backward compatibility unless explicitly required otherwise.
- Never invent investment judgments or company data.
- Do not modify orchestrator/ or .github/workflows/ai-orchestrator.yml.
- Do not commit or push. The outer workflow owns Git operations.
- Run targeted tests while working, then stop and report exactly what changed and what remains uncertain.
`;
}

function markdownReport({ plan, rounds, finalDecision, approved }) {
  const lines = [
    '# Franklin AI Executive Run',
    '',
    `**Status:** ${approved ? 'APPROVED' : 'NOT APPROVED'}`,
    '',
    '## Owner task',
    '',
    task,
    '',
    '## Product brief',
    '',
    `- Objective: ${plan.objective}`,
    ...plan.acceptanceCriteria.map((item) => `- Acceptance: ${item}`),
    '',
  ];

  for (const item of rounds) {
    lines.push(`## Round ${item.round}`, '');
    lines.push(`- Protected paths: ${item.gateResult.protectedPaths.pass ? 'PASS' : 'FAIL'}`);
    for (const gate of item.gateResult.gates) {
      lines.push(`- ${gate.name}: ${gate.pass ? 'PASS' : 'FAIL'}`);
    }
    for (const [name, review] of Object.entries(item.reviews)) {
      lines.push(`- ${name}: ${review.status} — ${review.summary}`);
    }
    lines.push(`- Executive: ${item.decision.status} — ${item.decision.summary}`, '');
  }

  lines.push('## Final executive decision', '', finalDecision.summary, '');
  if (finalDecision.reasons.length) {
    lines.push('### Reasons', '', ...finalDecision.reasons.map((reason) => `- ${reason}`), '');
  }
  return `${lines.join('\n')}\n`;
}

const baselineResult = git(['rev-parse', 'HEAD']);
if (!baselineResult.pass) throw new Error(baselineResult.output);
const baselineSha = baselineResult.output.trim();

console.log(`[orchestrator] Planning task with ${managerModel}`);
const planRun = await run(planner, task);
const plan = planRun.finalOutput;
if (!plan) throw new Error('Planner returned no implementation brief.');

const rounds = [];
let rework = [];
let finalDecision = {
  status: 'BLOCK',
  summary: 'The orchestration loop did not complete.',
  reasons: ['No completed decision.'],
  codexInstructions: [],
};
let approved = false;

for (let round = 1; round <= maxRounds; round += 1) {
  console.log(`[orchestrator] Codex engineering round ${round}/${maxRounds}`);
  const engineeringRun = await run(engineer, engineeringPrompt(plan, round, rework), { context: codexContext });
  const engineeringOutput = String(engineeringRun.finalOutput || 'Codex completed without a textual summary.');

  console.log('[orchestrator] Running deterministic gates');
  const gateResult = runGates(baselineSha);
  const bundle = buildReviewBundle({ plan, round, baselineSha, engineeringOutput, gateResult });
  const reviewInput = JSON.stringify(bundle, null, 2);

  console.log('[orchestrator] Running independent Product, Financial, and QA reviews');
  const [productRun, financialRun, qaRun] = await Promise.all([
    run(productReviewer, reviewInput),
    run(financialReviewer, reviewInput),
    run(qaReviewer, reviewInput),
  ]);

  const reviews = {
    product: productRun.finalOutput,
    financial: financialRun.finalOutput,
    qa: qaRun.finalOutput,
  };
  if (!reviews.product || !reviews.financial || !reviews.qa) {
    throw new Error('A required reviewer returned no structured result.');
  }

  const execInput = JSON.stringify({
    task,
    plan,
    round,
    maxRounds,
    protectedPaths: gateResult.protectedPaths,
    deterministicGates: gateResult.gates.map(({ name, pass, exitCode, output }) => ({ name, pass, exitCode, output: crop(output, 20000) })),
    reviews,
    changedFiles: gateResult.files,
  }, null, 2);

  const executiveRun = await run(executive, execInput);
  let decision = executiveRun.finalOutput;
  if (!decision) throw new Error('Executive AI returned no decision.');

  if (hardFailure(gateResult, reviews) && decision.status === 'APPROVE') {
    decision = {
      status: 'REWORK',
      summary: 'Approval overridden because mandatory gates or independent reviews failed.',
      reasons: ['Hard release gates are deterministic and cannot be overridden by the model.'],
      codexInstructions: [
        ...Object.values(reviews).flatMap((review) => review.requiredFixes),
        ...gateResult.gates.filter((gate) => !gate.pass).map((gate) => `Fix failing gate: ${gate.name}.`),
      ],
    };
  }

  rounds.push({ round, engineeringOutput, gateResult, reviews, decision });
  finalDecision = decision;

  if (decision.status === 'APPROVE' && !hardFailure(gateResult, reviews)) {
    approved = true;
    break;
  }
  if (decision.status === 'BLOCK') {
    break;
  }

  rework = [
    ...decision.codexInstructions,
    ...Object.values(reviews).flatMap((review) => review.requiredFixes),
    ...gateResult.gates.filter((gate) => !gate.pass).map((gate) => `Resolve ${gate.name}: ${crop(gate.output, 4000)}`),
  ].filter(Boolean);
}

const report = markdownReport({ plan, rounds, finalDecision, approved });
const jsonReport = {
  task,
  managerModel,
  codexModel,
  maxRounds,
  approved,
  plan,
  rounds,
  finalDecision,
};

fs.writeFileSync(path.join(outputDir, 'report.md'), report);
fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(jsonReport, null, 2)}\n`);
fs.writeFileSync(path.join(outputDir, 'pr-body.md'), `${report}\n---\nGenerated by Franklin AI Executive Orchestrator V1.\n`);

console.log(report);
if (!approved) {
  process.exitCode = 1;
}
