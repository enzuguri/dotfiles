# 0003 — Plugin portability: resolve by name, not by path

- **Status**: Accepted
- **Date**: 2026-10-05
- **Evidence**: five headless probes, Claude Code 2.1.289, `--model sonnet`; fixtures and transcripts in `/tmp/harness-probes/` (ephemeral — fixture definitions reproduced below)

## Context

The harness reaches its own files by absolute install path: 21 references to
`~/.claude/references/`, 4 to `~/.claude/skills/` (added when `explore-agent` was
split into `discover-repo-map`, `discover-boundaries`, `trace-symbol`), 2 to
`~/.claude/voices/`, 1 to `~/.claude/rules/`, and 1 deliberate external path to the
`miro-way` plugin. Packaging as a Claude Code plugin — or reading the skills from
another tool — breaks every one of them.

The candidate replacement is name-based resolution: shared references become
skills loaded by name, single-consumer references are bundled into the consuming
skill's `references/` directory, and agents invoke skills via the Skill tool. A docs
check left four behaviours ambiguous or undocumented, and the harness has a
precedent for frontmatter not doing what it says (`tools: Bash, Read, Grep` grants
only `Bash, Read` — see `agents/review-agent.md`). So each was probed empirically
before relying on it.

## Decision

Harness files refer to each other by **name**, never by install path.

1. Shared references → `user-invocable: false` skills, loaded by bare name
   (`hypothesis-handling`, `boundaries`, `types`, `failure-modes`,
   `coordination-artifact`, `pr-authoring`, `review-routing`).
2. Single-consumer references → `skills/<consumer>/references/*.md`, linked
   relatively (`trace-symbol` ← `ast-grep.md`, `discover-repo-map` ←
   `project-conventions.md`, `revoice` ← `voices/gentry.md`).
3. Agents that load skills on demand carry `Skill` in `tools:` (explore,
   design-discussion, review, research, log-reader). `explore-agent` invokes
   `discover-*` and `trace-symbol` by name; they fork one level deeper.
4. Skill references use bare names. Agent-type references stay bare while the
   harness installs at user level; plugin packaging must namespace them
   (`plugin:agent`) — see Consequences.

Deviations from the first sketch, made during implementation:
- **`re-voicer` stays an agent.** Its `tools: Read` grant is the sandbox; a fork
  without `agent:` lands in `general-purpose` with every tool. `revoice` owns the
  voices and forks into it.
- **`coordination-artifact` is not split** into procedure + bundled schema: every
  load needs the schema, so splitting buys nothing.
- **All knowledge skills are hidden**, including the procedural ones
  (`pr-authoring`, `review-routing`) — the orchestrator loads them; nobody types them.
- **`rules/` stays a user-level install.** No plugin equivalent reaches every subagent.
- **Firewall agents may load knowledge skills only.** Probe 2 means a `Skill`-holding
  agent can spawn a nested agent via a forked skill; `review-agent` states the
  "no `context: fork`" guard explicitly, and `explore-agent` forbids nesting from
  inside a fork.

## Evidence

Each probe ran as `claude -p "<prompt>" --output-format stream-json --verbose
--model sonnet --permission-mode bypassPermissions [--plugin-dir <plugin>]` in a
scratch git repo. Verdicts were judged from tool events in the stream (tool_use
input, tool_result text, `task_started` system events), not from model prose,
except where marked *model-reported*. Each fixture skill carried a unique token so
a positive result could not be faked by absence of an error.

| # | Question | Result | Signal |
|---|---|---|---|
| 1 | Does `tools: Bash, Read, Skill` grant a subagent the Skill tool? | **Yes** | Subagent `Skill {"skill":"probe-marker"}` → `"Launching skill: probe-marker"`, not an error; MARKER token in report. Unlike `Grep`/`Glob`, `Skill` survives alongside `Bash`. |
| 2 | Subagent invokes a `context: fork` skill — inline, nested, or refused? | **Nested agent** | `task_started … "subagent_type":"probe-reader","spawn_depth":2,"skip_transcript":true`; tool_result `Skill "probe-forked" completed (forked execution)` containing the FORKED token. |
| 3 | Plugin agent `skills:` preload — bare or `plugin:skill`? | **Both work** | `pp-bare` (`skills: [pp-knowledge]`) and `pp-qualified` (`skills: [pp:pp-knowledge]`) both reported the PRELOAD token with **0 tool calls**. Agent types resolved only namespaced: `subagent_type: "pp:pp-bare"`. |
| 4 | Do relative paths resolve inside a forked skill? | **Yes, by the model** | `${CLAUDE_SKILL_DIR}` substituted harness-side (visible in the `task_started` prompt) and a `Base directory for this skill:` line is injected. Agent made one direct `Read` of `<skill dir>/references/secret.md` — no `find`/`ls`. `pwd` was the project root, **not** the skill dir. |
| 5 | Is a `user-invocable: false` skill model-invocable via the Skill tool? | **Yes** | 6/6 calls succeeded (main and subagent × bare plugin name, qualified plugin name, project skill). Main-session bodies with tokens visible as stream events; subagent tokens *model-reported*. Bare `pp-knowledge` resolved to the plugin skill. |

Fixtures (enough to rebuild the probes):

- **Agents** (project `.claude/agents/`): `probe-skill-tool` (`tools: Bash, Read, Skill`; reports its tool list and verbatim Skill results), `probe-reader` (`tools: Bash, Read`).
- **Project skills**: `probe-marker` (plain, token MARKER-7731); `probe-forked` (`context: fork`, `agent: probe-reader`, token FORKED-4410); `probe-relpath` (`context: fork`, `agent: probe-reader`, body prints `SKILLDIR=[${CLAUDE_SKILL_DIR}]` and reads `references/secret.md` containing REL-9902); `probe-hidden` (`user-invocable: false`, token HIDDEN-6620).
- **Plugin** `pp` (`--plugin-dir`): skill `pp-knowledge` (`user-invocable: false`, token PRELOAD-5150); agents `pp-bare` / `pp-qualified` preloading it by bare and qualified name, instructed to answer without tools.

### Caveats on the evidence

- **Subagent skill injection is invisible in the stream.** In the main session the
  injected skill body appears as a stream event; inside a subagent it does not
  (probes 1 and 5). Subagent-side token evidence is therefore model-reported, made
  credible by the subagent quoting exact skill base-directory paths it had no other
  way to know.
- **Nested forks skip their transcript.** Probe 2's depth-2 agent emitted no tool
  events; its tool list (`Bash, Read`) is self-reported, though it matches the agent
  frontmatter. Its output file was kept but not read.
- **Path forms differ.** Project skills resolved under `/private/tmp/...` (realpath),
  the `--plugin-dir` skill under `/tmp/...`. Any string comparison of paths can mismatch.
- **Hidden skills are missing from the init event's `skills` list** while present in
  the model's skill listing (the latter *model-reported* — the listing is not in the
  stream). Tooling that enumerates skills from the init event will not see them.
- One model, one version, single sample per probe. Behaviour is harness-side
  (substitution, spawning, resolution), so low sample count matters less than it
  would for routing — but a Claude Code upgrade can change any of it.

## Alternatives rejected

- **`${CLAUDE_PLUGIN_ROOT}` in markdown bodies.** Docs list it for hooks/MCP/LSP
  config only; not probed. Even if it works, it is Claude-only and couples every
  file to plugin packaging.
- **`${CLAUDE_SKILL_DIR}` everywhere.** Confirmed working (probe 4) but Claude-only;
  relative links resolve the same way via the injected base directory and are what
  the Agent Skills standard specifies.
- **`skills:` preload instead of on-demand Skill calls.** Confirmed working (probe 3)
  but eager — the cost is paid on every agent spawn, the same objection that keeps
  `references/` out of `rules/`.
- **Keep the user-level symlink install.** Zero migration cost; forgoes plugin
  distribution and cross-tool reuse.

## Consequences

- Every harness-internal cross-reference becomes a name; install location stops
  mattering for skills and references.
- A cache rebuild triggered by `explore-agent` runs as a depth-2 fork — its reads
  stay out of `explore-agent`'s context, at the cost of an extra agent hop and no
  transcript of the nested run's tool calls.
- Renaming the plugin breaks nothing that refers to skills (bare names), but does
  break agent-type references (`plugin:agent`) — those must be updated together.
- **Not yet plugin-packaged.** Probe 3 showed agent types resolve only namespaced
  inside a plugin, so `agent: explore-agent` / `agent: re-voicer` in skill
  frontmatter and agent names in `AGENTS.md` would need the `plugin:` prefix —
  which breaks the user-level install. Packaging means choosing one install mode
  for agents.
- Still not plugin-portable regardless: `rules/` auto-load into every subagent (no
  plugin equivalent; closest is per-agent `skills:` preload), `AGENTS.md` (not a
  plugin component), and agent definitions themselves (Claude-specific; skills are
  the cross-tool layer).
- `evals/src/load-skills.ts` already enumerates zero skills (expects flat `*.md`,
  layout is `<name>/SKILL.md`); it would also need to handle `user-invocable: false`.

## What would change this

- A Claude Code release where nested forks from subagents are refused, or where
  `Skill` is stripped from a subagent's tool grant alongside `Bash` — re-run probes
  1, 2, 5 on upgrade.
- Evidence that relative `references/` links are mis-resolved in practice (agent
  searching or guessing instead of joining the base directory), which would push
  toward `${CLAUDE_SKILL_DIR}` despite the portability cost.
- A second target tool (Cursor, Codex) that does not follow the Agent Skills
  relative-path convention or does not support name-based skill loading — that
  would make the cross-tool argument moot and favour optimising for Claude alone.
