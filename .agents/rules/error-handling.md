---
name: error-handling
description: Rules for handling command failures, verifying outputs, and reporting errors. Always active — apply to every shell command, script execution, or tool invocation.
---

# Error Handling

- Check command exit codes — don't assume success
- Parse error output to diagnose before retrying with fixes
- Don't assume success — verify outputs match expectations
- Report what went wrong clearly if unable to complete a task

## Verification

**Every check asserts a positive signal. Absence of an error is never evidence.**

This is the strong form of "don't assume success", and it is the one that actually
holds up. A check whose pass condition is *"no error appeared"* passes identically
when the thing worked, when the thing was skipped, and when the thing failed
without logging. Those need opposite responses, so a check that cannot tell them
apart is not a check.

Write assertions that can only pass if the work happened:

| Instead of | Assert |
|---|---|
| no error in the log | the completion line, with the expected identifiers |
| the request didn't throw | the status code *and* a field from the response body |
| the file wasn't reported missing | the file exists and its content matches |
| the tool didn't fail | the tool is present in the loaded/registered set |
| N items were processed | `count=N` logged, and N matches the input count |

- After writes: confirm the file exists and the content is correct
- After API calls: check status codes and payload shape, not just absence of exceptions
- After builds: confirm artefacts exist at the expected paths
- For scripts: dry-run or `--check` / `--syntax-only` before full execution where available
- **Emit the negative case too.** `count=0 — nothing sent` is a log line worth
  writing, because it makes "we produced nothing" loud instead of indistinguishable
  from "we never ran".

## Diagnosing a failure

When a run reports success but did less than it claimed, or an intermittent
failure is being treated as deterministic, load
`~/.claude/references/failure-modes.md` — the catalogue of silent-degradation shapes
(non-fatal missing dependency, no-op fallback, swallowed error, empty discovery)
and flaky-infrastructure signatures.
