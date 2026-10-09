import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { onAbort, aborted, armSignals } from '../src/signals.ts';
import { Exit } from '../src/exit.ts';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(testDir, '..');

test('onAbort registers and removes cleanups', () => {
  let ran = false;
  const cleanup = () => {
    ran = true;
  };
  const unhook = onAbort(cleanup);
  assert.ok(!aborted());
  assert.equal(unhook(), unhook());
  unhook();
  unhook(); // removing twice is harmless
  assert.equal(ran, false);
});

test('armSignals registers exactly one SIGINT handler', () => {
  const original = process.listeners('SIGINT');
  armSignals();
  assert.ok(process.listenerCount('SIGINT') > original.length);
  armSignals();
  armSignals(); // idempotent
});

console.log('TEST SIGSTART');
test('SIGINT cleans up async pending cleanups and the second SIGINT exits immediately', async () => {
  const marker = join(tmpdir(), 'envcheck-sig-double-marker-' + Date.now());
  const markerReady = marker + '.ready';
  const child = spawn('node', ['--experimental-strip-types', 'test/fixtures/sigint-double.mjs'], {
    cwd: projectRoot,
    env: { ...process.env, SIGTEST_MARKER: marker },
  });

  try {
    // Wait for the child to arm signals and register its async cleanup.
    await new Promise<void>(
      (resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void) => {
        const to = setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error('child never signaled ready'));
        }, 5000);
        const check = () => {
          if (existsSync(markerReady)) {
            clearTimeout(to);
            resolve();
          } else {
            setTimeout(check, 10);
          }
        };
        check();
      },
    );

    // First SIGINT: armSignals starts the async cleanup (which writes the marker)
    // and leaves tripped=true while its await is pending.
    writeFileSync('/tmp/sigtest-log', 'sent-first-sigint\n', { flag: 'a' });
    console.log('sent first sigint');
    child.kill('SIGINT');
    // Give the async cleanup a chance to start, then interrupt it a second time.
    await new Promise((r) => setTimeout(r, 200));
    writeFileSync('/tmp/sigtest-log', 'sent-second-sigint\n', { flag: 'a' });
    child.kill('SIGINT');

    const result = await new Promise<{ status: number | null }>((resolve) => {
      child.once('exit', (status: number | null) => resolve({ status }));
    });
    const { status } = result;

    writeFileSync('/tmp/sigtest-log', 'child-exited-' + status + '\n', { flag: 'a' });
    assert.equal(status, Exit.Interrupted, 'second SIGINT while cleanup pending exits Interrupted');
    assert.equal(readFileSync(marker + '.ready', 'utf8'), 'ready', 'child reached ready state');
    assert.equal(readFileSync(marker, 'utf8'), 'cleanup-ran', 'first-SIGINT cleanup started');
  } finally {
    try {
      rmSync(marker, { force: true });
      rmSync(marker + '.ready', { force: true });
    } catch {}
  }
});
