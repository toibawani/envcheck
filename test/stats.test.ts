import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck } from '../src/run.ts';

test('stats are computed correctly', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-stats-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\nC=1\nD=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\nA=3\nD=2\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: true,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(outcome.text.includes('1 missing'));
    assert.ok(outcome.text.includes('1 dup'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--skip-empty hides empty-file issues', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-stats-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(dir, '.env.empty'), '', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: true,
      skipEmpty: true,
      skipNoPairs: false,
    });
    assert.ok(!outcome.text.includes('empty file'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('--skip-no-pairs hides comment-only issues', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-stats-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(dir, '.env.comments'), '# hello\n# world\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: true,
      skipEmpty: false,
      skipNoPairs: true,
    });
    assert.ok(!outcome.text.includes('no keys'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
