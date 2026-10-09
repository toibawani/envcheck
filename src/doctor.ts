/** envcheck doctor — verify environment and schema setup. */
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { scanEnvFiles } from './scan.ts';
import { loadEnvFile } from './load.ts';
import { loadConfig } from './config.ts';

import { Exit } from './exit.ts';
import { c } from './color.ts';
import { version } from './version.ts';

export interface DoctorFlags {
  cwd: string;
  schema?: string;
  ignore: string[];
}

export interface DoctorOutcome {
  exitCode: number;
  text: string;
}

function ok(label: string): string {
  return `${c.green('✓')}  ${label}`;
}

function warn(label: string): string {
  return `${c.yellow('⚠')}  ${label}`;
}

function fail(label: string): string {
  return `${c.red('✗')}  ${label}`;
}

export function runDoctor(flags: DoctorFlags): DoctorOutcome {
  const root = resolve(flags.cwd);
  const config = loadConfig(root);
  const ignore = [...config.ignore, ...flags.ignore];

  const lines: string[] = [
    `${c.bold('envcheck doctor')} ${relative('.', root)}`,
    `version ${version()}`,
    `node ${process.version}`,
    '',
  ];

  const found = scanEnvFiles({ root, extraIgnore: ignore });
  const example = found.find((f) => f.name === '.env.example');

  if (!existsSync(join(root, '.git'))) {
    lines.push(warn('Not a git repository — envcheck works best in git.'));
  } else {
    lines.push(ok('Running inside a git repository'));
  }

  if (example) {
    const schema = loadEnvFile(example.abs, example.rel);
    const n = schema.parsed.entries.length;
    lines.push(ok(`Schema of record found: ${example.rel} (${n} key${n === 1 ? '' : 's'})`));
  } else {
    lines.push(fail('No .env.example schema found — run: envcheck init'));
  }

  const candidates = found.filter((f) => f.rel !== example?.rel && !f.rel.includes('/'));
  if (candidates.length === 0) {
    lines.push(warn('No local .env* files found — create one with envcheck init'));
  } else {
    lines.push(
      ok(
        `Found ${candidates.length} local ${candidates.length === 1 ? '.env* file' : '.env* files'}`,
      ),
    );
  }

  lines.push('');
  lines.push(`config  ${config.configPath ?? 'no .envcheckrc'}  maxDistance ${config.maxDistance}`);

  if (lines.some((l) => l.startsWith(fail('')))) {
    lines.push('');
    lines.push(c.dim('fix  envcheck init   # scaffold .env.example'));
    return { exitCode: Exit.NotFound, text: lines.join('\n') + '\n' };
  }
  return { exitCode: Exit.Ok, text: lines.join('\n') + '\n' };
}
