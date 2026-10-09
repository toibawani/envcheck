import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diagnose } from '../src/diagnose.ts';

test('diagnose reports envcheck/node/platform/cwd', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-diagnose-'));
  try {
    const report = diagnose(dir);
    assert.match(report.envcheck, /^\d+\.\d+\.\d+$/);
    assert.match(report.node, /v\d+\.\d+\.\d+/);
    assert.ok(report.platform);
    assert.equal(report.cwd, dir);
    assert.ok(Array.isArray(report.issues));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('diagnose reports not-found schema when missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-diagnose-'));
  try {
    const report = diagnose(dir);
    assert.equal((report.schema as { status: string }).status, 'not-found');
    assert.ok((report.schema as { paths: string[] }).paths.includes('.env.example'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('diagnose reports config not-found when no .envcheckrc', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-diagnose-'));
  try {
    const report = diagnose(dir);
    assert.equal((report.config as { status: string }).status, 'not-found');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
