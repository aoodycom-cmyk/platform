# Franklin AI Executive Orchestrator V1

This folder removes the owner from the day-to-day relay loop between ChatGPT-class reasoning and Codex engineering.

## What V1 does

A high-level owner task is converted into a product brief, implemented in the real Franklin repository by Codex, validated by deterministic gates, reviewed independently, and accepted or sent back for repair.

```text
Owner task
   ↓
Product Manager (GPT)
   ↓
Codex Engineer
   ↓
Build + full Franklin tests + diff checks
   ↓
Product/UX Reviewer ─┐
Financial Reviewer ──┼─→ Executive AI
QA/Security Reviewer ┘        │
                         REWORK│APPROVE
                              ↓
                         Pull Request
```

The current ChatGPT app session is not kept alive in the background. The autonomous runtime uses the OpenAI Agents SDK with a GPT executive model and the Codex SDK/tool inside GitHub Actions. This is the reliable way to create an unattended loop.

## One-time setup

Add this GitHub Actions repository secret:

- `OPENAI_API_KEY` — required by the Executive AI and reviewers.

Optional:

- `CODEX_API_KEY` — if omitted, the runtime uses `OPENAI_API_KEY` for Codex as supported by the Codex tool.

No API key is committed to the repository.

## Starting a task

### From GitHub Actions

Run **Franklin AI Executive Orchestrator** manually and provide a high-level task.

### From an owner GitHub issue

Open an issue from the repository owner account whose title begins with:

```text
[AI BUILD]
```

Example:

```text
[AI BUILD] Improve the company report mobile hierarchy without changing financial logic
```

The issue body can contain requirements and screenshots/acceptance details. Public users cannot trigger the AI workflow because the workflow verifies that the issue author is the repository owner.

## Acceptance policy

V1 never pushes a failed implementation. Before a Pull Request is created, all of these must pass:

1. protected-path check;
2. `git diff --check`;
3. `npm run build`;
4. the complete existing `npm test` suite;
5. Product/UX review;
6. Financial-governance review;
7. QA/security review;
8. final Executive AI decision.

A model cannot override a failed hard gate in code.

## Financial governance

`EXECUTIVE_CHARTER.md` is the authority for orchestration. Fair Value / ChatGPT owns financial judgment. Franklin and Codex implement supplied specifications, validate arithmetic, store data, and present results; they do not invent or silently alter investment judgments.

## Repair loop

The default maximum is three Codex rounds. A failing review is converted into precise repair instructions and sent back into the same Codex thread. If the task still fails after the allowed rounds, no branch is pushed and no Pull Request is created. The workflow keeps an evidence report as a short-lived GitHub Actions artifact.

## Models

Defaults are intentionally configurable through environment variables:

- `ORCHESTRATOR_MANAGER_MODEL` defaults to `gpt-5.6-sol`.
- `ORCHESTRATOR_CODEX_MODEL` defaults to `gpt-5.4`, matching the documented Codex-tool example at the time V1 was created.

This prevents the architecture from being tied permanently to one Codex model name.

## V1 safety choice

An approved run opens a Pull Request but does not auto-merge or auto-deploy. Once several real tasks prove the review loop is reliable, automatic merge can be added as a separate release policy behind the same mandatory gates.
