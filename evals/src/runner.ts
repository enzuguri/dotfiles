import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { loadAgentsFromDir } from "./load-agents.ts";
import { loadCasesFromDir } from "./load-cases.ts";
import { runSamples } from "./sampler.ts";
import { estimateCostUsd } from "./cost.ts";
import type { Context, EvalCase, EvalResult, ContextResult } from "./types.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const EVALS_ROOT = join(REPO_ROOT, "evals");
const AGENTS_DIR = join(REPO_ROOT, ".agents", "agents");
const FIXTURE_DIR = join(EVALS_ROOT, "fixtures", "open-world-agents");
const CASES_DIR = join(EVALS_ROOT, "cases");

export type RunnerConfig = {
  filter?: string;
  caseId?: string;
  samples: number;
  budgetUsd: number;
  concurrency: number;
  model: string;
  verbose: boolean;
};

export type RunnerSummary = {
  results: EvalResult[];
  totalCostUsd: number;
  totalDurationMs: number;
  budgetExceeded: boolean;
  openWorldEmpty: boolean;
};

function selectCases(all: EvalCase[], cfg: RunnerConfig): EvalCase[] {
  return all.filter((c) => {
    if (cfg.caseId && c.id !== cfg.caseId) return false;
    if (cfg.filter && !c.id.includes(cfg.filter)) return false;
    return true;
  });
}

type Job = { caseId: string; context: Context; testCase: EvalCase; agents: Record<string, AgentDefinition> };

export async function runSuite(cfg: RunnerConfig): Promise<RunnerSummary> {
  const t0 = Date.now();

  const closedAgents = await loadAgentsFromDir(AGENTS_DIR);
  let fixtureAgents: Record<string, AgentDefinition> = {};
  let openWorldEmpty = false;
  try {
    fixtureAgents = await loadAgentsFromDir(FIXTURE_DIR);
    if (Object.keys(fixtureAgents).length === 0) openWorldEmpty = true;
  } catch {
    openWorldEmpty = true;
  }
  const openAgents = { ...closedAgents, ...fixtureAgents };

  const allCases = await loadCasesFromDir(CASES_DIR);
  const cases = selectCases(allCases, cfg);
  if (cases.length === 0) throw new Error(`no cases matched filters (filter=${cfg.filter ?? ""} case=${cfg.caseId ?? ""})`);

  if (cfg.verbose) {
    console.log(`closed-world agents: ${Object.keys(closedAgents).length}`);
    console.log(`open-world fixture agents: ${Object.keys(fixtureAgents).length}${openWorldEmpty ? " (empty — open context will mirror closed)" : ""}`);
    console.log(`cases selected: ${cases.length}\n`);
  }

  const partial = new Map<string, { closed?: ContextResult; open?: ContextResult }>();
  for (const c of cases) partial.set(c.id, {});

  const jobs: Job[] = [];
  for (const c of cases) {
    jobs.push({ caseId: c.id, context: "closed", testCase: c, agents: closedAgents });
    if (!openWorldEmpty) {
      jobs.push({ caseId: c.id, context: "open", testCase: c, agents: openAgents });
    }
  }

  let cumulativeCost = 0;
  let budgetExceeded = false;
  let nextJobIdx = 0;

  async function worker(workerId: number): Promise<void> {
    while (true) {
      if (budgetExceeded) return;
      const idx = nextJobIdx++;
      if (idx >= jobs.length) return;
      const job = jobs[idx]!;
      if (cfg.verbose) console.log(`[worker ${workerId}] start ${job.caseId} (${job.context})`);

      const result = await runSamples(job.testCase, job.agents, cfg.samples, { model: cfg.model });

      const slot = partial.get(job.caseId)!;
      slot[job.context] = result;

      const sampleCost = result.samples.reduce((sum, s) => sum + estimateCostUsd(s, cfg.model), 0);
      cumulativeCost += sampleCost;
      if (cfg.verbose) {
        console.log(`[worker ${workerId}] done ${job.caseId} (${job.context}) — pass=${result.pass} quality=${result.quality.toFixed(2)} cost~$${sampleCost.toFixed(4)} cumulative~$${cumulativeCost.toFixed(4)}`);
      }
      if (cumulativeCost > cfg.budgetUsd) {
        budgetExceeded = true;
        console.warn(`! budget exceeded ($${cumulativeCost.toFixed(4)} > $${cfg.budgetUsd}) — aborting further jobs`);
        return;
      }
    }
  }

  const workers = Array.from({ length: Math.max(1, cfg.concurrency) }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  const results: EvalResult[] = [];
  for (const c of cases) {
    const slot = partial.get(c.id)!;
    const closed = slot.closed;
    const open = slot.open ?? closed;
    if (!closed) continue;
    const allSamples = [...closed.samples, ...(slot.open?.samples ?? [])];
    const totalCostUsd = allSamples.reduce((sum, s) => sum + estimateCostUsd(s, cfg.model), 0);
    const totalDurationMs = allSamples.reduce((sum, s) => sum + s.durationMs, 0);
    results.push({
      caseId: c.id,
      expected: c.expected,
      closed,
      open: open!,
      totalCostUsd,
      totalDurationMs,
    });
  }

  return {
    results,
    totalCostUsd: cumulativeCost,
    totalDurationMs: Date.now() - t0,
    budgetExceeded,
    openWorldEmpty,
  };
}
