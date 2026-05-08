import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { runOne, type HarnessOptions } from "./harness.ts";
import type { ContextResult, EvalCase, ExpectedRoute, RawSample, SampleResult, ToolInvocation } from "./types.ts";

const POSITION_SCORES = [1.0, 0.7, 0.4, 0.2, 0.1];

function positionScore(idx: number): number {
  return POSITION_SCORES[idx] ?? 0.05;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ");
}

function nameMentioned(text: string, targets: ExpectedRoute[]): boolean {
  if (!text) return false;
  const haystack = normalize(text);
  for (const t of targets) {
    if (t.kind === "none") continue;
    if (haystack.includes(normalize(t.name))) return true;
  }
  return false;
}

export function evaluateSample(testCase: EvalCase, raw: RawSample): SampleResult {
  const expected = testCase.expected;
  let pass = false;
  let positionRank = 0;
  let expectedNameMentioned = false;

  if (expected.kind === "none") {
    pass = raw.invocations.length === 0;
    positionRank = pass ? 1 : 0;
  } else {
    const targets = [expected, ...testCase.alternates];
    const matchIdx = raw.invocations.findIndex((inv: ToolInvocation) =>
      targets.some((t) => t.kind !== "none" && inv.type === t.kind && inv.name === t.name),
    );
    if (matchIdx >= 0) {
      pass = true;
      positionRank = positionScore(matchIdx);
    }
    expectedNameMentioned = nameMentioned(raw.preToolText, targets);
  }

  return { ...raw, pass, positionRank, expectedNameMentioned };
}

export async function runSamples(
  testCase: EvalCase,
  agents: Record<string, AgentDefinition>,
  samples: number,
  options?: HarnessOptions,
): Promise<ContextResult> {
  const results: SampleResult[] = [];
  for (let i = 0; i < samples; i++) {
    const raw = await runOne(testCase, agents, options);
    results.push(evaluateSample(testCase, raw));
  }

  const passes = results.filter((r) => r.pass).length;
  const majorityPass = passes * 2 > samples;

  const passingRanks = results.filter((r) => r.pass).map((r) => r.positionRank);
  const quality = passingRanks.length > 0 ? passingRanks.reduce((a, b) => a + b, 0) / passingRanks.length : 0;

  const mentionCount = results.filter((r) => r.expectedNameMentioned).length;

  return { pass: majorityPass, quality, mentionCount, samples: results };
}
