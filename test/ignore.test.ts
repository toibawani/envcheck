import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseIgnore, isIgnored } from '../src/gitignore.ts';
import { scanEnvFiles } from '../src/scan.ts';

test('gitignore patterns', () => {
  const rules = parseIgnore('# c\n.env\n!.env.example\nsecrets/\n*.local\n');
  assert.equal(isIgnored('.env', false, rules), true);
  assert.equal(isIgnored('.env.example', false, rules), false);
  assert.equal(isIgnored('secrets/keys.env', false, rules), true);
  assert.equal(isIgnored('.env.local', false, rules), true);
  assert.equal(isIgnored('app/.env', false, rules), true);
});

test('scan honors gitignore, envcheckignore, and does not loop on symlink cycles', () => {
  const root = mkdtempSync(join(tmpdir(), 'envcheck-'));
  try {
    writeFileSync(join(root, '.gitignore'), '.env\n!.env.example\n');
    writeFileSync(join(root, '.envcheckignore'), '.env.private\n');
    writeFileSync(join(root, '.env.example'), 'A=1\n');
    writeFileSync(join(root, '.env'), 'A=secret\n');
    writeFileSync(join(root, '.env.private'), 'A=hidden\n');
    writeFileSync(join(root, '.env.development'), 'A=\n');
    mkdirSync(join(root, 'loop'));
    try {
      symlinkSync(root, join(root, 'loop', 'back'));
    } catch {
      // some sandboxes refuse symlinks; the rest of the assertion still holds
    }
    const found = scanEnvFiles({ root, extraIgnore: [] })
      .map((f) => f.name)
      .sort();
    assert.deepEqual(found, ['.env.development', '.env.example']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scan respects .envcheckignore with subdirectory patterns', () => {
  const root = mkdtempSync(join(tmpdir(), 'envcheck-'));
  try {
    writeFileSync(join(root, '.envcheckignore'), 'tmp/*.env.*\n', 'utf8');
    mkdirSync(join(root, 'tmp'), { recursive: true });
    writeFileSync(join(root, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(root, '.env'), 'A=1\n', 'utf8');
    writeFileSync(join(root, 'tmp/.env.tmpfile'), 'A=2\n', 'utf8');
    const found = scanEnvFiles({ root, extraIgnore: [] }).map((f) => f.rel);
    assert.ok(found.includes('.env.example'));
    assert.ok(found.includes('.env'));
    assert.ok(!found.includes('tmp/.env.tmpfile'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('scan honors .envcheckignore in subdirectories', () => {
  const root = mkdtempSync(join(tmpdir(), 'envcheck-'));
  try {
    const sub = join(root, 'config');
    mkdirSync(sub, { recursive: true });
    writeFileSync(join(sub, '.envcheckignore'), '.env.secret\n', 'utf8');
    writeFileSync(join(root, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(sub, '.env.public'), 'B=2\n', 'utf8');
    writeFileSync(join(sub, '.env.secret'), 'C=3\n', 'utf8');
    const found = scanEnvFiles({ root, extraIgnore: [] }).map((f) => f.rel);
    assert.ok(found.includes('config/.env.public'));
    assert.ok(!found.includes('config/.env.secret'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
