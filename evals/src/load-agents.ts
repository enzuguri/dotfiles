import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

type AgentFrontmatter = {
  name: string;
  description: string;
  tools?: string;
  model?: string;
  color?: string;
};

type LoadedAgent = AgentDefinition & { name: string };

function splitFrontmatter(raw: string, path: string): { fm: AgentFrontmatter; body: string } {
  const match = raw.match(FRONTMATTER_RE);
  if (!match) throw new Error(`No YAML frontmatter found in ${path}`);
  const fm = parseYaml(match[1]!) as AgentFrontmatter;
  return { fm, body: match[2]!.trim() };
}

function parseToolsField(tools: string | undefined): string[] | undefined {
  if (!tools) return undefined;
  return tools
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export async function loadAgentsFromDir(dir: string): Promise<Record<string, LoadedAgent>> {
  const entries = await readdir(dir);
  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  const result: Record<string, LoadedAgent> = {};

  for (const file of mdFiles) {
    const path = join(dir, file);
    const raw = await readFile(path, "utf8");
    const { fm, body } = splitFrontmatter(raw, path);

    if (!fm.name) throw new Error(`Missing 'name' in frontmatter: ${path}`);
    if (!fm.description) throw new Error(`Missing 'description' in frontmatter: ${path}`);
    if (result[fm.name]) throw new Error(`Duplicate agent name '${fm.name}' (${path})`);

    result[fm.name] = {
      name: fm.name,
      description: fm.description,
      prompt: body,
      tools: parseToolsField(fm.tools),
      model: fm.model,
    };
  }

  return result;
}
