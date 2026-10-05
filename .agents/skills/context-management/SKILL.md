---
name: context-management
description: Orchestration playbook — context budgets, when and how to delegate, and routing rules the agent and skill descriptions don't state. Load before delegating to a subagent, coordinating several agents, or starting a session expected to run long; invoke `/context-management` to force it at session start. Not needed for one-shot tasks.
---

# Context Management

Routing detail behind the always-on hard constraints. Agent and skill descriptions
already say what each one handles; this covers only what they don't. Where new
guidance belongs (always-on `rules/` vs a skill) is in `references/tiers.md`,
relative to this skill's base directory — read it only when adding guidance.

## Budgets

- **Target** under 40% context utilization; at **60%**, persist progress and start fresh.
- **Persist** a structured summary to `.agents/logs/<YYYY-MM-DD>-<task-slug>/exploration.md`; **resume** from the summary only, never the prior transcript.
- Coordinate agents through filesystem artifacts (`.agents/`, `~/.config/`), not your context — schema in the `coordination-artifact` skill.

## Delegate by default

Sub-agents are context firewalls, not personas. Dispatching and reading a compact
return is cheap; your own tool output is what fills context. Before running a
read-only investigation inline, delegate it:
- **Reading logs or command output** → `log-reader`. Never grep a large log yourself.
- **Waiting for anything** → `log-reader` or a background task. A `sleep` loop in your turn is always wrong.
- **Owning a process is not owning its logs.** Keep start/stop/port allocation; delegate every read of what it produced.
- Debugging serially while agents sit idle → stop and fan out.
- **Fanning out research:** enumerate every data point first, then launch the fewest agents that cover them in parallel.

Pass all relevant context explicitly — agents share no memory.

## Routing rules

- **Before editing unfamiliar code** → `orient-agent`. A question about one named symbol ("what calls X") → `/trace-symbol` instead.
- **Repo-level caches first.** Read `.agents/context/` (`repo-map.md`, `boundaries.md`, `project-tools.md`); on a miss or stale cache, invoke the matching `discover-*` skill.
- **PR creation is decomposed.** `git-agent` does mechanics (branch, scoped fetch, commit, push). If a PR-description capability exists, render the body with it and pass it to `git-agent` verbatim; otherwise `git-agent` writes it. Hand the whole flow to a wholesale PR skill only when the user asks for the full workflow. Mechanics: the `pr-authoring` skill.
- **Code review defaults to the firewall** — `review-agent`. Route to a wholesale review flow (`/code-review`, `security-review`, any `--comment`/`--fix` run) only when it fans out agents or has side-effects, which can't nest inside the firewall. Details: the `review-routing` skill.
- **Voice is separate from review.** Re-voice findings with `/revoice <voice> <text>`, never by asking the reviewer, and never by calling `re-voicer` directly — the skill carries the voice packs. Relay its output verbatim.
- **Verification** reads `.agents/context/project-tools.md`; if missing, run `/discover-project-tools` before `verification-agent`.
