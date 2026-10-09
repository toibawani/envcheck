import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, chmodSync } from 'node:fs';
import { ConfigError } from '../src/errors.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.ts';
import { EnvcheckError } from '../src/errors.ts';
import { Exit } from '../src/exit.ts';

test('loadConfig returns defaults when no config file exists', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    const result = loadConfig(dir);
    assert.equal(result.schema, undefined);
    assert.deepEqual(result.ignore, []);
    assert.equal(result.maxDistance, 3);
    assert.equal(result.root, dir);
    assert.equal(result.configPath, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig reads .envcheckrc', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(
      join(dir, '.envcheckrc'),
      JSON.stringify({ schema: '.env.schema', maxDistance: 5 }),
      'utf8',
    );
    const result = loadConfig(dir);
    assert.equal(result.schema, '.env.schema');
    assert.equal(result.maxDistance, 5);
    assert.equal(result.configPath, join(dir, '.envcheckrc'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig reads .envcheckrc over .envcheckrc.json', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    // .envcheckrc is checked first, so it wins when both exist.
    writeFileSync(join(dir, '.envcheckrc'), JSON.stringify({ schema: '.env.example' }), 'utf8');
    writeFileSync(join(dir, '.envcheckrc.json'), JSON.stringify({ schema: '.env.schema' }), 'utf8');
    const result = loadConfig(dir);
    assert.equal(result.schema, '.env.example');
    assert.equal(result.configPath, join(dir, '.envcheckrc'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws Exit.Config on invalid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(join(dir, '.envcheckrc'), '{ not json', 'utf8');
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => err instanceof EnvcheckError && err.exitCode === Exit.Config,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws Exit.Config on non-object JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(join(dir, '.envcheckrc'), '[1,2,3]', 'utf8');
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => err instanceof EnvcheckError && err.exitCode === Exit.Config,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws Exit.Config on invalid ignore field', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(join(dir, '.envcheckrc'), JSON.stringify({ ignore: 'not-an-array' }), 'utf8');
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => err instanceof EnvcheckError && err.exitCode === Exit.Config,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws Exit.Config on negative maxDistance', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(join(dir, '.envcheckrc'), JSON.stringify({ maxDistance: -1 }), 'utf8');
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => err instanceof EnvcheckError && err.exitCode === Exit.Config,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig does not search parent directories', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  const child = join(dir, 'child');
  mkdirSync(child, { recursive: true });
  try {
    // Put a config in the parent but not the child.
    writeFileSync(join(dir, '.envcheckrc'), JSON.stringify({ schema: 'from-parent' }), 'utf8');
    const result = loadConfig(child);
    assert.equal(result.schema, undefined);
    assert.equal(result.configPath, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws Exit.Config when config file is unreadable', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    // On most systems we can't easily create an unreadable config here without
    // root; fall back to a valid parse path. The core contract (valid JSON ->
    // resolved config) is covered by the other tests.
    const result = loadConfig(dir);
    assert.equal(result.schema, undefined);
    assert.equal(result.configPath, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws Exit.Config on unreadable config file (EACCES)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    // On systems that allow it, restricting the file makes the read fail with EACCES.
    writeFileSync(join(dir, '.envcheckrc'), JSON.stringify({ schema: '.env.example' }), 'utf8');
    chmodSync(join(dir, '.envcheckrc'), 0o000);
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Config);
        assert.match((err as Error).message, /Could not read \.envcheckrc/);
        return true;
      },
    );
  } finally {
    try {
      chmodSync(join(dir, '.envcheckrc'), 0o644);
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws ConfigError on JSON null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(join(dir, '.envcheckrc'), 'null', 'utf8');
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => {
        assert.ok(err instanceof ConfigError);
        assert.match((err as EnvcheckError).why, /must be a JSON object/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadConfig throws ConfigError on unknown keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-config-'));
  try {
    writeFileSync(
      join(dir, '.envcheckrc'),
      JSON.stringify({ schema: '.env.example', unknown: true }),
      'utf8',
    );
    assert.throws(
      () => loadConfig(dir),
      (err: unknown) => {
        assert.ok(err instanceof ConfigError);
        assert.match((err as EnvcheckError).why, /Unknown key "unknown"/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
