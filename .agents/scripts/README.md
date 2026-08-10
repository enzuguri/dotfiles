# Harness Maintenance Scripts

Analysis and measurement tooling for maintaining the harness itself — **not part of
the harness runtime.** Nothing here is invoked by an agent, and nothing here is
symlinked into `~/.claude/` or `~/.cursor/`.

Distinguish from the neighbouring directories:

| | Consumer | Invoked by | Symlinked |
|---|---|---|---|
| `agents/` `rules/` | Agents | The model, at runtime | Yes |
| `skills/` | Agents | The Skill tool | Yes |
| `decisions/` | Humans | Read, not run | No |
| `scripts/` | Humans | Run from a shell | No |

## Contents

- **`verdict-check.sh`** — gathers subagent final reports from a session directory
  so the `decisions/open-questions.md` § Q2 check (does "confirm or refute" degrade
  into ritual?) can be repeated cheaply. Gathers only; classification is by hand.

  ```bash
  ./verdict-check.sh ~/.claude/projects/<project-slug>/<session-id> [since-YYYY-MM-DD]
  ```

## Conventions

- **POSIX-ish bash, `set -euo pipefail`, no install step.** Dependencies limited to
  what the harness already assumes (`jq`, `rg`). macOS-first on `stat`/`date`, with
  a GNU fallback where cheap.
- **Gather, don't conclude.** These scripts feed a human or model judgement. Where a
  measurement needs semantic classification, emit the material and say so — do not
  approximate it with keyword counts and present the counts as the finding.
- **Declare bit-rot risk in the header.** Anything parsing transcript internals is
  reading an undocumented format that can change without notice. State what a
  silent-empty result means so nobody reads breakage as a negative finding.
- **Short recipes stay inline.** A few lines of `jq` belong in the decision record
  that uses them (see `decisions/0001-*.md`). Promote to a script here only once it
  grows arg-handling or gets run more than once.
