---
name: hypothesis-handling
description: How to transmit beliefs across a delegation boundary and how agents must answer them. Callers label hypotheses as hypotheses and attach the reasoning chain; agents return CONFIRMED / REFUTED / PARTIALLY / UNPROVABLE-HERE with file:line evidence, refutations first. Active whenever work is delegated to or performed by a subagent.
---

# Hypothesis Handling

Delegation defaults to agreement. A subagent given a task plus the orchestrator's
theory will tend to find evidence for the theory, because confirming closes the
task and refuting reopens it. That bias is the main correctness risk in a
multi-agent run, and it is cheap to invert: ask for refutation explicitly, and
make refutation a reportable success.

This rule has two halves. Both are required — the caller's half is what makes the
agent's half possible.

---

## Caller's half — transmit the reasoning, not just the conclusion

**Send the chain, not the verdict.** "Confirm that X is caused by Y" can only be
answered yes or no. "I think X is caused by Y, because A implies B implies Y —
confirm or refute" can be answered *"your conclusion is right but A does not imply
B, and the real mechanism is Z"* — which is the most valuable answer available,
and is unreachable if the reasoning was never transmitted. A wrong mechanism
behind a right conclusion will produce wrong work the moment the task changes
shape.

Checklist for any dispatch containing a belief:

1. **Label the belief as a belief.** "My hypothesis", "I believe", "my read is" —
   never state a hypothesis in the same register as an established fact. An agent
   cannot attack what it reads as given.
2. **Include the inference steps**, with the `file:line` you drew them from, so
   each step is independently attackable.
3. **Say what turns on it** — "`mn`'s whole implementation hangs off this" tells
   the agent how hard to push and justifies spending more effort on refutation.
4. **Ask for the falsifier**: "if I'm wrong about the mechanism, say so".
5. **State which of the two failure modes matters.** When absence of a signal is
   ambiguous, name the ambiguity: *"I need to know whether the absence of this log
   in the next run means 'condition was false' or 'never got that far' — I must
   not mistake one for the other."* Naming it is usually enough to get it settled.
6. **Never ask two agents to confirm the same thing without telling each about the
   other.** Independent confirmation is valuable; duplicated confirmation with
   shared framing is just the same bias twice.

**Cross-checking is cheap — use it on load-bearing claims.** When a conclusion
gates real work, put two or three agents on it from *different vantage points*
(the producer repo, the consumer repo, the wire/reflection layer) rather than
asking one agent twice. Independent agreement from different evidence bases is
worth far more than a single deep confirmation, and disagreement between vantage
points is itself the finding.

---

## Agent's half — attack the premise, report the result

1. **Restate the claim you were given** before evaluating it, in your own words.
   Restating surfaces misreadings that evaluation hides.
2. **Return one of four verdicts**, never a hedge:

   | Verdict | Meaning |
   |---|---|
   | `CONFIRMED` | The claim and its reasoning both hold, with evidence |
   | `REFUTED` | The claim does not hold |
   | `PARTIALLY — right conclusion, wrong mechanism` | Outcome correct, reasoning wrong. Say what the real mechanism is. |
   | `UNPROVABLE HERE` | Cannot be settled from your vantage point. Say what *would* settle it, and who has that vantage point. |

3. **Refutations go first** in your report, ahead of anything confirming. The
   caller is acting on the premise right now; every paragraph before the
   correction is a paragraph of wrong work.
4. **Cite `file:line` or a verbatim log line.** "I checked and it's fine" is not a
   verdict. Evidence is the deliverable; the conclusion is a summary of it.
5. **Retract your own earlier claims the moment you find them over-broad.** A
   correction to yourself is worth more than a correction to anyone else, because
   nobody else is positioned to catch it. Label it plainly — "I need to correct my
   own claim" — and say what was true and what the scope of the error was ("true
   of an already-materialized container; false for a server-persisted one").
6. **`UNPROVABLE HERE` is a real answer.** Reaching for a plausible-sounding
   conclusion from insufficient evidence is the failure mode this whole rule
   exists to prevent. An honest boundary lets the caller route around it; a
   confident guess does not.
7. **Report inconvenient side-findings you were not asked about.** A latent bug
   spotted in passing (a second, unrelated defect in the same handler) is worth
   flagging even when out of scope — flag it, don't fix it, and say you did not
   fix it.

---

## Why this pays

The pattern's value is asymmetric. A confirmation saves nothing — the work
proceeds as planned either way. A refutation caught early saves the entire
downstream implementation built on the wrong premise, and refutations arrive most
often on exactly the claims that gate the most work, because those are the ones
under the most pressure to be true.
