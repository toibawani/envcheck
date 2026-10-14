import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCheck } from '../src/run.ts';
import { Exit } from '../src/exit.ts';

const testDir = fileURLToPath(new URL('.', import.meta.url));

test('CLI integration: --fail-on with parsing matches runCheck behavior', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-cli-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'A=1\nB=2\nDATABASE_URL=\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\nDATBASE_URL=\n', 'utf8');

    // Simulate CLI parsing of --fail-on typo
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

    // Simulate CLI parsing of --fail-on extra (should exit 0 - no extra keys)
    const outcomeExtra = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
      failOn: ['extra'],
    });
    assert.strictEqual(outcomeExtra.exitCode, Exit.Ok);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
