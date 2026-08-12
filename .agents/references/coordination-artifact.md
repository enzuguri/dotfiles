---
name: coordination-artifact
description: Schema for the shared `contract.md` that multiple agents coordinate through — rewritten §Current state, frozen §Contract nobody edits unilaterally, §Corrections for retractions, length-capped append-only §Status, flake log, open unknowns. Includes the cross-repo read-only-extractor + writer handoff and commit-hygiene reporting. Active whenever more than one agent works the same task.
---

# Coordination Artefact

When more than one agent works on the same problem — especially across repos —
the shared file is the coordination substrate, not the chat. The orchestrator's
context is a private working set; anything that must survive a context reset, be
read by a peer, or be picked up by a fresh agent tomorrow lives in a file.

Path: `.agents/logs/<task-slug>/contract.md`.

The schema below is battle-tested. **The length discipline is the part that gets
skipped, and skipping it destroys the artefact's whole purpose** — a coordination
file too large to load is worse than no coordination file, because everyone
believes the coordination happened.

---

## Structure

### 1. `## Current state` — rewritten, never appended, always first

The only section a joining agent is *required* to read. Hard cap: **40 lines.**
Rewrite it in place on every material change; never append to it. It answers only:

- What is true right now
- What is running, where, and how to reach it
- What the next action is
- What is blocked and on whom

If it exceeds 40 lines, something in it has stopped being current state and
become history — move that thing down the file.

### 2. `## Contract (frozen)` — the invariants

Shared decisions that agents may not change unilaterally: interface shapes,
wire formats, ports, fixed test inputs, the identifiers everyone must agree on.

> **Rule for every agent: if you need something in §Contract to change, STOP and
> report it. Do not change it yourself.**

This is the single most valuable line in the file. Unilateral edits to shared
invariants are the characteristic multi-agent failure, and they are silent.

Include hard resource assignments explicitly — *"ports: 7777 mn, 7778 cfg, 7780
cai — hard assignments, do not squat"*. Ambiguity here produces failures that
look like code bugs.

### 3. `## Rules for agents` — the operating agreement

State it once, at the top, rather than repeating it in every dispatch. The three
that earn their place:

1. **You make changes, you build, you verify in isolation. You do not start
   long-running servers — the orchestrator does.** Hand back an exact run command
   (cwd + env + argv).
2. **Local-only edits must be trivially revertible** (named stash or scratch
   branch), and you list every file you touched.
3. **You do not commit or push unless told.** Report the exact revert command for
   what you did.

### 4. `## Corrections to earlier claims` — retraction as a first-class move

The highest-leverage section in the file. A dedicated, expected home for
retractions makes correcting the record cheap, which is the only reason agents do
it — including correcting *themselves*, which nobody else is positioned to catch.

One line each: `<who claimed it> — <what was wrong> — <what is actually true, with
file:line>`. Never edit the original claim in place; the fact that it was believed
is part of the record, and someone may still be acting on it.

### 5. `## Status` — append-only, one line per milestone

Fixed shape, and the cap is enforced:

```
<agent>: <what changed> | <how to run> | <verify> | <blocker or "none">
```

**Hard cap: 5 lines per entry.** Long-form evidence — tracebacks, measurements,
full test output, reasoning chains — goes in a sibling file
(`.agents/logs/<task-slug>/<agent>-notes.md`) and the status line links to it.

This cap is the correction to the pattern's known failure mode. Status entries
degenerate into multi-thousand-word paragraphs because the schema constrains
*shape* and not *length*; the file then blows past any reasonable context budget
and nobody can load it. If an agent has more to say, that is what the notes file
is for.

### 6. `## Flake log` — accumulated infrastructure signatures

One line per flake: the symptom, the real cause, the check that distinguishes it,
the fix. These recur within a single session and cost real time every time they
are rediscovered. See `~/.claude/references/failure-modes.md` § Flaky infrastructure.

### 7. `## Dead ends` — correctly-reasoned paths that did not pan out

One line each: `<what was tried> — <why it was rejected>`. Distinct from
§Corrections, which records claims that were *wrong*; a dead end was sound
reasoning that simply did not lead anywhere.

This section exists because of a specific, measured loss. When a fresh agent
replaces one that has accumulated context, the artefact carries the decisions and
invariants across but not the *residue* — which files were read and ruled out,
what shape the code turned out to have, what was attempted and abandoned. The
replacement re-walks all of it. Most of that residue is not writable at
reasonable cost; dead ends are the exception, because they are one line and they
are exactly what gets re-tried.

### 8. `## Open unknowns` — with the decision each one gates

Not a to-do list. Each entry names what cannot currently be determined, what
would determine it, who has that vantage point, and what changes depending on the
answer. An unknown nobody can act on is noise; an unknown with a named resolver is
work.

---

## Maintenance

- **Cap the whole file at ~400 lines.** Past that, the long-form has leaked back
  in — move it to notes files. Check with `wc -l`, not by feel.
- **The orchestrator owns §Current state and §Contract.** Agents own their §Status
  lines and their own notes files, and may append to §Corrections, §Flake log, and
  §Dead ends.
- **Point agents at sections, not the file.** *"Read §Contract and the SEQUENCING
  block before writing code"* — never "read contract.md", which defeats the
  budget the structure exists to protect.
- **Reference by section, transmit by value.** When one agent's output is another
  agent's input, have the producer write the spec to the artefact and the
  consumer read it directly. The orchestrator relaying it in chat pays for the
  same content twice and risks paraphrasing it once.

---

## Long-lived workers

When work spans repos or sessions, prefer **one named worker per repo, reused**,
over a fresh agent per task. A finished agent is not dead — `SendMessage` resumes
it from its transcript with context intact, while a new `Agent` call discards
everything it learned. Name workers at spawn (`name: "repo-billing"`) so they are
addressable without juggling opaque ids.

This does not violate the context-firewall rule. The firewall bounds the
*orchestrator's* context; a worker holding 200k tokens of hard-won knowledge about
its repo still returns the same compact summary. Worker and orchestrator are
separate budgets.

**Rotate on a threshold, not on a new task.** The same 40% / 60% discipline the
orchestrator follows applies to a long-lived worker one level down:

- At ~60% of its window, the worker writes `.agents/logs/<slug>/<repo>-notes.md`
  — current mental model, files ruled out, dead ends, open threads.
- Spawn its replacement seeded with that file plus §Current state. Same name.
- Never resume a rotated worker from its transcript; the notes file is the handoff.

**Respawn when the subject changes, not when the task does.** Accumulated context
becomes accumulated prior: a worker that spent forty turns concluding "the bug is
in the serializer" will keep finding serializer bugs. Continuity of subject is the
reuse criterion — for an unrelated subject, a fresh agent's ignorance is the
feature. See `~/.claude/references/hypothesis-handling.md`.

---

## Cross-repo handoff: extractor + writer

The strongest use of this artefact. When work spans repos, do not put one agent in
both:

- A **read-only extractor** in the source repo produces an implementation-ready
  spec: exact behaviours, `file:line` for each, the *why* where it is empirical
  rather than contractual, sequencing constraints, and — explicitly — the
  behaviours nobody asked about that a reimplementation would otherwise miss.
- A **writer** in the target repo implements against that spec.
- The spec lives in the artefact. **The orchestrator never holds the source.**

This is what lets a behaviour be reimplemented in a different language across a
repo boundary at near-zero orchestrator context cost. The extractor's discipline
— read-only, zero files changed, nothing restarted, and it says so — is what makes
it safe to run in a repo nobody intends to modify.

## Commit-hygiene reporting

Any agent working in a repo with uncommitted experiments must report, every round:

- Which files are tracked-dirty vs untracked
- **Whether `git add -u` / `git add -A` is currently safe on this branch**
- The exact revert command for its own changes

Safety here changes *between rounds* as files get committed — an experiment that
was safely untracked becomes a `git add -u` hazard the moment it starts dirtying
tracked files. Re-state it each time; do not assume last round's answer holds.
