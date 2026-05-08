import type { RawSample } from "./types.ts";

// Per-million-token rates. Update when pricing shifts.
// Source: anthropic.com/pricing as of 2026-01.
const PRICING = {
  sonnet: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
  haiku: { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  opus: { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite: 18.75 },
} as const;

export type ModelKey = keyof typeof PRICING;

function resolveModel(model: string | undefined): ModelKey {
  if (!model) return "sonnet";
  if (model.includes("haiku")) return "haiku";
  if (model.includes("opus")) return "opus";
  return "sonnet";
}

export function estimateCostUsd(sample: RawSample, model?: string): number {
  if (sample.costUsd > 0) return sample.costUsd;
  const r = PRICING[resolveModel(model)];
  return (
    (sample.inputTokens / 1_000_000) * r.input +
    (sample.outputTokens / 1_000_000) * r.output +
    (sample.cacheReadTokens / 1_000_000) * r.cacheRead +
    (sample.cacheCreateTokens / 1_000_000) * r.cacheWrite
  );
}
