import { argv, exit, stderr, stdout } from "node:process";
import { resolve } from "node:path";
import { configureColor, c } from "./color.ts";
import { isEnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";
import { armSignals } from "./signals.ts";
import { version } from "./version.ts";
import { runCheck, runFix } from "./run.ts";
import { runInit } from "./init.ts";

const HELP = `envcheck — compare .env files to a schema of record

usage
  envcheck check [dir] [flags]
  envcheck fix [dir]
  envcheck init [dir]
  envcheck about
  envcheck --help
  envcheck --version

commands
  check     scan and report missing, empty, extra, and typo'd keys
  fix       walk missing and orphaned keys, preview, then write
  init      build .env.example from keys already in your .env files
  about     version, author, exit codes

flags
  --schema <file>     template to treat as the contract (default: .env.example)
  --ignore <glob>     extra ignore pattern, repeatable
  --max-distance <n>  typo suggestion cutoff (default 3)
  --reveal            print secret values (default: masked)
  --json              machine-readable report
  --force             allow init to overwrite an existing schema
  --no-color          disable color even on a TTY
  --verbose           include the underlying error message
  -h, --help          this text
  -v, --version       print version from package.json

config
  .envcheckrc         JSON. keys: schema, ignore, maxDistance
                      CLI flags always win.

exit codes
  0 ok        1 drift       2 usage       3 not found
  4 unreadable  5 bad config  6 interrupted  7 locked

author  Toiba  https://github.com/toibawani  toibawani14@gmail.com
`;

interface Parsed {
  command: string;
  dir: string;
  schema?: string;
  ignore: string[];
  maxDistance?: number;
  reveal: boolean;
  json: boolean;
  force: boolean;
  noColor: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(args: string[]): Parsed {
  const out: Parsed = {
    command: "check",
    dir: ".",
    ignore: [],
    reveal: false,
    json: false,
    force: false,
    noColor: false,
    verbose: false,
    help: false,
    version: false,
  };
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--version" || a === "-v") out.version = true;
    else if (a === "--json") out.json = true;
    else if (a === "--reveal") out.reveal = true;
    else if (a === "--force") out.force = true;
    else if (a === "--no-color") out.noColor = true;
    else if (a === "--verbose") out.verbose = true;
    else if (a === "--schema") out.schema = need(args, ++i, "--schema");
    else if (a === "--ignore") out.ignore.push(need(args, ++i, "--ignore"));
    else if (a === "--max-distance") out.maxDistance = Number(need(args, ++i, "--max-distance"));
    else if (a.startsWith("-")) {
      failUsage(`Unknown flag ${a}.`, `envcheck --help`);
    } else positional.push(a);
  }
  if (positional[0] && ["check", "fix", "init", "about"].includes(positional[0])) {
    out.command = positional[0];
    if (positional[1]) out.dir = positional[1];
    if (positional.length > 2) failUsage(`Unexpected argument ${positional[2]}.`, "envcheck --help");
  } else if (positional[0]) {
    out.dir = positional[0];
    if (positional.length > 1) failUsage(`Unexpected argument ${positional[1]}.`, "envcheck --help");
  }
  if (out.maxDistance !== undefined && (!Number.isInteger(out.maxDistance) || out.maxDistance < 0)) {
    failUsage("--max-distance must be a non-negative integer.", "envcheck check --max-distance 3");
  }
  return out;
}

function need(args: string[], i: number, flag: string): string {
  const v = args[i];
  if (!v || v.startsWith("-")) failUsage(`${flag} needs a value.`, `envcheck check ${flag} <value>`);
  return v;
}

function failUsage(what: string, fix: string): never {
  stderr.write(`${what}\nWhy: the arguments do not match a known command.\nFix: ${fix}\n`);
  exit(Exit.Usage);
}

async function main(): Promise<void> {
  armSignals();
  const parsed = parseArgs(argv.slice(2));
  configureColor({ noColorFlag: parsed.noColor, json: parsed.json });

  if (parsed.version) {
    stdout.write(version() + "\n");
    return;
  }
  if (parsed.help) {
    stdout.write(commandHelp(parsed.command));
    return;
  }
  if (parsed.command === "about") {
    stdout.write(aboutText());
    return;
  }

  const flags = {
    cwd: resolve(parsed.dir),
    schema: parsed.schema,
    json: parsed.json,
    reveal: parsed.reveal,
    ignore: parsed.ignore,
    maxDistance: parsed.maxDistance,
  };

  if (parsed.command === "fix") {
    const outcome = await runFix(flags);
    stdout.write(outcome.text);
    exit(outcome.exitCode);
  }

  if (parsed.command === "init") {
    const outcome = runInit({
      cwd: flags.cwd,
      schema: flags.schema,
      ignore: flags.ignore,
      force: parsed.force,
    });
    stdout.write(outcome.text);
    exit(outcome.exitCode);
  }

  const outcome = runCheck(flags);
  stdout.write(outcome.text);
  exit(outcome.exitCode);
}

function commandHelp(command: string): string {
  if (command === "fix") {
    return `envcheck fix — fill missing keys and drop orphans, with a preview

usage
  envcheck fix [dir] [--schema <file>] [--reveal]

fix never writes without showing a diff and asking. It refuses to run when
stdin is not a TTY (CI, pipes) so it cannot hang waiting for input.

author  Toiba  https://github.com/toibawani  toibawani14@gmail.com
`;
  }
  if (command === "init") {
    return `envcheck init — create a schema from existing .env keys

usage
  envcheck init [dir] [--schema <file>] [--force]

Collects every key from discovered .env* files (never copies secret values)
and writes them as KEY= lines into .env.example (or --schema).

Refuses to overwrite unless --force is passed.

author  Toiba  https://github.com/toibawani  toibawani14@gmail.com
`;
  }
  if (command === "about") {
    return `envcheck about — version and credits

usage
  envcheck about

prints the version baked in at build time, plus
https://github.com/toibawani and toibawani14@gmail.com
`;
  }
  if (command === "check") {
    return `envcheck check — report drift against the schema

usage
  envcheck check [dir] [flags]

flags
  --schema <file>     contract file (default .env.example | .env.sample | .env.template)
  --ignore <glob>     extra ignore, repeatable. also reads .gitignore and .envcheckignore
  --max-distance <n>  Levenshtein cutoff for typo hints (default 3)
  --reveal            show values (default masks to first/last 2 chars)
  --json              stable JSON for CI
  --no-color          no ANSI, even on a TTY
  --verbose           attach the underlying message

exit  0 match  1 drift  3 nothing to scan  4 bad file  5 bad .envcheckrc
`;
  }
  return HELP;
}

function aboutText(): string {
  return [
    `${c.bold("envcheck")} ${version()}`,
    "Toiba  https://github.com/toibawani",
    "toibawani14@gmail.com",
    "",
    "A schema-of-record check for .env files.",
    "Repo: https://github.com/toibawani/envcheck",
    "",
    "exit  0 ok  1 drift  2 usage  3 not found  4 unreadable  5 config  6 interrupted  7 locked",
    "",
  ].join("\n");
}

main().catch((err: unknown) => {
  const verbose = argv.includes("--verbose");
  if (isEnvcheckError(err)) {
    stderr.write(`${err.what}\nWhy: ${err.why}\nFix: ${err.fix}\n`);
    if (verbose && err.stack) stderr.write(c.dim(err.stack) + "\n");
    exit(err.exitCode);
  }
  const message = err instanceof Error ? err.message : String(err);
  stderr.write(`envcheck hit an unexpected error.\nWhy: ${message}\nFix: re-run with --verbose and open an issue at https://github.com/toibawani/envcheck/issues\n`);
  if (verbose && err instanceof Error && err.stack) stderr.write(err.stack + "\n");
  exit(Exit.Unreadable);
});
