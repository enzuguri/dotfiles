# Long-lived workers

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
feature. See the `hypothesis-handling` skill.
