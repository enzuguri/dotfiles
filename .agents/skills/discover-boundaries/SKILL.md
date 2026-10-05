---
name: discover-boundaries
description: Discovers a repo's abstraction boundaries — adapter files that wrap I/O libraries, the ports consumers actually import, and cross-boundary leaks — and caches the result at `.agents/context/boundaries.md`. Invoke before designing a port or checking boundary integrity when that cache is missing or stale. Repo-level and cached; for the principles (smells, port design, trade-offs) load the `boundaries` skill instead.
context: fork
agent: orient-agent
---

# Discover Boundaries

Produce `.agents/context/boundaries.md` — the repo's adapter/port map. `orient-agent`
and `design-discussion` read it instead of rediscovering boundaries every task.
The principles behind what counts as a boundary or a leak live in
the `boundaries` skill (§ Smells); load it only if a leak judgement is
genuinely ambiguous.

**Discover, don't prescribe.** The signal is structural (what does this file
actually do?), not nominal (what's it called?). Most codebases do not use formal
ports-and-adapters naming — boundaries still exist under whatever names the project
chose.

## Read budget
Discovery is `rg`-driven. Reads are only for confirming a port's public surface
(barrel files, a representative adapter). **Max 6 Reads.** This budget is separate
from `orient-agent`'s task budget when it runs this procedure inline.

---

## Lookup protocol

Run before any discovery:

1. **No cache file** → full discovery, write the cache.
2. **Cache exists, `git_sha` matches `git rev-parse HEAD`, `generated_at` within `ttl_days`** → use as-is; report `cache: fresh`.
3. **Otherwise** (SHA mismatch or TTL expired) → full discovery, overwrite.

No incremental rebuilds. Full rebuild is fast enough at most scales; if it isn't,
partition the repo by area first. Manual invalidation: `rm .agents/context/boundaries.md`.

---

## Detection

### Step 1 — Find adapters by their imports

A file is an adapter, regardless of name or location, if it imports a third-party
library that performs I/O, persistence, or external integration. Run these as one
batched `rg -l -e ... -e ...` per language, not one search per library.

**TS/JS**
- Network: `axios`, `fetch`, `ky`, `got`, `socket.io`, `ws`
- Query/cache: `@tanstack/react-query`, `swr`, `apollo`, `urql`
- ORM/DB: `prisma`, `drizzle`, `typeorm`, `kysely`, `pg`, `mysql2`, `mongodb`, `redis`
- Storage: raw `localStorage`, `IndexedDB`, `fs`, `s3` clients
- Auth: `firebase/auth`, `@clerk/...`, `next-auth`
- Analytics: `posthog-js`, `mixpanel`, `@amplitude/...`

**Python**
- HTTP: `requests`, `httpx`, `aiohttp`
- ORM/DB: `sqlalchemy`, `django.db`, `asyncpg`, `psycopg`, `redis-py`
- Storage: `boto3`, raw `open()`, file-system writes
- Cache: `redis`, `cachetools`, `memcache`
- Async/queue: `celery`, `kafka-python`

Also: imports from internal infrastructure modules. Names vary by project
(`*Client`, `*Service`, `*Api`, `*Repository`, `*Gateway`, `*Store`, `*Driver`, etc.)
— discover the local pattern, don't assume one.

### Step 2 — Cluster to discover the convention

Group adapter files by directory. The clustering reveals the codebase's convention.
Shapes you might encounter (illustrative, not prescriptive):

- `api/`, `lib/`, `utils/`, `helpers/`
- `services/`, `clients/`, `data/`
- `hooks/`, `queries/`, `mutations/`, `store/`
- `infra/`, `adapters/`, `repositories/`, `ports/`
- Co-located per feature: `<feature>/api.ts`, `<feature>/queries.ts`

Record the convention this codebase already uses. If I/O imports are genuinely
scattered with no pattern, record that as the finding — do not propose a convention;
that is a design decision for `design-discussion`.

### Step 3 — The port is the public surface

Within the adapter cluster, the port is what consumers are *allowed* to import.
Detect it by:
- What's re-exported through a barrel (`index.ts`) vs. what's internal-only
- What consumer files actually import from the cluster
- Named exports vs. internal helpers

### Step 4 — Find leaks

A leak is a consumer (non-adapter) file that imports an infra library directly, or
references transport-shaped types (`UserResponse`, `UserDTO`, snake_case fields).
Take the Step 1 hit list, subtract the files you classified as adapters — what
remains are leak candidates. Confirm each with `rg -n` for the `file:line`.

---

## Cache file

Write to `.agents/context/boundaries.md`. Create `.agents/context/` if absent.

```
---
type: boundaries
generated_at: <ISO 8601 UTC>
git_sha: <git rev-parse HEAD at write time>
git_branch: <branch at write time>
ttl_days: 7
discovered_convention: <one-line description of the directory pattern>
---

# Abstraction Boundaries — <repo name>

## Convention
<one paragraph describing the codebase's adapter clustering convention>

**Adapters identified:**
- `path/to/adapter.ts` — wraps <library>, exposes <port name>

**Ports identified:**
- `path/to/port.ts` — interface for <domain operation>, consumed by <consumers>

**Cross-boundary leaks:**
- `<file>:<line>` — imports <library> directly; expected to consume <port>
```

Empty sections are written explicitly (`- none found — searched: <libraries>`), never
omitted — an absent section is indistinguishable from a skipped step.

After writing, re-read the file and confirm the frontmatter `git_sha` matches HEAD.

### When to rewrite outside the lookup protocol
After any task that materially changes boundary structure (new adapter, port surface
expansion, leak fix) — update the cache rather than waiting for TTL.

---

## Return

```
cache: <fresh | rebuilt> · <path> · git_sha <short sha>
adapters: <n> · ports: <n> · leaks: <n>

<the Convention / Adapters / Ports / Leaks block from the cache>
```
