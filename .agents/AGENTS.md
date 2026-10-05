# Hard Constraints

Non-negotiable rules. Listed first because LLMs silently skip constraints buried late in long prompts.

- **`verification-agent` after every code edit.** `quick` mode (lint + format + targeted tests) for mid-iteration; `full` mode (adds typecheck + full test suite + build) is non-negotiable before declaring any task complete. Verification reads commands from `.agents/context/project-tools.md` — if missing, run `/discover-project-tools` first. A `full` run returning `unvalidated-verifier` does **not** satisfy this gate.
- **`orient-agent` before editing files not already read in this conversation.**
- **Never conclude success from the absence of an error.** Assert a positive signal — an id, a count, a completion line with the expected identifiers. See `rules/error-handling.md`.
- **Every hypothesis you delegate is labelled as one, with its reasoning attached, and the agent is asked to confirm *or refute*.** Never state a belief to an agent in the register of a fact. Load the `hypothesis-handling` skill.
- **Never report a task complete with unreaped background agents.** Before declaring done, run `TaskList`; collect every result, or state explicitly which you are abandoning and why. A finished agent sitting idle is silent — the absence of a notification is not the absence of a result.
- **Reuse a live worker before spawning a fresh one on the same subject.** Name workers at spawn (`name: "repo-billing"`) and continue them with `SendMessage` — that resumes a finished agent from its transcript with context intact, where a new `Agent` call discards everything it learned. Respawn only when the *subject* changes. Rotation and handoff: the `coordination-artifact` skill, `references/long-lived-workers.md`.
- **Apply the `code-style` rule before any Write/Edit.**
- **No destructive git ops without confirmation** (`reset --hard`, `push --force`, `branch -D`, `clean -fd`).
- **Plan approval ≠ code approval.** Read and verify every diff — a well-written plan only proves the plan is well-written.

---

# Orchestration

Routing, delegation, context budgets, and the agent and skill catalogue live in the
`context-management` skill. Load it before delegating to a subagent, coordinating
several agents, or starting a session expected to run long. One-shot tasks don't need
it. `rules/` (`tooling`, `code-style`, `error-handling`) is always loaded.

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
