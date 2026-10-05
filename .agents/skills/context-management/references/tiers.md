# Rules vs skills — where guidance belongs

Two tiers. The distinction is load-bearing, not cosmetic:

- **`rules/`** is symlinked to `~/.claude/rules/`, which Claude Code auto-loads in
  full into every session **and every subagent**. Membership is charged on every
  agent spawn, so a large `rules/` is paid N times in a fan-out — and is delivered
  to agents that often cannot act on it.
- **`skills/`** load by name, on demand, via the Skill tool or `skills:` preload.
  Only each skill's one-line description is always in context; the body enters when
  loaded. Long detail a single skill needs lives in its own `references/` and is
  linked relatively, so nothing depends on install location.

**Splitting into `references/`:** move only content needed conditionally (another
language, another mode, first run), and point to it from `SKILL.md` with the cue
that triggers the `Read`. A reference read on every load saves nothing and adds a
skippable step.

**Membership test for `rules/`:** *would the absence of this text cause the wrong
action, with no cue that would have fetched it in time?*

Prohibitions and gates qualify — you cannot lazy-load "don't do X", because the
trigger for loading it is the violation itself. Positive, conditional knowledge
does not qualify: it has a natural retrieval cue and belongs in a skill.
When in doubt, a skill — except for anything under ~1KB, where the retrieval
machinery costs more than the text.

## `rules/` — auto-loaded everywhere
| Name | Scope |
|---|---|
| `tooling` | Preferred CLI tools (`rg`, `fd`, `jq`, `ast-grep`), env setup (`nvm use`, `gh` token), ownership checks via `codeowners` |
| `code-style` | Strong typing, functional patterns, early returns, minimal diffs, no unnecessary docstrings, blast-radius awareness for shared modules |
| `error-handling` | Every check asserts a positive signal — absence of an error is never evidence |
