---
name: discover-repo-map
description: Builds a repo-level orientation map — runtime and build system, entry points, conventions (naming, imports, error handling, logging, tests), hotspots from git history, and repo-wide gotchas — and caches it at `.agents/context/repo-map.md`. Invoke on first work in an unfamiliar repo or when that cache is stale. Repo-level and cached; task-specific orientation ("where do I change X?") is `orient-agent`, which reads this cache.
context: fork
agent: orient-agent
---

# Discover Repo Map

Produce `.agents/context/repo-map.md` — the facts about a repo that hold across
tasks. `orient-agent` reads it instead of re-orienting from scratch every run, and
spends its own budget on the task.

Scope test for anything you record: *would this still be true for an unrelated task
next week?* If not, it belongs in a task exploration, not here.

## Read budget
Structural anchors (`package.json`, `tsconfig.json`, `pyproject.toml`,
`build.gradle*`, `Dockerfile`, `docker-compose.yml`, `.nvmrc`) are exempt. Beyond
those, **max 5 Reads** of source files, for convention sampling only. This budget is
separate from `orient-agent`'s task budget when it runs this procedure inline.

---

## Lookup protocol

Run before any discovery. A repo map changes far less often than the code, so —
unlike `boundaries.md` — a new commit alone does not invalidate it.

1. **No cache file** → discover.
2. **`git merge-base --is-ancestor <git_sha> HEAD` fails** (history rewritten, or a different branch line) → discover.
3. **`generated_at` older than `ttl_days`** → discover.
4. **`git diff --name-only <git_sha> HEAD -- <sources...>` is non-empty** (a manifest or config the map was built from changed) → discover.
5. **`git diff --name-only --diff-filter=ADR <git_sha> HEAD` touches a directory listed under Entry Points** → discover.
6. **Otherwise** → use as-is; report `cache: fresh` with which checks ran.

Manual invalidation: `rm .agents/context/repo-map.md`.

---

## Discovery procedure

Run independent commands in one batched Bash block per step.

### 1. Git history
```bash
git rev-parse HEAD; git branch --show-current
git log --oneline -20                                   # cadence, commit style
git log --since=90.days --name-only --format= | sort | uniq -c | sort -rn | head -15   # hotspots
```

### 2. Config and runtime
Read the structural anchors that exist. Infer: runtime and version, package
manager, build system, path aliases, monorepo/workspace layout.

### 3. Entry points
Find the edges of the graph, don't sample random files:
```bash
fd -e ts -e js -e py 'main|index|server|app|cli' --type f -E node_modules
```
Framework-specific:
- Next.js: `app/`, `pages/`
- Express/Fastify: router registration (`$APP.use($$$)`, `$ROUTER.$METHOD($$$)`)
- tRPC: `router(` pattern
- CLI tools: `bin/`, `[project.scripts]` / `"bin"` in manifests

### 4. Conventions
Infer from existing code — never assume. Sample from hotspot files (they reflect
current style, not legacy), plus one test file. Use `rg` first to choose samples:
- Naming: files, functions, types
- Imports: relative vs alias, barrel files
- Error handling: throw vs Result, custom error types
- Logging: library, structured or not
- Tests: co-located vs `__tests__`, runner, naming

If `references/project-conventions.md` (relative to this skill's base directory)
would help on an unusual stack,
read it; otherwise skip it.

### 5. Repo-wide gotchas
```bash
rg -c 'TODO|FIXME|HACK|XXX' -g '!node_modules' | sort -t: -k2 -rn | head -10
```
Record clusters, legacy directories, generated code that must not be hand-edited,
and dual patterns (e.g. two HTTP clients) — anything that would mislead a newcomer.

---

## Cache file

Write to `.agents/context/repo-map.md`. Create `.agents/context/` if absent.

````markdown
---
type: repo-map
generated_at: <ISO 8601 UTC>
git_sha: <git rev-parse HEAD at write time>
git_branch: <branch at write time>
ttl_days: 14
sources:
  - package.json
  - tsconfig.json
  - <every anchor and sampled file actually read>
---

# Repo Map — <repo name>

## Runtime & Build
- Runtime: <e.g. Node 20 via .nvmrc>
- Package manager / build: <...>
- Layout: <single package | workspaces: list>
- Path aliases: <...>

## Entry Points
- `<path>` — <what it starts / serves>

## Conventions
- Naming: ...
- Imports: ...
- Error handling: ...
- Logging: ...
- Tests: ...

## Hotspots (90 days)
- `<path>` — <n> changes

## Gotchas
- <legacy pattern, FIXME cluster, generated dir, dual pattern>
````

Write `n/a — <what you searched>` for a section that genuinely has nothing; never
omit a section. Cite a sampled `file:line` for each convention you infer from code.

After writing, re-read the file and confirm `git_sha` matches HEAD and every
`sources:` entry exists.

---

## Return

```
cache: <fresh | rebuilt> · <path> · git_sha <short sha>

<the cache body, minus frontmatter>
```
