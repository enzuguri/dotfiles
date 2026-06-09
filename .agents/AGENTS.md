# Hard Constraints

Non-negotiable rules. Listed first because LLMs silently skip constraints buried late in long prompts.

- **`verification-agent` after every code edit.** `quick` mode (lint + format + targeted tests) for mid-iteration; `full` mode (adds typecheck + full test suite + build) is non-negotiable before declaring any task complete. Verification reads commands from `.agents/context/project-tools.md` — if missing, run `/discover-project-tools` first.
- **`explore-agent` before editing files not already read in this conversation.**
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
- Coordinate between agents through filesystem artifacts (`.agents/`, `~/.config/`), not through the orchestrator's context

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

**PR creation is decomposed — do not hand the whole flow to a wholesale PR-orchestration skill by default.** The orchestrator owns the sequence: `git-agent` does mechanics (branch, scoped fetch, commit, push); if a PR-description/summarization capability is available in this environment (a skill or read-only bundled agent), invoke it to render the PR body and pass that body to `git-agent` verbatim, otherwise `git-agent` authors the body itself. Route the *entire* flow to a wholesale PR skill only when the user explicitly asks for the full workflow (background review, CI monitoring). Mechanics: `rules/pr-authoring.md`.

## `review-agent`
Handles: read-only code review behind a context firewall. Runs a preloaded review skill when available, else a built-in checklist; returns compact severity-tagged findings. Never posts to GitHub, never edits.
Invoke when: you need code-review findings on a diff / PR / local changes without polluting orchestrator context.
→ See `agents/review-agent.md`

**Code review is decomposed — default to the firewall.** For a standard code review, delegate to `review-agent` (methodology via skill-preload + fallback; findings return as a compact summary). Route the *entire* flow to a wholesale review capability at orchestrator level only when it fans out its own agents or has side-effects — `/code-review` (parallel fan-out + GitHub comment), `security-review`, any `--comment`/`--fix` run, or a skill's full context-gathering path — because those cannot nest inside the firewall. Voice/presentation of findings is handled separately by `re-voicer`, never the reviewer's job. Mechanics: `rules/reviewing.md`.

## `re-voicer`
Handles: content-preserving re-voicing of supplied text in a selected persona (voice packs in `voices/<name>.md`). Changes tone only — never adds, removes, or alters facts/severity. `Read`-only, so genuinely sandboxed. Relay its output to the user verbatim.
Invoke when: you want existing output (e.g. `review-agent` findings, a summary) re-rendered in a voice — pass the source text and a voice name.
→ See `agents/re-voicer.md`

## `verification-agent`
Handles: lint, formatter check, test, and build verification. Runs all checks in parallel. Reads commands from `.agents/context/project-tools.md` — does not infer them. Returns `incomplete` if that file is missing; orchestrator must run `/discover-project-tools` first.
→ See `agents/verification-agent.md`

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

# Rules

Shared guidance applied to all tasks. The summaries below are the operational content; full text lives in `~/.claude/rules/<name>.md` or `~/.cursor/rules/<name>.md` (same files, symlinked from dotfiles) and can be read on demand.

| Name | Scope |
|---|---|
| `tooling` | Preferred CLI tools (`rg`, `fd`, `jq`, `ast-grep`), env setup (`nvm use`, `gh` token), ownership checks via `codeowners` |
| `ast-grep` | Patterns for finding/tracing functions, exports, imports, call sites, React components in TS/JS |
| `code-style` | Strong typing, functional patterns, early returns, minimal diffs, no unnecessary docstrings, blast-radius awareness for shared modules |
| `types` | Type design — brands for proof, parse-don't-validate at I/O boundaries, capability composition over monolithic interfaces |
| `boundaries` | Abstraction boundary integrity — implementation details (libraries, transport, storage) must not leak across call-hierarchy boundaries. Discover existing conventions; never prescribe ports/adapters naming |
| `project-conventions` | Pre-task orientation checklist; match existing naming, imports, error handling, and test structure — never introduce new conventions |
| `error-handling` | Check exit codes, verify outputs after writes/API calls/builds, dry-run before full execution |
| `pr-authoring` | Capability-first PR-creation routing: `git-agent` owns mechanics; borrow a PR-description capability for the body when present; wholesale PR skill only on explicit request |
| `reviewing` | Capability-first code-review routing: firewall `review-agent` for default reviews (skill-preload + fallback); wholesale review skills (fan-out / GitHub side-effects) at orchestrator level; voice is a separate layer |

> Note: these are rules fragments (behavioural guidance), not invocable harness skills. The `skills/` directory is reserved for real skills (e.g., `discover-project-tools`).
