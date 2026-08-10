---
name: failure-modes
description: Catalogue of silent-degradation shapes and flaky-infrastructure signatures. Load on demand when diagnosing a run that reported success while doing less than it claimed, or when an intermittent failure is being mistaken for a deterministic one. The always-active principle lives in `rules/error-handling.md`.
---

# Failure Modes

Diagnostic catalogue. The governing principle — *every check asserts a positive
signal; absence of an error is never evidence* — is always active and lives in
`rules/error-handling.md`. This file is the detail you consult once something has
already gone wrong, or when reviewing code for these shapes.

## Silent degradation

The most expensive failure class: code that continues on failure rather than
failing, so the run reports success while doing less than it claimed. Recurring
shapes, all seen in the wild:

- **Non-fatal missing dependency** — an absent component is logged at WARN and
  skipped; the operation that needed it silently never happens, and the run is
  green.
- **No-op fallback on absent config** — a real store resolves to `None`, and a
  `NoOp*` implementation is substituted. Writes are accepted and discarded. Often
  triggered by a default in a committed `.env` that a specific run command
  overrides — so it works until someone invokes it the plain way.
- **Swallowed specific error** — a broad handler maps every unlisted error to one
  generic status with no logging, deleting the cause. The distinctive shape: the
  same underlying error is fully diagnosable on one code path (one with logging
  middleware) and invisible on another.
- **Empty discovery** — "found 0 items" buried in startup noise, treated as
  success by everything downstream.

Responses:

1. **Gate before trusting.** Before accepting any end-to-end result, assert the
   preconditions positively — the dependency loaded, the real store is in play,
   the discovered set is non-empty. Cheap, and it converts a whole debugging cycle
   into one line of output.
2. **Never conclude the chain worked from absence of errors** — get a positive
   artefact: an id, a count, a written record.
3. **Separate "gap" from "dead".** A degraded-but-limping failure and a hard
   transport failure look different in the log and need opposite responses (retry
   vs investigate). Learn both signatures for the systems you work on and record
   them where the next run will see them.
4. **Missing observability is a bug worth its own ticket**, separate from whatever
   you were originally chasing. If a failure could not be diagnosed from the logs,
   the fix is one log line at the point of failure — land it while you know
   exactly where it goes.

## Flaky infrastructure

Tunnels, cloud auth sessions, and cross-cluster calls fail intermittently. Treating
an intermittent failure as deterministic burns whole cycles.

- Count successes *and* failures of the same operation before concluding anything
  is broken. Both present ⇒ intermittent ⇒ **retry** is the correct response.
- Re-read the log before believing a failure: files of live processes grow, and a
  later retry may already have succeeded.
- Don't infer a duration from the gap to the next log line — it is usually an
  unrelated heartbeat. Correlate the request and its failure by timestamp,
  across logs if needed.
- Check auth-session validity explicitly (expiry timestamp, not just "I logged
  in") before blaming code. Re-authenticating can silently *downgrade* a session
  rather than restore it.
- Record accumulated flake signatures in the task's coordination artefact
  (`~/.claude/references/coordination-artifact.md`) — they recur within a session and are pure
  cost each time they are rediscovered.
