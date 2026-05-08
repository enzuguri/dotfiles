import { runSuite, type RunnerConfig } from "./runner.ts";
import { printReport, suitePassed } from "./report.ts";

type ParsedArgs = {
  filter?: string;
  caseId?: string;
  samples: number;
  budgetUsd: number;
  concurrency: number;
  model: string;
  verbose: boolean;
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  const out: ParsedArgs = {
    samples: 3,
    budgetUsd: 10,
    concurrency: 4,
    model: "sonnet",
    verbose: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    const next = (): string => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`flag ${a} requires a value`);
      return v;
    };
    switch (a) {
      case "--filter": out.filter = next(); break;
      case "--case": out.caseId = next(); break;
      case "--samples": out.samples = parseInt(next(), 10); break;
      case "--budget": out.budgetUsd = parseFloat(next()); break;
      case "--concurrency": out.concurrency = parseInt(next(), 10); break;
      case "--model": out.model = next(); break;
      case "--verbose": case "-v": out.verbose = true; break;
      case "--help": case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`unknown flag: ${a}`);
    }
  }

  if (!Number.isFinite(out.samples) || out.samples < 1) throw new Error(`--samples must be >= 1`);
  if (!Number.isFinite(out.budgetUsd) || out.budgetUsd <= 0) throw new Error(`--budget must be > 0`);
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) throw new Error(`--concurrency must be >= 1`);

  return out;
}

function printHelp(): void {
  console.log(`Usage: bun run eval [flags]

Flags:
  --filter <substr>       only run cases whose id contains <substr>
  --case <id>             only run the case with exact id
  --samples <n>           samples per (case, context); default 3
  --budget <usd>          abort suite when cumulative estimated cost exceeds; default 10
  --concurrency <n>       parallel sampler workers; default 4
  --model <name>          orchestrator model (sonnet|haiku|opus or full id); default sonnet
  --verbose, -v           per-job logging
  --help, -h              this message
`);
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const cfg: RunnerConfig = parsed;
  console.log(`evals: samples=${cfg.samples} budget=$${cfg.budgetUsd} concurrency=${cfg.concurrency} model=${cfg.model}`);

  const summary = await runSuite(cfg);
  printReport(summary, summary.openWorldEmpty);

  process.exit(suitePassed(summary, summary.openWorldEmpty) ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(2);
});
