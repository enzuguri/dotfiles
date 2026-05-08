import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { EvalCase, ExpectedRoute } from "./types.ts";

type RawCase = {
  id?: string;
  prompt?: string;
  expected?: string | null;
  alternates?: string[];
  notes?: string;
  fixtureCwd?: string;
};

function parseExpected(raw: string | null | undefined, ctx: string): ExpectedRoute {
  if (raw === null || raw === undefined) return { kind: "none" };
  if (typeof raw !== "string") throw new Error(`${ctx}: expected must be string or null, got ${typeof raw}`);
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed === "null" || trimmed === "none") return { kind: "none" };
  const colon = trimmed.indexOf(":");
  if (colon === -1) throw new Error(`${ctx}: expected must be 'agent:<name>' | 'skill:<name>' | null (got '${raw}')`);
  const kind = trimmed.slice(0, colon);
  const name = trimmed.slice(colon + 1).trim();
  if (!name) throw new Error(`${ctx}: expected name is empty`);
  if (kind === "agent") return { kind: "agent", name };
  if (kind === "skill") return { kind: "skill", name };
  throw new Error(`${ctx}: unknown expected kind '${kind}' (expected 'agent' or 'skill')`);
}

async function* walkYaml(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const path = join(dir, e.name);
    if (e.isDirectory()) yield* walkYaml(path);
    else if (e.isFile() && (e.name.endsWith(".yaml") || e.name.endsWith(".yml"))) yield path;
  }
}

export async function loadCasesFromDir(rootDir: string): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  const seenIds = new Set<string>();

  for await (const file of walkYaml(rootDir)) {
    const rel = relative(rootDir, file);
    const raw = await readFile(file, "utf8");
    const doc = parseYaml(raw) as RawCase[] | null;
    if (!doc) continue;
    if (!Array.isArray(doc)) throw new Error(`${rel}: top-level must be a YAML array of cases`);

    for (let i = 0; i < doc.length; i++) {
      const entry = doc[i]!;
      const ctx = `${rel}[${i}]${entry.id ? ` id=${entry.id}` : ""}`;
      if (!entry.id) throw new Error(`${ctx}: missing 'id'`);
      if (!entry.prompt) throw new Error(`${ctx}: missing 'prompt'`);
      if (seenIds.has(entry.id)) throw new Error(`${ctx}: duplicate id '${entry.id}'`);
      seenIds.add(entry.id);

      const alternates = (entry.alternates ?? []).map((a, j) => {
        const parsed = parseExpected(a, `${ctx} alternates[${j}]`);
        if (parsed.kind === "none") {
          throw new Error(`${ctx} alternates[${j}]: alternates cannot be 'none'`);
        }
        return parsed;
      });

      cases.push({
        id: entry.id,
        prompt: entry.prompt,
        expected: parseExpected(entry.expected, ctx),
        alternates,
        notes: entry.notes,
        fixtureCwd: entry.fixtureCwd,
      });
    }
  }

  return cases;
}
