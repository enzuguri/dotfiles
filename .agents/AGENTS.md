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

Invoke these agents for their respective domains. Pass all relevant context explicitly — agents have no shared memory.

## `git-agent`
Handles: committing, branch naming, rebasing, amend/force-push, CI/CD monitoring.
Invoke when: task involves any git operations, PR management, or CI status checks.
→ See `agents/git-agent.md`

## `verification-agent`
Handles: lint, formatter check, test, and build verification. Runs all checks in parallel.
MUST invoke after any code edit and before declaring any task complete. No exceptions.
→ See `agents/verification-agent.md`

## `research-agent`
Handles: parallel information gathering across codebase, docs, or web.
Invoke when: multiple independent data points are needed before making a decision. Enumerate all required data points upfront; launch minimum agents to cover them in parallel.
→ See `agents/research-agent.md`

## `explore-agent`
Handles: read-only codebase orientation. Maps entry points, traces export→import→callsite relationships, summarises conventions. Returns a structured summary — never prose.
MUST invoke at the start of any coding task before editing files not already read in this conversation.
→ See `agents/explore-agent.md`

## `bourgeoisie-reviewer`
Handles: code review delivered as British landed gentry — factually accurate observations with old-money flair. Restrained approval for proper form, devastating understatement for bad.
Invoke when: user requests a humorous or stylised code review.
→ See `agents/bourgeoisie-reviewer.md`

---

# Skills

These are always active and apply to all tasks:

| Skill | Scope |
|---|---|
| `tooling` | Preferred CLI tools (`rg`, `fd`, `jq`, `ast-grep`), env setup (`nvm use`, `gh` token), ownership checks via `codeowners` |
| `ast-grep` | Patterns for finding/tracing functions, exports, imports, call sites, React components in TS/JS |
| `code-style` | MUST apply before any Write/Edit. Strong typing, functional patterns, early returns, minimal diffs, no unnecessary docstrings, blast-radius awareness for shared modules |
| `project-conventions` | Pre-task orientation checklist; match existing naming, imports, error handling, and test structure — never introduce new conventions |
| `error-handling` | Check exit codes, verify outputs after writes/API calls/builds, dry-run before full execution |
