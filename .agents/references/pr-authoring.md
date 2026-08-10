# PR Authoring (capability-first routing)

PR *creation* is decomposed across two owners coordinated by the orchestrator.
The two paths never nest: a wholesale PR-orchestration skill performs git inline
and is told not to launch arbitrary agents (so it will not call `git-agent`),
and `git-agent` has only `Bash, Read` (no `Skill`/`Agent` tool, so it cannot
call back out). The orchestrator is the only integration point.

## Default sequence

1. **Mechanics → `git-agent`**: branch (infer/confirm naming), scoped fetch,
   commit (repo convention), push. This preserves git-agent's hardened
   guarantees — scoped-fetch-only, stale-lock cleanup, no-AI-in-commit-message,
   `--force-with-lease`.
2. **Description body → borrowed capability, if present.** Detect a
   PR-description / PR-summarization capability in the *current* environment by
   inspecting the available skills and agent lists — a description skill (e.g. a
   `pr-description` skill) or a read-only summarizer agent (e.g. a
   `pr-summarizer` agent). Do not assume one exists by name.
   - **Present** → invoke it to produce the templated body (it resolves the repo
     PR template / `CONTRIBUTING.md` conventions and returns a finished body),
     then hand that body to `git-agent` verbatim.
   - **Absent** → `git-agent` authors the body itself from the work summary +
     repo PR template (its existing behaviour). No reference to a missing skill.
3. **`gh pr create --draft` → `git-agent`** with the body from step 2.

## Escape hatch

The decompose is the default, not a lock-out. When the user explicitly asks for
the *full* workflow — background code review, CI monitoring — or names a
wholesale PR skill, route the entire flow to that skill instead.

## Why decomposed

Wholesale PR skills bundle git mechanics + description authoring. For this setup
`git-agent`'s mechanics are the more hardened half (scoped fetch, lock cleanup,
AI-mention ban, force-with-lease) while a company skill's description authoring
is the richer half (template detection, complexity gating). Decompose keeps the
stronger half of each. The runtime capability check keeps it portable —
off-company machines fall back to git-agent authoring with zero references to a
skill that is not installed.
