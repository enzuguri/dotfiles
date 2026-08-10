# 0002 — Diagnostic firewalls stay read-only; no "devops" agent

- **Status**: Accepted
- **Date**: 2026-08-07
- **Evidence**: same instrumented session as [0001](0001-subagents-are-context-firewalls.md)

## Context

`log-reader` was added on 2026-08-06 and was immediately effective. The natural
next question: generalise it into a broader "devops" agent that also owns `ps`,
`top`, `lsof`, container state, and process management — since a residue of
orchestrator Bash calls is still system-level.

The proposal is intuitive. Everything below the application looks like one domain,
and one agent for "infrastructure" reads as tidier than a specialised log reader.

## Decision

**No.** `log-reader` keeps its read-only contract. It may be widened along its
*evidence sources* (process table, sockets, DNS, HTTP probes, container state
alongside logs) but **never along its verbs**. Every mutating operation —
`kill`, `pkill`, service start/restart, `docker compose up`, environment
regeneration — stays with the orchestrator.

If the source-widening happens, rename to something evidence-shaped
(`diagnostics-agent`), never persona-shaped.

## Evidence

Two numbers decided it.

**1. The prize is 1.3%.** Process/socket inspection was 12 calls and 4.6 KB — 1.3%
of the orchestrator's Bash context. Log analysis alone was 239 calls and 291 KB
(84%). The existing agent already captures the overwhelming majority of the
available benefit; the proposed expansion targets a rounding error.

**2. Firewall value = input volume ÷ conclusion size.** This is the generalisable
principle, and it is *not* subject matter:

- Log analysis: megabytes in, "run 3 completed, here are the two proving lines"
  out. Ratio in the thousands.
- `lsof -nP -iTCP:8088`: three lines in, three lines of meaning out, and the answer
  immediately determines the orchestrator's next action. Ratio ≈ 1.

A firewall pays when input is large and the conclusion is small. Grouping by
topic ("infra") mixes both ratios into one agent and predicts nothing.

**Corroborating observation.** The genuinely investigation-shaped system diagnosis
in that session — the zombie-socket hunt, and the tunnel probe that established
`/etc/hosts` had grown from 9 to 3,401 lines, resolved the service name, and TCP
connected to :7777 — *was* already firewalled. It ran inside the repo agent that
owned the service, not the orchestrator. That is why the orchestrator's own
process-inspect count is only 12. The team found the right boundary organically,
and it was not "devops" — it was "the agent with the context to interpret what it
found".

## Alternatives rejected

**A "devops" agent with mutation rights.** The decisive argument is not the 1.3%,
it is safety. A firewall is cheap to trust *because* it is read-only: its
conclusion can be accepted without reading its transcript. Grant mutation and you
must audit what it actually did — which means reading the transcript — and **a
firewall you have to audit is not a firewall, just a subagent.**

It also diffuses process ownership, which is the one rule already violated
expensively in the observed session: `pkill -f ':service:bootRun'` matched three
services and killed all of them. Two actors believing they own the ports makes
that class of accident more likely, not less.

**A "devops" agent that is read-only anyway.** Then the name is actively
misleading — it advertises capabilities it must refuse, and persona names attract
scope by association. Someone will eventually ask it to bounce a service, because
that is what "devops" means.

## Consequences

- New agents are justified on **job shape and the volume ratio**, not on domain
  coverage. "There is a category of commands with no agent" is not sufficient
  cause.
- The taxonomy stays legible, split by evidence type rather than topic:

  | Agent | Evidence | Answers |
  |---|---|---|
  | `explore` / `review` | Source and diffs | What does the code say? |
  | `verification` | The project's declared checks | Is the code healthy? |
  | `log-reader` | Live runtime output | What is the running system doing? |
  | Orchestrator | — | Owns every command that changes it |

- Single-owner process control is preserved. `log-reader`'s output schema carries
  `orchestrator action needed: <exact command>` so it can *ask* without touching.
- Accepted cost: single-fact runtime lookups stay inline, and that is correct —
  round-tripping 387 bytes through an agent costs more latency than the context
  it saves.

## What would change this

- A session where process/socket inspection exceeds ~10% of orchestrator context
  — likely an incident-response or infra-migration workload rather than feature
  work, which may warrant its own record rather than amending this one.
- Recurring need for **multi-step runtime investigation with no log file** (a hung
  port, a container that will not come up, a DNS failure). That is investigation-
  shaped and would justify widening the evidence sources — still not the verbs.
- A harness capability for genuinely sandboxed mutation with an auditable,
  compact action log would reopen the mutation question, since it removes the
  "you must read the transcript" objection.
