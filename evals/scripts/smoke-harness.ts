import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentsFromDir } from "../src/load-agents.ts";
import { runOne } from "../src/harness.ts";
import type { EvalCase } from "../src/types.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_DIR = join(REPO_ROOT, ".agents", "agents");

async function main() {
  console.log("--- Step 3 harness smoke test ---\n");

  const agents = await loadAgentsFromDir(AGENTS_DIR);

  const testCase: EvalCase = {
    id: "harness-smoke",
    prompt:
      "I just cloned this repository — please use the explore-agent subagent to map its structure for me.",
    expected: { kind: "agent", name: "explore-agent" },
    alternates: [],
    notes: "Hand-crafted Step 3 gate case. Should observably route to explore-agent.",
  };

  console.log(`case.id: ${testCase.id}`);
  console.log(`case.prompt: ${testCase.prompt}`);
  console.log(`case.expected: ${testCase.expected.kind}:${"name" in testCase.expected ? testCase.expected.name : ""}\n`);

  const t0 = Date.now();
  const sample = await runOne(testCase, agents);
  const wallMs = Date.now() - t0;

  console.log(`--- runOne returned (wall ${wallMs}ms) ---`);
  console.log(`durationMs: ${sample.durationMs}`);
  console.log(`costUsd: $${sample.costUsd.toFixed(4)} (authoritative; 0 when aborted)`);
  console.log(`tokens: ${sample.inputTokens} in / ${sample.outputTokens} out`);
  console.log(`resultSubtype: ${sample.resultSubtype ?? "(none)"}`);
  console.log(`errored: ${sample.errored}`);
  console.log(`invocations (${sample.invocations.length}):`);
  for (const inv of sample.invocations) {
    console.log(`  [${inv.position}] ${inv.type}:${inv.name}`);
  }

  console.log("\n--- assertions ---");
  if (sample.invocations.length === 0) {
    throw new Error("expected at least one invocation, got none");
  }
  const expectedName = (testCase.expected as { kind: "agent"; name: string }).name;
  const matched = sample.invocations.find(
    (i) => i.type === "agent" && i.name === expectedName,
  );
  if (!matched) {
    throw new Error(
      `expected invocation 'agent:${expectedName}' not in observations: ${JSON.stringify(sample.invocations)}`,
    );
  }
  console.log(`✓ invocations contain agent:${expectedName} at position ${matched.position}`);

  if (sample.invocations.some((i) => i.position < 0)) {
    throw new Error("invocation position must be non-negative");
  }
  console.log(`✓ all invocation positions valid`);

  if (wallMs > sample.durationMs + 500) {
    console.warn(`(note) wall time ${wallMs}ms exceeds reported durationMs ${sample.durationMs}ms by >500ms — abort may be slow`);
  } else {
    console.log(`✓ wall time and reported duration aligned`);
  }

  console.log("\n--- harness smoke done ---");
}

main().catch((err) => {
  console.error("smoke test failed:", err);
  process.exit(1);
});
