// Snapshots the 8 plugin/built-in "competitor" agents into evals/fixtures/open-world-agents/.
// Run deliberately when adding new local agents or quarterly to refresh.
//
// For each entry: descriptions are verbatim from the source. Bodies are placeholders —
// the routing harness denies Agent execution, so the prompt body is never used.

import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "open-world-agents",
);

const PLUGINS_ROOT = join(homedir(), ".claude", "plugins", "marketplaces");

type CopySource = {
  /** Namespaced name as the orchestrator references it (subagent_type value). */
  fixtureName: string;
  /** Source path under ~/.claude/plugins/marketplaces. */
  sourcePath: string;
};

const PLUGIN_SOURCES: CopySource[] = [
  {
    fixtureName: "pr-review-toolkit:code-reviewer",
    sourcePath: "claude-plugins-official/plugins/pr-review-toolkit/agents/code-reviewer.md",
  },
  {
    fixtureName: "pr-review-toolkit:code-simplifier",
    sourcePath: "claude-plugins-official/plugins/pr-review-toolkit/agents/code-simplifier.md",
  },
  {
    fixtureName: "glean-code:codebase-navigator",
    sourcePath: "glean-plugins/plugins/glean-code/agents/codebase-navigator.md",
  },
  {
    fixtureName: "glean-search:enterprise-searcher",
    sourcePath: "glean-plugins/plugins/glean-search/agents/enterprise-searcher.md",
  },
];

type SynthEntry = {
  fixtureName: string;
  description: string;
  tools: string;
};

// Descriptions transcribed verbatim from Claude Code's orchestrator system prompt.
const BUILTIN_SYNTH: SynthEntry[] = [
  {
    fixtureName: "general-purpose",
    description:
      "General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you.",
    tools: "*",
  },
  {
    fixtureName: "claude-code-guide",
    description:
      "Use this agent when the user asks questions (\"Can Claude...\", \"Does Claude...\", \"How do I...\") about: (1) Claude Code (the CLI tool) - features, hooks, slash commands, MCP servers, settings, IDE integrations, keyboard shortcuts; (2) Claude Agent SDK - building custom agents; (3) Claude API (formerly Anthropic API) - API usage, tool use, Anthropic SDK usage.",
    tools: "Bash, Read, WebFetch, WebSearch",
  },
  {
    fixtureName: "Plan",
    description:
      "Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs.",
    tools: "Read, Grep, Glob, Bash",
  },
  {
    fixtureName: "Explore",
    description:
      "Fast read-only search agent for locating code. Use it to find files by pattern (eg. \"src/components/**/*.tsx\"), grep for symbols or keywords (eg. \"API endpoints\"), or answer \"where is X defined / which files reference Y.\" Do NOT use it for code review, design-doc auditing, cross-file consistency checks, or open-ended analysis — it reads excerpts rather than whole files and will miss content past its read window.",
    tools: "Read, Grep, Glob",
  },
];

const FIXTURE_BODY = "[Fixture placeholder — never executed during routing eval. The harness denies Agent invocations via PreToolUse hook.]\n";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n[\s\S]*$/;

function fixtureFilename(name: string): string {
  return name.replace(/[:/]/g, "-") + ".md";
}

function blockScalarYaml(value: string): string {
  // Use single-quoted YAML if the value has no single quotes; otherwise double-quote and escape.
  if (!value.includes("'") && !value.includes("\n")) return `'${value}'`;
  if (!value.includes('"') && !value.includes("\n")) return `"${value.replace(/"/g, '\\"')}"`;
  // Fall back to block scalar.
  const indented = value.split("\n").map((l) => `  ${l}`).join("\n");
  return `>-\n${indented}`;
}

type Frontmatter = { description: string; tools?: string; model?: string };

function parseFrontmatter(raw: string, path: string): Frontmatter {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) throw new Error(`No frontmatter in ${path}`);
  // Naive parse: only fields we care about. yaml lib handles edge cases at load time.
  const fm: Frontmatter = { description: "" };
  let inMultiline = false;
  let mlKey = "";
  let mlBuf: string[] = [];
  for (const line of match[1]!.split(/\r?\n/)) {
    if (inMultiline) {
      if (/^\S/.test(line)) {
        const v = mlBuf.join(" ").replace(/\s+/g, " ").trim();
        if (mlKey === "description") fm.description = v;
        inMultiline = false;
      } else {
        mlBuf.push(line.trim());
        continue;
      }
    }
    const m = /^([a-zA-Z_]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!;
    const val = m[2]!;
    if (val === ">" || val === ">-" || val === "|" || val === "|-") {
      inMultiline = true;
      mlKey = key;
      mlBuf = [];
      continue;
    }
    if (key === "description") fm.description = val.replace(/^['"]|['"]$/g, "");
    else if (key === "tools") fm.tools = val;
    else if (key === "model") fm.model = val;
  }
  if (inMultiline) {
    const v = mlBuf.join(" ").replace(/\s+/g, " ").trim();
    if (mlKey === "description") fm.description = v;
  }
  return fm;
}

function quoteToolsField(tools: string): string {
  // `tools: *` parses as a YAML alias reference; quote to keep it a string. Same for any value
  // starting with characters YAML treats specially.
  if (/^[*&!|>%@`]/.test(tools.trim())) return `'${tools.replace(/'/g, "''")}'`;
  return tools;
}

function buildFixtureFile(name: string, description: string, tools?: string, model?: string): string {
  const lines = ["---", `name: ${name}`, `description: ${blockScalarYaml(description)}`];
  if (tools) lines.push(`tools: ${quoteToolsField(tools)}`);
  if (model) lines.push(`model: ${model}`);
  lines.push("---", "", FIXTURE_BODY);
  return lines.join("\n");
}

async function clearFixtureDir() {
  await mkdir(FIXTURE_DIR, { recursive: true });
  const existing = await readdir(FIXTURE_DIR);
  for (const f of existing) {
    if (f.endsWith(".md")) await unlink(join(FIXTURE_DIR, f));
  }
}

async function snapshotPlugin(src: CopySource): Promise<string> {
  const sourceAbs = join(PLUGINS_ROOT, src.sourcePath);
  const raw = await readFile(sourceAbs, "utf8");
  const fm = parseFrontmatter(raw, sourceAbs);
  if (!fm.description.trim()) throw new Error(`No description in source ${sourceAbs}`);
  const out = buildFixtureFile(src.fixtureName, fm.description, fm.tools, fm.model);
  const dest = join(FIXTURE_DIR, fixtureFilename(src.fixtureName));
  await writeFile(dest, out);
  return dest;
}

async function synthesizeBuiltin(entry: SynthEntry): Promise<string> {
  const out = buildFixtureFile(entry.fixtureName, entry.description, entry.tools);
  const dest = join(FIXTURE_DIR, fixtureFilename(entry.fixtureName));
  await writeFile(dest, out);
  return dest;
}

async function main() {
  console.log(`refreshing open-world fixture at ${FIXTURE_DIR}\n`);
  await clearFixtureDir();

  const written: string[] = [];
  for (const src of PLUGIN_SOURCES) {
    const path = await snapshotPlugin(src);
    written.push(path);
    console.log(`  copied (rewrote name)  ${src.fixtureName}`);
  }
  for (const entry of BUILTIN_SYNTH) {
    const path = await synthesizeBuiltin(entry);
    written.push(path);
    console.log(`  synthesized (built-in) ${entry.fixtureName}`);
  }

  console.log(`\nwrote ${written.length} fixture files.`);
}

main().catch((err) => {
  console.error("refresh-open-world failed:", err);
  process.exit(1);
});
