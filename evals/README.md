# Routing Eval Harness

Verifies Claude Code's orchestrator routes user prompts to the expected subagent based on each agent's `description` frontmatter. Catches regressions from description drift, overlapping triggers, or model updates.

## What this actually tests

The eval measures the **combined contract** of:

1. Each agent's `description` frontmatter field (used by the orchestrator to decide routing)
2. Each agent's `name` field (must match `tool_use.input.subagent_type` returned by the SDK)
3. Project `.agents/AGENTS.md` routing guidance (loaded via `settingSources: ["project"]`)

A failure could mean any of these is at fault. The triage table below maps symptoms to likely causes.

Behaviour evals (does the agent do its job correctly once invoked?) are **out of scope**. We only test what gets routed to.

## Running

```bash
cd evals
bun run eval                    # full suite, samples=5, budget=$10
bun run eval --case <id>        # single case
bun run eval --filter <substr>  # all cases whose id contains substr
bun run eval --samples 3        # lower sample count, faster but noisier
bun run eval --budget 25        # raise budget cap
bun run eval --concurrency 2    # fewer parallel samplers
bun run eval --model haiku      # cheaper but worse routing
bun run eval --verbose          # per-job logging
bun run eval --help
```

Defaults: `samples=5`, `budget=$10` estimated, `concurrency=4`, `model=sonnet`.

Each sample observes the orchestrator's first `Agent`/`Skill` `tool_use` block, then aborts via `AbortController` (saves cost and prevents post-routing flailing). Subagents never execute — a `PreToolUse` hook denies `Agent`, `Skill`, `Bash`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`. `Read`, `Grep`, `Glob` stay allowed so the orchestrator can do realistic pre-routing inspection.

Exit code is non-zero on any context failure or budget overrun.

## Two contexts per run

| Context | Agents registered | Tests |
|---|---|---|
| **Closed-world** | only the 7 in `.agents/agents/` | intrinsic description clarity — does our description trigger when nothing else competes? |
| **Open-world** | closed + 8 plugin/built-in competitors in `fixtures/open-world-agents/` | competitive distinctiveness — does our description still win when alternatives are visible? |

Each case runs `--samples` times in *each* context. Pass = majority vote of samples in that context. Quality = mean position rank (1.0 = first, 0.7 = second, 0.4 = third, …) across passing samples — informational, not pass-determining.

## Adding cases

Cases live in `cases/routing/<agent-name>.yaml` (skills can go in `cases/skills/`). Each file is a YAML array. Files auto-load recursively.

```yaml
- id: unique-case-id
  prompt: "what the user asks the orchestrator"
  expected: "agent:explore-agent"   # or "skill:foo" or null
  notes: |
    Why this should route there. Cite the agent description if possible.
```

### `expected:` syntax

- `"agent:<name>"` — orchestrator should call `Agent` with `subagent_type=<name>`
- `"skill:<plugin>:<skill>"` or `"skill:<skill>"` — orchestrator should call `Skill`
- `null` — orchestrator should answer directly (no agent or skill)

For plugin/built-in agents the namespaced form is what the orchestrator emits (e.g. `pr-review-toolkit:code-reviewer`), use that as `<name>`.

### Tips

- Don't write *"use the X agent to do Y"* — that's a tautology. Write the prompt as a real user would.
- For novelty agents (e.g. `bourgeoisie-reviewer`), include the explicit stylistic trigger in the prompt.
- For `expected: null`, use trivial prompts — greetings, factual recall, acknowledgements.
- Always fill `notes:`. Future failures need the context.
- IDs must be unique across the whole `cases/` tree.

## Triage guide

After a failure:

| Pattern | Likely cause | Action |
|---|---|---|
| Fails closed-world AND open-world (3/3 samples) | Description doesn't trigger | Tighten the description in `.agents/agents/<name>.md`. Look for "MUST invoke" patterns in agents that work. |
| Passes closed, fails open | Competitor agent in fixture has a stronger trigger for this prompt | Either tighten our description's distinctiveness, or accept and document. |
| Quality `1.00` but `pass=false` | Minority of samples passed (e.g. 1/3 = 0.33 majority) | Sampling noise. Bump `--samples`, or tighten the prompt. |
| All samples invoke a *different* agent | Two agents with overlapping descriptions | Sharpen the boundary in both descriptions, or merge them. |
| All samples invoke *nothing* (quality 0.00, no invocations) | Orchestrator answers directly — description lacks "MUST" force | Hardest cluster to fix. May not be solvable via description text alone. |
| Inconsistent across re-runs | Cache state varies; orchestrator non-determinism | Increase `--samples`. Routing is non-deterministic at default temperature. |

### Inspecting raw routing decisions for a single case

```bash
bun -e '
import { loadAgentsFromDir } from "./src/load-agents.ts";
import { loadCasesFromDir } from "./src/load-cases.ts";
import { runOne } from "./src/harness.ts";
const agents = await loadAgentsFromDir("../.agents/agents");
const cases = await loadCasesFromDir("./cases");
const c = cases.find((x) => x.id === "MY_CASE_ID")!;
const r = await runOne(c, agents);
console.log(r.invocations);
'
```

`r.invocations === []` means the orchestrator chose to answer directly.

## Maintaining the open-world fixture

The open-world context contains a snapshot of plugin/built-in "competitor" agents that would otherwise reach the user's session via plugins or built-ins. Refresh deliberately:

```bash
bun run scripts/refresh-open-world.ts
```

Recommended: refresh quarterly, or when adding new local agents that might collide with plugin agents. The script copies 4 plugin agents from `~/.claude/plugins/marketplaces/...` (rewriting their `name:` to the namespaced form the orchestrator uses) and synthesises 4 built-ins (`general-purpose`, `claude-code-guide`, `Plan`, `Explore`) from descriptions transcribed from Claude Code's orchestrator system prompt.

The fixture is checked in. If a plugin source path moves, update `PLUGIN_SOURCES` in `scripts/refresh-open-world.ts`.

## Cost model

The orchestrator's authoritative `total_cost_usd` arrives in the SDK's `result` message, which we never receive because we abort after the first routing decision. Cost is therefore **estimated** from per-message `usage` × per-million-token rates in `src/cost.ts`. Update those rates when pricing shifts.

Per-sample cost (Sonnet 4.6, as of 2026-01): ~$0.02–0.05 cold cache; ~$0.005 warm. Observed full-suite cost at samples=5 across both contexts: ~$3.30. Drops to ~$2 at samples=3.

## Smoke scripts (no full-suite cost)

- `scripts/smoke-loaders.ts` — verifies loaders find all 7 agents + 7 skills, runs one SDK round-trip to confirm hooks work. ~$0.05.
- `scripts/smoke-harness.ts` — runs `runOne` on one hand-crafted case end-to-end. ~$0.05.

Useful for sanity-checking SDK behaviour or loader changes without running the full suite.

## File layout

```
evals/
├── src/
│   ├── types.ts             # core types — EvalCase, ExpectedRoute, RawSample, …
│   ├── load-agents.ts       # parses .agents/agents/*.md (and any AgentDefinition dir)
│   ├── load-skills.ts       # parses .agents/skills/*.md
│   ├── load-fixture.ts      # binds load-agents to fixtures/open-world-agents
│   ├── load-cases.ts        # parses cases/**/*.yaml
│   ├── harness.ts           # runOne — one sample, one case
│   ├── sampler.ts           # runSamples — N samples, majority vote, quality
│   ├── runner.ts            # case selection, two-context dispatch, worker pool, budget cap
│   ├── cost.ts              # token → USD estimation
│   ├── report.ts            # tabular console output + suitePassed
│   └── cli.ts               # argv parsing
├── cases/
│   ├── routing/             # one YAML per agent + direct-answer.yaml
│   └── skills/              # reserved for future skill-routing cases
├── fixtures/
│   ├── open-world-agents/   # 8 competitor agents — refresh via scripts/refresh-open-world.ts
│   └── repos/               # reserved for future synthetic git repos (behaviour evals)
└── scripts/
    ├── refresh-open-world.ts
    ├── smoke-loaders.ts
    └── smoke-harness.ts
```

## Known limitations

- **Cold-context only.** The eval simulates routing without prior conversation context. Real usage may route differently when the orchestrator has hours of context loaded.
- **Routing-only.** No assertions on what the agent does once invoked — that requires sandboxed execution and is documented as future work in `.agent-shell/2026-05-07-evals-harness.md`.
- **Sonnet-pinned by default.** Other models may route differently. The `--model` flag exists but other-model results have not been baselined.
- **Skill machinery underexercised.** Skill-routing cases require well-defined explicit triggers; the seed dataset focuses on agent routing.

## Status & history

Latest baseline: `closed 18/26 (69%) | open 19/26 (73%)` — see `.agent-shell/2026-05-08-routing-eval-findings.md` for the breakdown of failures and proposed description tightening.
