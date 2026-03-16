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
Handles: lint, test, build verification. Runs lint and tests in parallel.
Invoke when: after any significant code edit, before declaring a task complete.
→ See `agents/verification-agent.md`

## `research-agent`
Handles: parallel information gathering across codebase, docs, or web.
Invoke when: multiple independent data points are needed before making a decision. Enumerate all required data points upfront; launch minimum agents to cover them in parallel.
→ See `agents/research-agent.md`

## `explore-agent`
Handles: read-only codebase orientation. Maps entry points, traces export→import→callsite relationships, summarises conventions. Returns a structured summary — never prose.
Invoke when: starting a task in an unfamiliar area, or when asked to understand how something works before editing.
→ See `agents/explore-agent.md`

---

# Skills

These are always active and apply to all tasks:

| Skill | Scope |
|---|---|
| `tooling` | Tool preferences, env setup |
| `ast-grep` | Pattern library for code structure searches |
| `code-style` | Code style and architecture rules |
| `project-conventions` | How to orient in a new project |
| `error-handling` | Exit codes, retries, failure reporting |
