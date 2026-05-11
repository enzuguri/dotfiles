---
name: types
description: Type design — brands for proof, parse-don't-validate at I/O boundaries, capability composition over monolithic interfaces. Language-agnostic principles with TS/Rust/Swift/Python examples. Always active.
---

# Type Design

Types carry meaning beyond shape. A well-designed type system encodes invariants, identity, and capabilities — not just data layout. Three patterns reinforce each other: parsing produces typed values at I/O boundaries, brands carry proof on those values, capability composition decomposes them into the minimum surface each consumer needs.

---

## Brands

Brands are not a default tool. Reach for them when one of two specific problems applies.

### Problem 1: exhaustive discriminator checks are impractical

Event buses, message queues, plugin registries, observer patterns — places where you can't `switch` over every variant because the set of variants isn't closed or the consumer is generic. A brand on each event/message constant carries its payload type, so dispatch and subscription become type-safe per-event without a god union.

```ts
type EventName<P> = string & { readonly __payload: P };

const USER_CREATED = 'user.created' as EventName<{ id: UserId; email: Email }>;
const ORDER_PLACED = 'order.placed' as EventName<{ orderId: OrderId; total: Cents }>;

bus.dispatch(USER_CREATED, { id, email });          // payload type-checked
bus.on(USER_CREATED, ({ id, email }) => { ... });   // handler typed
```

### Problem 2: a value must prove it was parsed/constrained

`UserId` distinct from `OrgId` (both `string`); `Email` distinct from raw `string`; `Cents` distinct from arbitrary `number`. The brand is proof that the value passed through the parser/factory that enforces the invariant. Downstream code never re-checks.

If neither problem applies, don't brand. Convenience-driven branding adds noise without payoff.

### Pattern across languages

**TypeScript** — no native nominal types; phantom marker is the workaround:
```ts
type Brand<K, T> = K & { readonly __brand: T };
type UserId = Brand<string, 'UserId'>;

export const parseUserId = (s: string): UserId | null =>
  /^[a-z0-9]{12}$/.test(s) ? (s as UserId) : null;
```

**Rust** — canonical newtype + `TryFrom`:
```rust
pub struct UserId(String);

impl TryFrom<&str> for UserId {
    type Error = ParseError;
    fn try_from(s: &str) -> Result<Self, Self::Error> {
        if valid(s) { Ok(UserId(s.into())) } else { Err(...) }
    }
}
```

**Swift** — struct wrapping with failable init:
```swift
struct UserId {
    let value: String
    init?(_ s: String) { guard valid(s) else { return nil }; self.value = s }
}
```

**Python** — `NewType` (conventional, not enforced at runtime):
```python
from typing import NewType
UserId = NewType('UserId', str)
def parse_user_id(s: str) -> UserId | None: ...
```

### Smells
- `as Brand` outside the parser/factory — defeats the proof
- Brands constructed at many call sites instead of a single chokepoint
- `string` / `number` parameters where a brand would carry meaning
- Brands without a corresponding parser — the type exists but nothing can safely produce it
- Re-checking the brand's invariant downstream — the brand is supposed to make that unnecessary

---

## Parse, don't validate

### Principle
At every serialization boundary — every place data crosses I/O — parse untrusted input into a strongly-typed (often branded) value. After parsing, the type is proof. Consumers below the parser trust it; no re-validation.

### Where parse boundaries live
Anywhere data crosses a serialization layer:
- HTTP request / response bodies
- User input (forms, CLI args)
- Environment variables
- Configuration files
- Message queue payloads
- IPC / RPC messages
- File reads of structured formats

### Pattern
The parser is the only function that produces the typed value. Failure produces a typed error or absent value. Downstream code accepts the typed value and trusts it.

```ts
// validate (bad)
function send(to: string) {
  if (!isEmail(to)) throw new Error('bad email');
  // every future call site has to remember
}

// parse (good)
function parseEmail(s: string): Email | ParseError { ... }
function send(to: Email) { /* type proves it */ }
```

### Smells
- Validation logic scattered across consumer code — the type isn't carrying its weight
- Re-validating after a parse — you don't trust your own types
- `unknown` / `any` flowing past a boundary into application code
- Branded types with no parser (impossible to safely construct)
- Parser that returns the same primitive (`parseEmail(s: string): string`) — no proof carried

### Library notes
TS: zod, valibot, arktype, io-ts. Python: pydantic, dataclasses + parsers. Rust: serde + `TryFrom`. Swift: `Codable` + Result. Match the project's existing choice; don't introduce a new parser library on a whim.

---

## Capability composition

### Principle
Decompose types into many narrow interfaces. Combine at use sites; accept the minimum capability needed. Avoid monolithic interfaces and deep inheritance.

### Pattern across languages

**TypeScript** — intersection:
```ts
interface Readable<T> { read(): Promise<T> }
interface Writable<T> { write(value: T): Promise<void> }
interface Closable { close(): Promise<void> }

type Stream<T> = Readable<T> & Writable<T> & Closable;

function consume(s: Readable<User>) { /* accepts minimum */ }
```

**Rust** — trait bounds:
```rust
trait Readable<T> { fn read(&self) -> T; }
trait Writable<T> { fn write(&mut self, v: T); }

fn process<S: Readable<U> + Writable<U>>(s: &mut S) { ... }
```

**Python** — structural `Protocol`:
```python
@runtime_checkable
class Readable(Protocol[T]):
    def read(self) -> T: ...

def consume(r: Readable[User]) -> None: ...
```

**Swift** — protocol composition:
```swift
protocol Readable { associatedtype T; func read() -> T }
protocol Writable { associatedtype T; func write(_ v: T) }

func consume<S: Readable & Writable>(_ s: S) where S.T == User { ... }
```

### Smells
- God interfaces with many methods where callers only need a few
- Deep inheritance hierarchies where flat composition would do
- Functions taking concrete classes instead of capability sets
- Consumer requires `Stream` when it only reads — over-permissioning
- Capabilities atomised past usefulness (split for splitting's sake)

### Trade-offs
Right granularity: "things that change together stay together; things that vary independently split." A capability never used in isolation is fine bundled. Don't atomise to the point of confusion.

---

## How these reinforce

- **Parsing produces branded values.** The parser is the construction chokepoint that enforces the brand's invariant.
- **Brands can witness capabilities.** A `WriteHandle` brand on a resource proves write access; passing it is the type-level grant.
- **Ports** (per `rules/boundaries.md`) are best specified as capability intersections — not a monolithic `UserPort` but the minimum capabilities each consumer needs.

---

## When to relax
- Throwaway scripts: pass strings, validate inline, move on
- Prototype phase: shape first, brands and parsers later
- Foreign-system contracts you don't control: live with unsafe types at the exact seam, isolate them, parse at the next boundary you do own
