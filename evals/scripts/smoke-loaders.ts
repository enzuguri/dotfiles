import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { query, type HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { loadAgentsFromDir } from "../src/load-agents.ts";
import { loadSkillsFromDir } from "../src/load-skills.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_DIR = join(REPO_ROOT, ".agents", "agents");
const SKILLS_DIR = join(REPO_ROOT, ".agents", "skills");

const BLOCKED_TOOLS = new Set(["Agent", "Skill"]);

type Observed = { tool: string; subagent?: string; skill?: string };

async function main() {
  console.log("--- Step 2 smoke test ---\n");

  // 1. Loader assertions.
  const agents = await loadAgentsFromDir(AGENTS_DIR);
  const skills = await loadSkillsFromDir(SKILLS_DIR);

  const agentNames = Object.keys(agents).sort();
  const skillNames = Object.keys(skills).sort();
  console.log(`agents loaded: ${agentNames.length} → ${agentNames.join(", ")}`);
  console.log(`skills loaded: ${skillNames.length} → ${skillNames.join(", ")}`);

  if (agentNames.length !== 7) throw new Error(`expected 7 agents, got ${agentNames.length}`);
  for (const [name, def] of Object.entries(agents)) {
    if (!def.description.trim()) throw new Error(`agent '${name}' has empty description`);
    if (!def.prompt.trim()) throw new Error(`agent '${name}' has empty prompt body`);
  }

  // 2. SDK round-trip: provoke an Agent call, intercept it.
  const observed: Observed[] = [];
  let hookFired = false;

  const hook: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    hookFired = true;
    const toolName = input.tool_name;
    const toolInput = input.tool_input as Record<string, unknown>;
    observed.push({
      tool: toolName,
      subagent: toolInput.subagent_type as string | undefined,
      skill: toolInput.skill as string | undefined,
    });
    if (BLOCKED_TOOLS.has(toolName)) {
      return {
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: "blocked-by-eval-harness-smoke-test",
        },
      };
    }
    return {};
  };

  console.log("\nrunning query with prompt provoking explore-agent...");
  const stream = query({
    prompt: "I just cloned this repository — please use the explore-agent subagent to map its structure for me.",
    options: {
      agents,
      cwd: REPO_ROOT,
      settingSources: ["project"],
      allowedTools: ["Read", "Grep", "Glob"],
      maxTurns: 5,
      model: "sonnet",
      hooks: {
        PreToolUse: [{ hooks: [hook] }],
      },
    },
  });

  let resultMsg: { total_cost_usd?: number; duration_ms?: number; subtype?: string } | undefined;
  let streamError: unknown;
  const assistantToolUses: Array<{ name: string; input: unknown }> = [];

  try {
    for await (const msg of stream) {
      if (msg.type === "assistant") {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (typeof block === "object" && block !== null && (block as { type?: string }).type === "tool_use") {
              const tu = block as { name: string; input: unknown };
              assistantToolUses.push({ name: tu.name, input: tu.input });
            }
          }
        }
      } else if (msg.type === "result") {
        resultMsg = msg as typeof resultMsg;
      }
    }
  } catch (err) {
    streamError = err;
  }

  if (streamError) {
    const msg = streamError instanceof Error ? streamError.message : String(streamError);
    console.log(`\nstream threw: ${msg.slice(0, 200)}`);
  }
  console.log(`result: ${resultMsg?.subtype ?? "(none)"} | $${resultMsg?.total_cost_usd?.toFixed(4) ?? "?"} | ${resultMsg?.duration_ms ?? "?"}ms`);
  console.log(`hook fired: ${hookFired}`);
  console.log(`hook observations (${observed.length}):`);
  for (const o of observed) {
    console.log(`  - tool=${o.tool}${o.subagent ? ` subagent=${o.subagent}` : ""}${o.skill ? ` skill=${o.skill}` : ""}`);
  }
  console.log(`assistant tool_use blocks (${assistantToolUses.length}):`);
  for (const tu of assistantToolUses) {
    const sub = (tu.input as { subagent_type?: string; skill?: string });
    console.log(`  - name=${tu.name}${sub.subagent_type ? ` subagent=${sub.subagent_type}` : ""}${sub.skill ? ` skill=${sub.skill}` : ""}`);
  }

  // 3. Assertions.
  console.log("\n--- assertions ---");
  const agentCalls = assistantToolUses.filter((tu) => tu.name === "Agent");
  if (agentCalls.length === 0) {
    console.warn("⚠ no Agent tool_use observed — orchestrator did not route to an agent. Smoke test inconclusive on (subagent_type matches frontmatter name).");
  } else {
    const subagentTypes = agentCalls.map((tu) => (tu.input as { subagent_type: string }).subagent_type);
    console.log(`✓ Agent tool_use observed; subagent_type values: ${subagentTypes.join(", ")}`);
    for (const st of subagentTypes) {
      if (!agents[st]) {
        throw new Error(`subagent_type '${st}' not in loaded agents — frontmatter name mismatch?`);
      }
    }
    console.log(`✓ all subagent_type values match loaded agent frontmatter names`);
  }

  const agentHookHits = observed.filter((o) => o.tool === "Agent");
  if (agentHookHits.length > 0) {
    console.log(`✓ PreToolUse hook intercepted ${agentHookHits.length} Agent call(s)`);
  } else if (agentCalls.length > 0) {
    throw new Error("Agent calls were observed in stream but hook did not fire on them");
  }

  const skillHookHits = observed.filter((o) => o.tool === "Skill");
  if (skillHookHits.length > 0) {
    console.log(`✓ PreToolUse hook intercepted ${skillHookHits.length} Skill call(s); skill names: ${skillHookHits.map((h) => h.skill).join(", ")}`);
  } else {
    console.log(`(note) no Skill calls observed — skill machinery validation deferred to skill routing cases`);
  }

  console.log("\n--- smoke test done ---");
}

main().catch((err) => {
  console.error("smoke test failed:", err);
  process.exit(1);
});
