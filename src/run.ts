import { resolve, isAbsolute, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { isatty } from 'node:tty';
import { loadConfig, type ResolvedConfig } from './config.ts';
import { scanEnvFiles, defaultSchemaRel, type FoundFile } from './scan.ts';
import { loadEnvFile, type LoadedEnv } from './load.ts';
import { diffFile, type FileReport } from './diff.ts';
import { renderJson, renderText, type RenderInput } from './format.ts';
import { EnvcheckError } from './errors.ts';
import { Exit } from './exit.ts';
import { c } from './color.ts';
import { fixFile } from './fix.ts';
import { assertInteractive } from './prompt.ts';
import type { ParseResult } from './parse.ts';

export type FailOnKind = 'missing' | 'empty' | 'extra' | 'typo' | 'dup';

export interface CheckFlags {
  cwd: string;
  schema?: string;
  json: boolean;
  reveal: boolean;
  ignore: string[];
  maxDistance?: number;
  stats: boolean;
  skipEmpty: boolean;
  skipNoPairs: boolean;
  failOn?: FailOnKind[];
}

export interface RunCheckInput {
  root: string;
  schemaRel: string;
  reveal: boolean;
  skipEmpty: boolean;
  skipNoPairs: boolean;
  stats?: CheckStats;
  files: {
    loaded: LoadedEnv;
    report: FileReport;
  }[];
}

export interface CheckOutcome {
  exitCode: number;
  text: string;
}

export interface CheckStats {
  missing: number;
  empty: number;
  typo: number;
  extra: number;
  dup: number;
  interpolated: number;
  other: number;
}

function emptyStats(): CheckStats {
  return { missing: 0, empty: 0, typo: 0, extra: 0, dup: 0, interpolated: 0, other: 0 };
}

function computeStats(compared: LoadedEnv[], schema: ParseResult): CheckStats {
  const stats = emptyStats();
  for (const loaded of compared) {
    if (loaded.emptyFile || loaded.noPairs) {
      stats.other++;
      continue;
    }
    const report = diffFile(loaded.rel, loaded.parsed, schema, 3);
    stats.missing += report.missing.length;
    stats.empty += report.empty.length;
    stats.typo += report.typos.length;
    stats.extra += report.extra.length;
    stats.dup += report.duplicates.length;
    stats.interpolated += report.interpolated.length;
  }
  return stats;
}

export function runCheck(flags: CheckFlags): CheckOutcome {
  const { schemaRel, loadedSchema, compared, root } = collect(flags);
  const kinds = flags.failOn && flags.failOn.length > 0 ? new Set(flags.failOn) : null;

  // --skip-empty / --skip-no-pairs: exclude from the report AND drift scoring.
  const reported = compared.filter(
    (loaded) => !(flags.skipEmpty && loaded.emptyFile) && !(flags.skipNoPairs && loaded.noPairs),
  );

  const input: RunCheckInput = {
    root,
    schemaRel,
    reveal: flags.reveal,
    skipEmpty: flags.skipEmpty,
    skipNoPairs: flags.skipNoPairs,
    files: reported.map((loaded) => ({
      loaded,
      report: diffFile(loaded.rel, loaded.parsed, loadedSchema.parsed, flags.maxDistance ?? 3),
    })),
  };

  if (flags.stats) {
    input.stats = computeStats(compared, loadedSchema.parsed);
  }

  const drifted = hasDrift(input.files, kinds);
  return {
    exitCode: drifted ? Exit.Drift : Exit.Ok,
    text: flags.json
      ? renderJson({ ...input, exitCode: drifted ? Exit.Drift : Exit.Ok })
      : renderText(input),
  };
}

function hasDrift(
  files: { loaded: LoadedEnv; report: import('./diff.ts').FileReport }[],
  kinds: Set<FailOnKind> | null,
): boolean {
  for (const { loaded, report } of files) {
    if (!kinds) {
      if (!report.ok || loaded.emptyFile || loaded.noPairs) return true;
      continue;
    }
    if (kinds.has('missing') && report.missing.length) return true;
    if (kinds.has('empty') && (report.empty.length || loaded.emptyFile || loaded.noPairs))
      return true;
    if (kinds.has('extra') && report.extra.length) return true;
    if (kinds.has('typo') && report.typos.length) return true;
    if (kinds.has('dup') && report.duplicates.length) return true;
  }
  return false;
}

export async function runFix(flags: CheckFlags): Promise<CheckOutcome> {
  assertInteractive();
  const { loadedSchema, compared } = collect(flags);
  let changed = 0;
  let skipped = 0;
  for (const loaded of compared) {
    const result = await fixFile(loaded, loadedSchema.parsed, flags.maxDistance ?? 3, flags.reveal);
    if (result === 'changed') changed++;
    if (result === 'skipped') skipped++;
  }
  const text = `${c.green(String(changed))} updated, ${c.dim(String(skipped))} skipped\n`;
  return { exitCode: Exit.Ok, text };
}

function collect(flags: CheckFlags): {
  root: string;
  schemaRel: string;
  loadedSchema: LoadedEnv;
  compared: LoadedEnv[];
  config: ResolvedConfig;
} {
  const root = resolve(flags.cwd);
  const config = loadConfig(root);
  const ignore = [...config.ignore, ...flags.ignore];
  const maxDistance = flags.maxDistance ?? config.maxDistance;

  const spinner = startSpinner('scanning');
  let files: FoundFile[];
  try {
    files = scanEnvFiles({ root, extraIgnore: ignore });
  } finally {
    spinner.stop();
  }

  if (files.length === 0) {
    throw new EnvcheckError(
      Exit.NotFound,
      'No .env files found.',
      `Walked ${root} and every .env* file was either absent or excluded by .gitignore / .envcheckignore.`,
      'touch .env.example && envcheck check',
    );
  }

  const schemaArg = flags.schema ?? config.schema;
  const schemaRel = resolveSchema(root, files, schemaArg);
  const schemaFile = files.find((f) => f.rel === schemaRel) ?? {
    abs: isAbsolute(schemaArg ?? '') ? schemaArg! : resolve(root, schemaRel),
    rel: schemaRel,
    name: basename(schemaRel),
  };
  if (!existsSync(schemaFile.abs)) {
    throw new EnvcheckError(
      Exit.NotFound,
      `Schema file ${schemaRel} does not exist.`,
      'envcheck treats the schema as the list of keys that must exist. Without it there is nothing to diff against.',
      'envcheck check --schema .env.example',
    );
  }

  const loadedSchema = loadEnvFile(schemaFile.abs, schemaRel);
  if (loadedSchema.emptyFile || loadedSchema.noPairs) {
    throw new EnvcheckError(
      Exit.NotFound,
      `${schemaRel} has no keys.`,
      loadedSchema.emptyFile
        ? 'The schema file is zero bytes.'
        : 'The schema file has comments or blank lines only, so it cannot define a contract.',
      `Add KEY=value lines to ${schemaRel} and re-run envcheck check`,
    );
  }

  const compared = files
    .filter(
      (f) =>
        f.rel !== schemaRel &&
        ![defaultSchemaRel(files) ?? '', '.env.example', '.env.sample', '.env.template'].includes(
          f.rel,
        ),
    )
    .map((f) => loadEnvFile(f.abs, f.rel));

  if (compared.length === 0) {
    throw new EnvcheckError(
      Exit.NotFound,
      'Schema found, but no other .env files to compare.',
      `${schemaRel} is the only env file visible to the scan. Secrets files are often gitignored — that is respected on purpose.`,
      'cp .env.example .env && envcheck check',
    );
  }

  flags.maxDistance = maxDistance;
  return { root, schemaRel, loadedSchema, compared, config };
}

function resolveSchema(root: string, files: FoundFile[], schemaArg: string | undefined): string {
  if (!schemaArg) {
    const found = defaultSchemaRel(files);
    if (!found) {
      throw new EnvcheckError(
        Exit.NotFound,
        'No schema file found.',
        'Looked for .env.example, .env.sample, and .env.template, and .envcheckrc did not set "schema".',
        'envcheck check --schema .env.example',
      );
    }
    return found;
  }
  if (isAbsolute(schemaArg)) {
    const hit = files.find((f) => f.abs === schemaArg);
    return hit ? hit.rel : schemaArg;
  }
  const rel = schemaArg.replace(/^\.\//, '');
  if (!existsSync(resolve(root, rel))) {
    throw new EnvcheckError(
      Exit.NotFound,
      `Schema file ${rel} does not exist.`,
      'The --schema path (or .envcheckrc schema) does not point at a file.',
      `envcheck check --schema .env.example`,
    );
  }
  return rel;
}

function startSpinner(label: string): { stop: () => void } {
  if (!isatty(2)) return { stop() {} };
  let started = false;
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let timer: NodeJS.Timeout | undefined;
  const arm = setTimeout(() => {
    started = true;
    timer = setInterval(() => {
      process.stderr.write(`\r${frames[i++ % frames.length]} ${label}`);
    }, 80);
  }, 100);
  return {
    stop() {
      clearTimeout(arm);
      if (timer) clearInterval(timer);
      if (started) process.stderr.write('\r\x1b[2K');
    },
  };
}
