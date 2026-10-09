import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'cli.js');
const golden = join(root, 'test', 'fixtures', 'golden');

test('NO_COLOR produces zero ESC bytes', () => {
  const r = spawnSync(process.execPath, [cli, 'check', golden], {
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    encoding: 'utf8',
  });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.equal(out.includes('\x1b'), false);
});

test('--no-color produces zero ESC bytes', () => {
  const r = spawnSync(process.execPath, [cli, 'check', golden, '--no-color'], {
    env: { ...process.env, FORCE_COLOR: '0' },
    encoding: 'utf8',
  });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.equal(out.includes('\x1b'), false);
});
