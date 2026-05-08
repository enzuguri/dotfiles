import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgentsFromDir } from "./load-agents.ts";

const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "open-world-agents",
);

export const loadOpenWorldFixture = () => loadAgentsFromDir(FIXTURE_DIR);
