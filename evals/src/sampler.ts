import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { runOne, type HarnessOptions } from "./harness.ts";
import type { ContextResult, EvalCase, RawSample, SampleResult, ToolInvocation } from "./types.ts";

const POSITION_SCORES = [1.0, 0.7, 0.4, 0.2, 0.1];

function positionScore(idx: number): number {
  return POSITION_SCORES[idx] ?? 0.05;
}

export function evaluateSample(testCase: EvalCase, raw: RawSample): SampleResult {
  const expected = testCase.expected;
  let pass = false;
  let positionRank = 0;

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
  }

  return { ...raw, pass, positionRank };
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

  return { pass: majorityPass, quality, samples: results };
}
