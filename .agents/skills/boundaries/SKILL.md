---
name: boundaries
description: Abstraction-boundary principles — what must not leak across a port, leak smells, port design, trade-offs. Load when judging whether a change leaks across a boundary or designing a port. Discovery of a repo's boundaries is `discover-boundaries`.
user-invocable: false
---

# Abstraction Boundaries

## Principle

Every call hierarchy has implicit or explicit boundaries. Implementation details — third-party libraries, transport mechanics, storage formats, internal data shapes — must not cross them. Consumers see only domain-shaped interfaces; what's below the boundary is replaceable without consumer change.

Convenience is paid once per call site. Lock-in compounds across every consumer. The abstraction earns its keep at swap-out.

---

## Detection

Each codebase has its own boundary conventions. **Discover them, don't prescribe them.** Discovery — find adapters by their I/O imports, cluster them to learn the convention, identify the port as the public surface, list leaks — is the `discover-boundaries` skill, cached per repo at `.agents/context/boundaries.md`. Read the cache; if it is missing or stale, invoke the skill. Defer to `project-conventions` on naming once the convention is identified.

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

## Reporting

### `design-discussion` output (added to architectural constraints, when introducing new concepts)

```
### Boundary Proposal

**Operation**: <domain-named operation>
**Port interface**: <signature in domain terms>
**Adapter location**: <file path>
**Consumer expectations**: <what's exposed, what's hidden>
```
