# Non-TypeScript equivalents

## Brands

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

## Parser libraries

Python: pydantic, dataclasses + parsers. Rust: serde + `TryFrom`. Swift: `Codable` + Result.

## Capability composition

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
