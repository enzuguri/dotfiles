# Code Review (capability-first routing)

Code review is decomposed across a firewall worker and the orchestrator. The two
do not nest: fan-out / side-effecting review flows spawn their own agents or
write to GitHub, and `review-agent` has no `Agent` tool to host them.

## Default: firewall `review-agent`
A standard review — local changes, a branch range, or a single same-repo PR —
goes to `review-agent`. It runs a methodology behind a context firewall and
returns compact, severity-tagged findings:
- **Methodology** comes from a preloaded review skill (a plugin-qualified
  `skills: [miro-way:review]` in its frontmatter) when installed, else the
  built-in checklist in its body. A missing preloaded skill is skipped with a
  debug-log warning — it does not break agent load — so off-company machines
  fall back cleanly with no dangling reference.
- **Firewall limits**: read-only, no sub-agents. It skips any methodology step
  that requires spawning an agent (e.g. linked-doc context gathering) and
  reports the omission in its verdict's `omitted` tag.

## Wholesale at orchestrator level (do not nest)
Some review capabilities fan out their own agents or have side-effects and MUST
run in the main loop, not inside the firewall. Route to these only when the user
asks for that depth or those side-effects:
- `/code-review` — fans out parallel reviewers + confidence scoring, posts to
  GitHub.
- `security-review`, and any `--comment` / `--fix` invocation — write to the
  tree or the PR.
- A review skill's *full* context-gathering path when its linked-doc resolution
  spawns a subagent (e.g. `miro-way:review` + `additional-context-search`).

## Voice is separate
`review-agent` emits neutral findings. Re-voicing or re-phrasing them is an
independent presentation step handled by the `re-voicer` agent: pipe the findings
to `re-voicer` with a voice name (e.g. `gentry`) to re-render them in a persona.
It is content-preserving — it may change tone but must never add, drop, or alter
a finding or its severity. Never fold voice into the methodology agent. Because a
re-voiced finding loses nothing factual, severity tags and `file:line` anchors
survive the re-tone.

## Why decomposed
Same rationale as `pr-authoring`: keep methodology behind a firewall (compact
return, no context pollution), reserve fan-out / side-effecting flows for the
orchestrator that can actually host them, and keep presentation orthogonal so
voice and methodology swap independently.
