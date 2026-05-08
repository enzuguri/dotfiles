---
name: boundaries
description: Identifies and enforces abstraction boundaries between call hierarchies. Implementation details — libraries, transport, storage, internal shapes — must not leak across them. Always active — applies to exploration, design, and edit-time review.
---

# Abstraction Boundaries

## Principle

Every call hierarchy has implicit or explicit boundaries. Implementation details — third-party libraries, transport mechanics, storage formats, internal data shapes — must not cross them. Consumers see only domain-shaped interfaces; what's below the boundary is replaceable without consumer change.

Convenience is paid once per call site. Lock-in compounds across every consumer. The abstraction earns its keep at swap-out.

---

## Detection

Each codebase has its own boundary conventions. **Discover them, don't prescribe them.** The signal is structural (what does this file actually do?), not nominal (what's it called?). Most codebases are not diligent about formal hex/ports-and-adapters naming — boundaries still exist, just under whatever names the project chose. Defer to `project-conventions` on naming once the convention is identified.

### Step 1 — Find adapters by their imports

A file is an adapter, regardless of name or location, if it imports a third-party library that performs I/O, persistence, or external integration.

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

Also: imports from internal infrastructure modules. Names vary by project (`*Client`, `*Service`, `*Api`, `*Repository`, `*Gateway`, `*Store`, `*Driver`, etc.) — discover the local pattern, don't assume one.

### Step 2 — Cluster to discover the convention

Group adapter files by directory. The clustering reveals the codebase's convention. Shapes you might encounter (illustrative, not prescriptive):

- `api/`, `lib/`, `utils/`, `helpers/`
- `services/`, `clients/`, `data/`
- `hooks/`, `queries/`, `mutations/`, `store/`
- `infra/`, `adapters/`, `repositories/`, `ports/`
- Co-located per feature: `<feature>/api.ts`, `<feature>/queries.ts`

Pick the convention this codebase already uses. **Match it; never introduce a new one without explicit justification.** If I/O imports are genuinely scattered with no pattern, surface that as a finding — proposing a convention is itself a design decision worth discussing.

### Step 3 — The port is the public surface

Within the adapter cluster, the port is what consumers are *allowed* to import. Detect it by:
- What's re-exported through a barrel (`index.ts`) vs. what's internal-only
- What consumer files actually import from the cluster
- Named exports vs. internal helpers

**Above the port** (consumer code):
- Imports only from port modules, never from infra libs directly
- Types are domain-named (`User`, not `UserResponse` / `UserDTO`)
- camelCase, no HTTP-shaped fields, no library types

---

## Canonical Example

Paths below follow whatever convention the codebase already uses (`adapters/` here is illustrative — could equally be `hooks/`, `api/`, `services/`, etc.).

```ts
// adapters/userQueries.ts — below the boundary
import { useQuery } from '@tanstack/react-query';

export const useUser = (id: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user', id],
    queryFn: () => userClient.get(id),
  });
  return { user: data, isLoading, error };
};
```

```tsx
// components/UserCard.tsx — above the boundary
import { useUser } from '@/adapters/userQueries';

export const UserCard = ({ id }: { id: string }) => {
  const { user, isLoading, error } = useUser(id);
  // ...
};
```

The component never names `useQuery`, `queryKey`, `queryFn`, or `queryClient`. Swapping React Query for SWR is a one-file change.

---

## Smells (cross-boundary leaks)

- Consumer file imports a third-party I/O library directly
- Consumer references transport-shaped types (`UserResponse`, `UserDTO`, snake_case fields)
- Function names betray the mechanism (`fetchUser`, `useFetchUser`) rather than the operation (`getUser`, `useUser`)
- Cache keys, query keys, connection strings appearing in consumer code
- Consumer knows HTTP status codes, retry counts, cache freshness, pagination cursors
- Cache invalidation outside the mutation hook (`queryClient.invalidateQueries` in a component)
- Domain logic checking transport state (`if (response.status === 404)` rather than `if (!user)`)

---

## When editing existing code

1. **Map the call hierarchy first.** Identify consumers vs. adapters before changing anything.
2. **Verify the change does not introduce a cross-boundary import.** If a consumer file currently imports a port and the edit adds an infra import, the abstraction has been violated.
3. **If a consumer needs new domain data, expand the port's interface first; update consumers second.** The port shape is the contract.
4. **Cross-boundary imports are explicit design decisions, never silent edits.** Surface them.

---

## When creating new concepts

A new concept that wraps an external dependency, hides non-trivial computation, or owns domain state needs a port.

1. **Name the port for the operation, not the mechanism** — `useUser`, not `useFetchUser`. `saveDraft`, not `postDraft`.
2. **Define the port's interface in domain terms before writing the implementation.** Domain types in, domain types out.
3. **All references to the underlying library are contained in the adapter file.** The port surface re-exports only the domain-shaped subset.
4. **Mutations follow the same pattern**: `useUpdateUser` owns its own invalidation; consumers call `mutate` without knowing which cache keys were touched.

---

## Trade-offs

The discipline is absolute by default. Known exceptions:

- **Throwaway prototypes, single-file scripts** — no consumer to protect.
- **Operations with no plausible alternative implementation** (`crypto.randomUUID`, `Date.now()`) — direct use is fine.
- **The adapter *is* the consumer** (e.g. a worker script that owns the application layer end-to-end) — the port collapses; document why.

Surface the trade-off when relaxing the rule. Never silently relax.

---

## Caching

For large repos the discovery algorithm has real cost on cold runs. Cache the result per repo at `.agent-shell/boundaries.md`. Ensure `.agent-shell/` is gitignored in the consuming repo.

### Cache file format

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

### Lookup protocol

Before running discovery (Detection Steps 1–3):

1. **No cache file** → full discovery, write the cache, done.
2. **Cache exists, `git_sha` matches HEAD, `generated_at` within `ttl_days`** → use cache as-is.
3. **Otherwise** (SHA mismatch or TTL expired) → full discovery, overwrite the cache.

No incremental rebuilds. Full rebuild is fast enough at most scales; if it isn't, partition the repo by area first.

### Manual invalidation
`rm .agent-shell/boundaries.md` to force a fresh build.

### When to write
- After every full discovery run.
- After any task that materially changes boundary structure (new adapter, port surface expansion, leak fix) — update the cache rather than waiting for TTL.

---

## Reporting

### `explore-agent` output (added to its codebase summary)

```
### Abstraction Boundaries

**Adapters identified:**
- `path/to/adapter.ts` — wraps <library>, exposes <port name>

**Ports identified:**
- `path/to/port.ts` — interface for <domain operation>, consumed by <consumers>

**Cross-boundary leaks:**
- `<file>:<line>` — imports <library> directly; expected to consume <port>
```

### `design-discussion` output (added to architectural constraints, when introducing new concepts)

```
### Boundary Proposal

**Operation**: <domain-named operation>
**Port interface**: <signature in domain terms>
**Adapter location**: <file path>
**Consumer expectations**: <what's exposed, what's hidden>
```
