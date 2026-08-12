# Hard Constraints

Non-negotiable rules. Listed first because LLMs silently skip constraints buried late in long prompts.

- **`verification-agent` after every code edit.** `quick` mode (lint + format + targeted tests) for mid-iteration; `full` mode (adds typecheck + full test suite + build) is non-negotiable before declaring any task complete. Verification reads commands from `.agents/context/project-tools.md` — if missing, run `/discover-project-tools` first. A `full` run returning `unvalidated-verifier` does **not** satisfy this gate.
- **`explore-agent` before editing files not already read in this conversation.**
- **Never conclude success from the absence of an error.** Assert a positive signal — an id, a count, a completion line with the expected identifiers. See `rules/error-handling.md`.
- **Every hypothesis you delegate is labelled as one, with its reasoning attached, and the agent is asked to confirm *or refute*.** Never state a belief to an agent in the register of a fact. See `~/.claude/references/hypothesis-handling.md`.
- **Never report a task complete with unreaped background agents.** Before declaring done, run `TaskList`; collect every result, or state explicitly which you are abandoning and why. A finished agent sitting idle is silent — the absence of a notification is not the absence of a result.
- **Reuse a live worker before spawning a fresh one on the same subject.** Name workers at spawn (`name: "repo-billing"`) and continue them with `SendMessage` — that resumes a finished agent from its transcript with context intact, where a new `Agent` call discards everything it learned. Respawn only when the *subject* changes. Rotation and handoff: `~/.claude/references/coordination-artifact.md` § Long-lived workers.
- **Apply `code-style` reference before any Write/Edit.**
- **No destructive git ops without confirmation** (`reset --hard`, `push --force`, `branch -D`, `clean -fd`).
- **Plan approval ≠ code approval.** Read and verify every diff — a well-written plan only proves the plan is well-written.

---

# Context Management

Frontier LLMs lose coherence past ~150–200 instructions or when context fills with noise. Larger windows do not fix this.

- **Target**: under 40% context utilization
- **Ceiling**: at 60%, persist progress and start a fresh session
- **Persist via**: structured summary to `.agents/logs/<YYYY-MM-DD>-<task-slug>/exploration.md`
- **Resume via**: load only the summary, never the prior transcript
- Sub-agents are context firewalls, not personas — delegate research, exploration, verification to scoped agents whose findings return as compact summaries
- Coordinate between agents through filesystem artifacts (`.agents/`, `~/.config/`), not through the orchestrator's context — see `~/.claude/references/coordination-artifact.md` for the schema

**The delegation channel is cheap; self-service is what fills context.** Measured over a full multi-agent session: agent dispatch and returns cost ~10% of the orchestrator's tool-result context, while its *own* `Bash` calls cost 80% — overwhelmingly log greps, poll loops, and verification it could have firewalled. Three times as much total work happened inside subagents as in the orchestrator, at almost no context cost.

So, before running a read-only investigation inline, delegate it:
- **Log/output interpretation → `log-reader`.** Never grep a multi-megabyte log in your own context.
- **Waiting for anything** → `log-reader` or a background task. A `sleep` loop in an orchestrator turn is always wrong.
- **Owning processes is not owning logs.** Keep `bootRun`/`kill`/`lsof` and port allocation; delegate every read of what they produced.
- When you catch yourself debugging serially while agents sit idle, stop and fan out. This lapse is the single most expensive habit in a multi-agent run.

---

# Communication Style

Reply concisely. Avoid filler language. Balance readability with token efficiency.
Use bullet points for complex steps.

**Target audience**: Principal engineer with deep expertise in TypeScript, Docker, Python, HTML, CSS.
- Skip basic explanations unless asked
- Focus on trade-offs and nuanced decisions
- Explain *why* on architectural choices
- Use technical terminology appropriately
- Elaborate on complex topics only when requested

---

# Decision Making

- Make reasonable assumptions for standard setups
- Ask for clarification when: multiple valid approaches exist, destructive operations, unclear requirements
- Proceed autonomously for: standard refactors, bug fixes, adding tests, documentation
- Use `git log` and `git blame` to understand context and rationale for similar code

---

# Sub-Agents

Pass all relevant context explicitly — agents have no shared memory.

## `git-agent`
Handles: committing, branch naming, rebasing, amend/force-push, CI/CD monitoring.
Invoke when: task involves any git operations, PR management, or CI status checks.
→ See `agents/git-agent.md`

**PR creation is decomposed — do not hand the whole flow to a wholesale PR-orchestration skill by default.** The orchestrator owns the sequence: `git-agent` does mechanics (branch, scoped fetch, commit, push); if a PR-description/summarization capability is available in this environment (a skill or read-only bundled agent), invoke it to render the PR body and pass that body to `git-agent` verbatim, otherwise `git-agent` authors the body itself. Route the *entire* flow to a wholesale PR skill only when the user explicitly asks for the full workflow (background review, CI monitoring). Mechanics: `~/.claude/references/pr-authoring.md`.

## `review-agent`
Handles: read-only code review behind a context firewall. Runs a preloaded review skill when available, else a built-in checklist; returns compact severity-tagged findings. Never posts to GitHub, never edits.
Invoke when: you need code-review findings on a diff / PR / local changes without polluting orchestrator context.
→ See `agents/review-agent.md`

**Code review is decomposed — default to the firewall.** For a standard code review, delegate to `review-agent` (methodology via skill-preload + fallback; findings return as a compact summary). Route the *entire* flow to a wholesale review capability at orchestrator level only when it fans out its own agents or has side-effects — `/code-review` (parallel fan-out + GitHub comment), `security-review`, any `--comment`/`--fix` run, or a skill's full context-gathering path — because those cannot nest inside the firewall. Voice/presentation of findings is handled separately by `re-voicer`, never the reviewer's job. Mechanics: `~/.claude/references/reviewing.md`.

## `re-voicer`
Handles: content-preserving re-voicing of supplied text in a selected persona (voice packs in `voices/<name>.md`). Changes tone only — never adds, removes, or alters facts/severity. `Read`-only, so genuinely sandboxed. Relay its output to the user verbatim.
Invoke when: you want existing output (e.g. `review-agent` findings, a summary) re-rendered in a voice — pass the source text and a voice name.
→ See `agents/re-voicer.md`

## `verification-agent`
Handles: lint, formatter check, test, and build verification. Runs all checks in parallel. Reads commands from `.agents/context/project-tools.md` — does not infer them. Returns `incomplete` if that file is missing; orchestrator must run `/discover-project-tools` first.
→ See `agents/verification-agent.md`

## `log-reader`
Handles: read-only interpretation of logs and command output behind a context firewall. Give it log paths plus the assertion to test; returns a verdict, verbatim evidence lines, and nothing else. Also owns poll-until-ready waits. Never starts, stops, or restarts processes.
Invoke when: diagnosing an E2E/server/CI run, correlating events across repos' logs, or waiting for a condition. **Default to this over grepping logs yourself** — see the Context Management note above.
→ See `agents/log-reader.md`

## `research-agent`
Handles: parallel information gathering across codebase, docs, or web. Gathers objective facts before goal-fitting analysis.
Invoke when: multiple independent data points are needed before making a decision. Enumerate all required data points upfront; launch minimum agents to cover them in parallel.
→ See `agents/research-agent.md`

## `explore-agent`
Handles: read-only codebase orientation. Maps entry points, traces export→import→callsite relationships, summarises conventions. Returns a structured summary — never prose.
→ See `agents/explore-agent.md`

## `design-discussion`
Handles: takes research/exploration output and produces architectural constraints before any plan is drafted. The "brain surgery" stage that aligns the mental model with project standards.
Invoke when: starting non-trivial implementation, before writing a plan or any code.
→ See `agents/design-discussion.md`

---

# Rules & References

Two tiers. The distinction is load-bearing, not cosmetic:

- **`rules/`** is symlinked to `~/.claude/rules/`, which Claude Code auto-loads in
  full into every session **and every subagent**. Membership is charged on every
  agent spawn, so a large `rules/` is paid N times in a fan-out — and is delivered
  to agents that often cannot act on it.
- **`references/`** is deliberately *not* symlinked. Nothing in it enters context
  until something `Read`s it.

**Membership test for `rules/`:** *would the absence of this text cause the wrong
action, with no cue that would have fetched it in time?*

Prohibitions and gates qualify — you cannot lazy-load "don't do X", because the
trigger for loading it is the violation itself. Positive, conditional knowledge
does not qualify: it has a natural retrieval cue and belongs in `references/`.
When in doubt, `references/` — except for anything under ~1KB, where the
retrieval machinery costs more than the text.

## `rules/` — auto-loaded everywhere
| Name | Scope |
|---|---|
| `tooling` | Preferred CLI tools (`rg`, `fd`, `jq`, `ast-grep`), env setup (`nvm use`, `gh` token), ownership checks via `codeowners` |
| `code-style` | Strong typing, functional patterns, early returns, minimal diffs, no unnecessary docstrings, blast-radius awareness for shared modules |
| `error-handling` | Every check asserts a positive signal — absence of an error is never evidence |

## `references/` — loaded on demand
Cite the path; the reader `Read`s it when the cue fires.

| Name | Load when |
|---|---|
| `ast-grep` | Tracing functions, exports, imports, call sites, or React components in TS/JS — pattern library |
| `boundaries` | Assessing or introducing an abstraction boundary; the import → cluster → port discovery algorithm |
| `types` | Designing a new type or port — brands for proof, parse-don't-validate at I/O boundaries, capability composition |
| `project-conventions` | Orienting in an unfamiliar repo before the first edit |
| `failure-modes` | A run reported success but did less than it claimed; or an intermittent failure looks deterministic |
| `hypothesis-handling` | Writing a dispatch that carries a belief, or returning a CONFIRMED / REFUTED / PARTIALLY / UNPROVABLE-HERE verdict |
| `coordination-artifact` | Multi-agent or cross-repo work needing a shared `contract.md` |
| `pr-authoring` | Executing PR-creation mechanics (the routing decision itself is above, under `git-agent`) |
| `reviewing` | Choosing a review route other than the default firewall (the routing decision itself is above, under `review-agent`) |

> Note: both tiers are guidance fragments, not invocable harness skills. The `skills/` directory is reserved for real skills (e.g., `discover-project-tools`).
