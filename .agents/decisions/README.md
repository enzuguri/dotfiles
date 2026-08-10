# Design Decisions

Records of *why* the harness is shaped the way it is — the reasoning, the evidence,
and the alternatives that were rejected.

**These files are not symlinked into `~/.claude/` or `~/.cursor/`.** They are for
humans maintaining the harness. Loading design rationale into every agent's context
would be exactly the pollution the harness exists to prevent. `AGENTS.md`, `rules/`,
and `agents/` carry the *operative* instruction; this directory carries the argument
behind it.

## Why bother

The harness is a set of opinions applied silently across every task, so a wrong
opinion is expensive and a right one is invisible. Three failure modes this
directory guards against:

- **Re-litigating settled questions.** Without a record, a rejected design gets
  reproposed every few months with the same arguments and no memory of the
  measurement that killed it.
- **Cargo-culting our own rules.** A rule whose rationale is lost gets applied
  where it doesn't fit, or defended past the point where its evidence still holds.
- **Losing the measurement.** The numbers behind these decisions came from
  instrumenting real sessions. That work is expensive to redo and trivial to
  record.

## Format

`NNNN-kebab-title.md`, sequential, never renumbered. Superseded records stay in
place with their status updated and a pointer forward — the fact that something
was believed is part of the record.

```markdown
# NNNN — Title

- **Status**: Proposed | Accepted | Rejected | Superseded by NNNN
- **Date**: YYYY-MM-DD
- **Evidence**: where the numbers came from, or "none — reasoning only"

## Context
What prompted the question.

## Decision
What was decided, stated so it can be complied with.

## Evidence
Measurements, with how they were obtained so they can be reproduced or challenged.

## Alternatives rejected
What else was considered and the specific reason it lost.

## Consequences
What this makes easier, what it makes harder, what it commits us to.

## What would change this
The observation that should reopen the decision. A record without this is dogma.
```

The last section is the one that matters most. It converts a decision from a rule
into a **standing hypothesis with a falsifier** — which is the same discipline
`references/hypothesis-handling.md` demands of agents, applied to ourselves.

## Bar for writing one

Write a record when a decision is **non-obvious, contested, or expensive to
reverse**. Skip it for anything a reader would infer from the file itself.

Rough test: if someone six months from now might reasonably propose the opposite,
write it down. If they'd have to be confused to propose the opposite, don't.

## Index

| # | Title | Status |
|---|---|---|
| [0001](0001-subagents-are-context-firewalls.md) | Sub-agents are context firewalls, not personas | Accepted |
| [0002](0002-log-reader-stays-read-only.md) | Diagnostic firewalls stay read-only; no "devops" agent | Accepted |

See also [`open-questions.md`](open-questions.md) — theories not yet settled, with
the test that would settle each.

## Measurement tooling

Records here cite evidence; the tooling that produces it lives in
[`../scripts/`](../scripts/), not in this directory — a record is read, a script is
run, and they rot differently.

- [`../scripts/verdict-check.sh`](../scripts/verdict-check.sh) — gathers subagent
  final reports from a session directory for the Q2 check. Gathers only;
  classification is by hand, on purpose.

Short reproduction commands (a few lines of `jq`) stay inline in the record that
uses them — see 0001's Evidence section. Promote to `../scripts/` once a recipe
grows arg-handling or gets run more than once.
