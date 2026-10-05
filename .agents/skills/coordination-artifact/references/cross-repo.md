# Cross-repo handoff: extractor + writer

The strongest use of the coordination artefact. When work spans repos, do not put
one agent in both:

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
