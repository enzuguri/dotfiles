import type { ExpectedRoute, EvalResult } from "./types.ts";
import type { RunnerSummary } from "./runner.ts";

function expectedToString(e: ExpectedRoute): string {
  return e.kind === "none" ? "none" : `${e.kind}:${e.name}`;
}

function pad(s: string, n: number): string {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}

function passCell(pass: boolean | undefined, quality: number | undefined): string {
  if (pass === undefined) return "-";
  const mark = pass ? "✓" : "✗";
  const q = quality !== undefined ? quality.toFixed(2) : "0.00";
  return `${mark} ${q}`;
}

export function printReport(summary: RunnerSummary, openWorldEmpty: boolean): void {
  const cols = [
    { title: "case_id", width: 32 },
    { title: "expected", width: 28 },
    { title: "closed", width: 10 },
    { title: "open", width: 10 },
    { title: "cost~$", width: 10 },
    { title: "ms", width: 8 },
  ];

  const header = cols.map((c) => pad(c.title, c.width)).join(" │ ");
  const sep = cols.map((c) => "─".repeat(c.width)).join("─┼─");
  console.log("\n" + header);
  console.log(sep);

  let closedPasses = 0;
  let openPasses = 0;
  let evaluated = 0;

  for (const r of summary.results) {
    const closedStr = passCell(r.closed.pass, r.closed.quality);
    const openStr = openWorldEmpty ? "(skip)" : passCell(r.open.pass, r.open.quality);
    const row = [
      pad(r.caseId, cols[0]!.width),
      pad(expectedToString(r.expected), cols[1]!.width),
      pad(closedStr, cols[2]!.width),
      pad(openStr, cols[3]!.width),
      pad(r.totalCostUsd.toFixed(4), cols[4]!.width),
      pad(String(r.totalDurationMs), cols[5]!.width),
    ].join(" │ ");
    console.log(row);
    if (r.closed.pass) closedPasses++;
    if (!openWorldEmpty && r.open.pass) openPasses++;
    evaluated++;
  }

  console.log(sep);
  console.log(
    `\nclosed pass: ${closedPasses}/${evaluated} (${evaluated > 0 ? Math.round((closedPasses / evaluated) * 100) : 0}%)`,
  );
  if (!openWorldEmpty) {
    console.log(`open pass:   ${openPasses}/${evaluated} (${evaluated > 0 ? Math.round((openPasses / evaluated) * 100) : 0}%)`);
  } else {
    console.log(`open pass:   skipped (no fixture in evals/fixtures/open-world-agents/)`);
  }
  console.log(`total cost (estimated): $${summary.totalCostUsd.toFixed(4)}`);
  console.log(`total wall time: ${(summary.totalDurationMs / 1000).toFixed(1)}s`);
  if (summary.budgetExceeded) console.log(`! BUDGET EXCEEDED — suite aborted early`);
}

export function suitePassed(summary: RunnerSummary, openWorldEmpty: boolean): boolean {
  if (summary.budgetExceeded) return false;
  for (const r of summary.results) {
    if (!r.closed.pass) return false;
    if (!openWorldEmpty && !r.open.pass) return false;
  }
  return true;
}
