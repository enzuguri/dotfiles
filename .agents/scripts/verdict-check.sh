#!/usr/bin/env bash
# verdict-check.sh — gather subagent final reports for the Q2 check.
#
# Q2 (see open-questions.md): does the "confirm or refute" framing survive being
# codified, or does it degrade into ritual CONFIRMED lines?
#
# This script GATHERS; it does not classify. Semantic classification (was the
# verdict load-bearing? was the refutation real or manufactured?) needs a read.
# The point is to make that read cheap and repeatable, not to automate it away.
#
# Usage:
#   verdict-check.sh <project-session-dir> [since-date YYYY-MM-DD]
#
# Example:
#   ./verdict-check.sh ~/.claude/projects/-Users-me-dev-repo/<session-id> 2026-08-07
#
# Structural markers are a weak proxy and are printed only as a triage hint —
# never treat the counts as the finding.
#
# ⚠️ BIT ROT: this parses an undocumented transcript format (session JSONL +
# subagents/*.meta.json). A harness change can break it silently. A zero-dispatch
# result means "verify the script" BEFORE it means "no data" — check that the
# session dir has a subagents/ folder with .meta.json files and that jq still
# resolves .message.content[]. Fails loudly on a missing dir; everything else
# degrades to empty output.

set -euo pipefail

dir="${1:?usage: verdict-check.sh <session-dir> [since YYYY-MM-DD]}/subagents"
since="${2:-0000-00-00}"
[ -d "$dir" ] || { echo "no subagents/ under $1" >&2; exit 1; }

total=0
for m in "$dir"/*.meta.json; do
  [ -e "$m" ] || continue
  d=$(stat -f '%Sm' -t '%Y-%m-%d' "$m" 2>/dev/null || date -r "$m" +%Y-%m-%d)
  [[ "$d" > "$since" || "$d" == "$since" ]] || continue

  f="${m%.meta.json}.jsonl"; [ -f "$f" ] || continue
  name=$(jq -r '.name // .agentType' "$m")
  desc=$(jq -r '.description // "-"' "$m")
  total=$((total+1))

  report=$(jq -r 'select(.type=="assistant") | .message.content[]?
            | select(.type=="text") | .text' "$f" 2>/dev/null | tail -c 2500)
  [ -n "$report" ] || continue

  printf '════════ %s (%s) — %s\n' "$name" "$d" "$desc"

  # Triage hints only. Structural, not semantic.
  printf '  markers:'
  for pat in 'REFUT|refut|contradict|overturn|retract' \
             'CONFIRM|confirm' \
             'Not established|UNPROVABLE|cannot (be )?(prove|settle|determine)|gap' \
             'correct(ion|s|ing)? (my|your|the|earlier)|I was wrong'; do
    printf ' %s=%s' "${pat%%|*}" "$(grep -icE "$pat" <<<"$report" || true)"
  done
  printf '\n\n%s\n\n' "$report"
done

cat <<EOF
──────── $total dispatch(es) since $since

Classify each by hand against open-questions.md § Q2:
  REFUTED / PARTIALLY / UNPROVABLE-HERE / CONFIRMED / no-hypothesis-carried

Healthy   — a meaningful minority of non-CONFIRMED verdicts, each citing
            file:line or a verbatim line; refutations are load-bearing.
Ritual    — near-100% CONFIRMED, verdicts asserted without evidence.
Manufactured — refutations on trivia, disagreement that changes no decision.
EOF
