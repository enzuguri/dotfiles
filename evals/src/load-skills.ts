import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import type { SkillDefinition } from "./types.ts";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n[\s\S]*$/;

type SkillFrontmatter = { name: string; description: string };

export async function loadSkillsFromDir(dir: string): Promise<Record<string, SkillDefinition>> {
  const entries = await readdir(dir);
  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  const result: Record<string, SkillDefinition> = {};

  for (const file of mdFiles) {
    const path = join(dir, file);
    const raw = await readFile(path, "utf8");
    const match = raw.match(FRONTMATTER_RE);
    if (!match) throw new Error(`No YAML frontmatter found in ${path}`);

    const fm = parseYaml(match[1]!) as SkillFrontmatter;
    if (!fm.name) throw new Error(`Missing 'name' in frontmatter: ${path}`);
    if (!fm.description) throw new Error(`Missing 'description' in frontmatter: ${path}`);
    if (result[fm.name]) throw new Error(`Duplicate skill name '${fm.name}' (${path})`);

    result[fm.name] = { name: fm.name, description: fm.description };
  }

  return result;
}
