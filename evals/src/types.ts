export type ExpectedRoute =
  | { kind: "agent"; name: string }
  | { kind: "skill"; name: string }
  | { kind: "none" };

export type EvalCase = {
  id: string;
  prompt: string;
  expected: ExpectedRoute;
  alternates: ExpectedRoute[];
  preamble?: string;
  notes?: string;
  fixtureCwd?: string;
};

export type ToolInvocation = {
  type: "agent" | "skill";
  name: string;
  position: number;
};

export type RawSample = {
  invocations: ToolInvocation[];
  preToolText: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  durationMs: number;
  resultSubtype?: string;
  errored: boolean;
};

export type SampleResult = RawSample & {
  pass: boolean;
  positionRank: number;
  expectedNameMentioned: boolean;
};

export type ContextResult = {
  pass: boolean;
  quality: number;
  mentionCount: number;
  samples: SampleResult[];
};

export type EvalResult = {
  caseId: string;
  expected: ExpectedRoute;
  closed: ContextResult;
  open: ContextResult;
  totalCostUsd: number;
  totalDurationMs: number;
};

export type Context = "closed" | "open";

export type SkillDefinition = {
  name: string;
  description: string;
};
