import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  query,
  type AgentDefinition,
  type HookCallback,
} from "@anthropic-ai/claude-agent-sdk";
import type { EvalCase, RawSample, ToolInvocation } from "./types.ts";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const BLOCKED_TOOLS = new Set([
  "Agent",
  "Skill",
  "Bash",
  "Edit",
  "Write",
  "NotebookEdit",
  "WebFetch",
  "WebSearch",
]);

const READ_ONLY_TOOLS = ["Read", "Grep", "Glob"];

export type HarnessOptions = {
  model?: string;
  maxTurns?: number;
};

const DEFAULT_OPTIONS: Required<HarnessOptions> = {
  model: "sonnet",
  maxTurns: 5,
};

function extractRouting(content: unknown, startPosition: number): ToolInvocation[] {
  if (!Array.isArray(content)) return [];
  const found: ToolInvocation[] = [];
  let pos = startPosition;
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
    if (b.type !== "tool_use") continue;
    if (b.name === "Agent" && typeof b.input?.subagent_type === "string") {
      found.push({ type: "agent", name: b.input.subagent_type, position: pos++ });
    } else if (b.name === "Skill" && typeof b.input?.skill === "string") {
      found.push({ type: "skill", name: b.input.skill, position: pos++ });
    }
  }
  return found;
}

function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const b = block as { type?: string; text?: string; thinking?: string };
    if (b.type === "text" && typeof b.text === "string") parts.push(b.text);
    else if (b.type === "thinking" && typeof b.thinking === "string") parts.push(b.thinking);
  }
  return parts.join("\n");
}

const denyHook: HookCallback = async (input) => {
  if (input.hook_event_name !== "PreToolUse") return {};
  if (!BLOCKED_TOOLS.has(input.tool_name)) return {};
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "blocked-by-eval-harness",
    },
  };
};

export async function runOne(
  testCase: EvalCase,
  agents: Record<string, AgentDefinition>,
  options: HarnessOptions = {},
): Promise<RawSample> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const start = Date.now();
  const invocations: ToolInvocation[] = [];
  const textParts: string[] = [];
  const abortController = new AbortController();

  let costUsd = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;
  let resultSubtype: string | undefined;
  let errored = false;

  try {
    const fullPrompt = testCase.preamble
      ? `${testCase.preamble}\n\n---\n\n${testCase.prompt}`
      : testCase.prompt;

    const stream = query({
      prompt: fullPrompt,
      options: {
        agents,
        cwd: testCase.fixtureCwd ?? REPO_ROOT,
        settingSources: ["project"],
        allowedTools: READ_ONLY_TOOLS,
        maxTurns: opts.maxTurns,
        model: opts.model,
        abortController,
        hooks: { PreToolUse: [{ hooks: [denyHook] }] },
      },
    });

    let prevUsageSig: string | undefined;
    for await (const msg of stream) {
      if (msg.type === "assistant") {
        const m = msg.message as unknown as { usage?: Record<string, number | undefined> };
        const usage = m.usage;
        if (usage) {
          // SDK emits one SDKAssistantMessage per content block (thinking, tool_use, …)
          // but message.usage is per-LLM-response, so blocks from the same response share it.
          // Dedupe on signature; differs across turns because cache_read/output change.
          const sig = `${usage.input_tokens}|${usage.output_tokens}|${usage.cache_read_input_tokens}|${usage.cache_creation_input_tokens}`;
          if (sig !== prevUsageSig) {
            prevUsageSig = sig;
            inputTokens += usage.input_tokens ?? 0;
            outputTokens += usage.output_tokens ?? 0;
            cacheReadTokens += usage.cache_read_input_tokens ?? 0;
            cacheCreateTokens += usage.cache_creation_input_tokens ?? 0;
          }
        }
        if (invocations.length === 0) {
          const text = extractText(msg.message.content);
          if (text) textParts.push(text);
        }
        const newInvocations = extractRouting(msg.message.content, invocations.length);
        if (newInvocations.length > 0) {
          invocations.push(...newInvocations);
          abortController.abort();
        }
      } else if (msg.type === "result") {
        const r = msg as { total_cost_usd?: number; subtype?: string };
        if (typeof r.total_cost_usd === "number") costUsd = r.total_cost_usd;
        if (typeof r.subtype === "string") resultSubtype = r.subtype;
      }
    }
  } catch (err) {
    errored = true;
    const reason = err instanceof Error ? err.message : String(err);
    if (!resultSubtype) {
      if (reason.includes("aborted") || reason.includes("AbortError")) {
        resultSubtype = "aborted_by_harness";
      } else if (reason.includes("maximum number of turns")) {
        resultSubtype = "error_max_turns";
      } else {
        resultSubtype = "error_other";
      }
    }
  }

  return {
    invocations,
    preToolText: textParts.join("\n"),
    costUsd,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreateTokens,
    durationMs: Date.now() - start,
    resultSubtype,
    errored,
  };
}
