import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../src/init.ts';
import { EnvcheckError } from '../src/errors.ts';
import { Exit } from '../src/exit.ts';

test('init writes sorted keys without secret values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-init-'));
  try {
    writeFileSync(
      join(dir, '.env'),
      'ZEBRA=secret1\nALPHA=secret2\n# redis host\nREDIS_URL=redis://x\n',
    );
    const out = runInit({ cwd: dir, ignore: [], force: false, dryRun: false });
    assert.equal(out.exitCode, 0);
    const example = readFileSync(join(dir, '.env.example'), 'utf8');
    assert.match(example, /^ALPHA=$/m);
    assert.match(example, /^REDIS_URL=$/m);
    assert.match(example, /^ZEBRA=$/m);
    assert.doesNotMatch(example, /secret/);
    // sorted
    const keys = example.split('\n').filter((l) => /^[A-Z_]+=$/.test(l));
    assert.deepEqual(keys, ['ALPHA=', 'REDIS_URL=', 'ZEBRA=']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init --dry-run prints keys and does not write', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-init-dry-'));
  try {
    writeFileSync(join(dir, '.env'), 'FOO=secret\nBAR=x\n');
    const out = runInit({ cwd: dir, ignore: [], force: false, dryRun: true });
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /FOO=/);
    assert.doesNotMatch(out.text, /secret/);
    assert.equal(existsSync(join(dir, '.env.example')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init throws when no .env files exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-init-'));
  try {
    assert.throws(
      () => runInit({ cwd: dir, schema: '.env.example', ignore: [], force: false, dryRun: false }),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal(err.exitCode, Exit.NotFound);
        assert.match(err.message, /No \.env files found/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init throws when .env files have no keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-init-'));
  try {
    writeFileSync(join(dir, '.env'), '# just a comment\n', 'utf8');
    writeFileSync(join(dir, '.env.local'), '\n', 'utf8');
    assert.throws(
      () => runInit({ cwd: dir, schema: '.env.example', ignore: [], force: false, dryRun: false }),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal(err.exitCode, Exit.NotFound);
        assert.match(err.message, /no keys inside them/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init throws when schema exists without --force', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-init-'));
  try {
    writeFileSync(join(dir, '.env'), 'FOO=secret\n');
    writeFileSync(join(dir, '.env.example'), 'OLD=1\n', 'utf8');
    assert.throws(
      () => runInit({ cwd: dir, schema: '.env.example', ignore: [], force: false, dryRun: false }),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal(err.exitCode, Exit.Usage);
        assert.match(err.message, /already exists/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init overwrites schema when --force is passed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-init-'));
  try {
    writeFileSync(join(dir, '.env'), 'FOO=secret\nBAR=x\n');
    writeFileSync(join(dir, '.env.example'), 'OLD=1\n', 'utf8');
    const out = runInit({ cwd: dir, schema: '.env.example', ignore: [], force: true, dryRun: false });
    assert.equal(out.exitCode, 0);
    const example = readFileSync(join(dir, '.env.example'), 'utf8');
    assert.match(example, /BAR=/);
    assert.doesNotMatch(example, /OLD=/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
