import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../src/run.ts';
import { Exit } from '../src/exit.ts';

const testDir = fileURLToPath(new URL('.', import.meta.url));

test('runCheck returns Exit.Ok when files match schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.strictEqual(outcome.exitCode, Exit.Ok);
    assert.ok(outcome.text.includes('ok'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck returns Exit.Drift when schema mismatches', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck uses custom schema path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(dir, '.contract'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      schema: '.contract',
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.strictEqual(outcome.exitCode, Exit.Ok);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck respects maxDistance typo cutoff', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'DATABASE_URL=\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'XATBASE_URL=\n', 'utf8');
    let outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      maxDistance: 3,
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(outcome.text.includes('typo'));
    outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      maxDistance: 1,
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(!outcome.text.includes('typo'));
    assert.ok(outcome.text.includes('extra'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck reveals extra values with --reveal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nSECRET=supersecret123\n', 'utf8');
    const noReveal = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const reveal = runCheck({
      cwd: dir,
      json: false,
      reveal: true,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(noReveal.text.includes('su…23'));
    assert.ok(!reveal.text.includes('su…23'));
    assert.ok(reveal.text.includes('supersecret123'));
    assert.ok(!noReveal.text.includes('supersecret123'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck JSON summary includes counts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: true,
      reveal: true,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const json = JSON.parse(outcome.text);
    assert.ok(!json.ok);
    assert.strictEqual(json.summary.missing, 1);
    assert.strictEqual(json.issueCount, 1);
    assert.ok(json.files[0].missing.includes('B'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on missing exits 1 only for missing keys', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nC=3\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['missing'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
    assert.ok(outcome.text.includes('missing'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on extra ignores missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nC=3\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['extra'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
    assert.ok(outcome.text.includes('extra'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on typo exits 1 only for typos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'DATABASE_URL=\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'DATBASE_URL=\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['typo'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
    assert.ok(outcome.text.includes('typo'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on empty exits 1 only for empty values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nB=\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['empty'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
    assert.ok(outcome.text.includes('empty'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on dup exits 1 only for duplicates', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nA=2\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['dup'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
    assert.ok(outcome.text.includes('dup'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on with multiple kinds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\nDATABASE_URL=\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nC=3\nDATBASE_URL=\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['missing', 'typo'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
    assert.ok(outcome.text.includes('missing'));
    assert.ok(outcome.text.includes('typo'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on exits 0 when no matching kinds', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nC=3\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['typo'],
    });
    assert.strictEqual(outcome.exitCode, Exit.Ok);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck --fail-on empty list treats as no filter', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: [],
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('runCheck uses golden fixture for fail-on scenario', () => {
  const dir = join(testDir, 'fixtures', 'fail-on');
  const outcome = runCheck({
    cwd: dir,
    json: false,
    reveal: false,
    ignore: [],
    stats: false,
    skipEmpty: false,
    skipNoPairs: false,
    failOn: ['typo'],
  });
  assert.strictEqual(outcome.exitCode, Exit.Drift);
  assert.ok(outcome.text.includes('typo'));
  assert.ok(outcome.text.includes('DATBASE_URL'));
});

test('runCheck JSON output has stable contract', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-run-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nC=3\n', 'utf8');
    const outcome = runCheck({
      cwd: dir,
      json: true,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const json = JSON.parse(outcome.text);

    assert.ok(typeof json.version === 'string');
    assert.ok(typeof json.schema === 'string');
    assert.ok(Array.isArray(json.files));
    assert.ok(typeof json.summary === 'object');
    assert.ok(typeof json.summary.missing === 'number');
    assert.ok(typeof json.summary.empty === 'number');
    assert.ok(typeof json.summary.extra === 'number');
    assert.ok(typeof json.summary.typos === 'number');
    assert.ok(typeof json.summary.duplicates === 'number');
    assert.ok(typeof json.issueCount === 'number');
    assert.ok(typeof json.ok === 'boolean');
    assert.ok(typeof json.exitCode === 'number');

    assert.ok(json.files[0].path);
    assert.ok(typeof json.files[0].bytes === 'number');
    assert.ok(typeof json.files[0].emptyFile === 'boolean');
    assert.ok(typeof json.files[0].noPairs === 'boolean');
    assert.ok(typeof json.files[0].ok === 'boolean');
    assert.ok(Array.isArray(json.files[0].missing));
    assert.ok(Array.isArray(json.files[0].empty));
    assert.ok(Array.isArray(json.files[0].extra));
    assert.ok(Array.isArray(json.files[0].typos));
    assert.ok(Array.isArray(json.files[0].duplicates));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


