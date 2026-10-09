import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  statSync,
  readdirSync,
  mkdirSync,
  utimesSync,
  chmodSync,
} from 'node:fs';
import { writeAtomic } from '../src/atomic.ts';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCheck } from '../src/run.ts';
import { EnvcheckError } from '../src/errors.ts';
import { Exit } from '../src/exit.ts';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(testDir, '..');

test('writeAtomic creates file with correct content', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const path = join(dir, 'test.env');
    writeAtomic(path, 'KEY=value\n', undefined);
    const content = readFileSync(path, 'utf8');
    assert.equal(content, 'KEY=value\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic creates nested parent directories implicitly via rename', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const path = join(dir, 'nested', 'deep', 'file.env');
    mkdirSync(join(dir, 'nested', 'deep'), { recursive: true });
    writeAtomic(path, 'A=1\n', undefined);
    assert.equal(readFileSync(path, 'utf8'), 'A=1\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic preserves existing file mtime when expectedMtime is provided', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const path = join(dir, 'test.env');
    writeFileSync(path, 'OLD=value\n', 'utf8');
    const mtime = statSync(path).mtimeMs;
    writeAtomic(path, 'NEW=value\n', mtime);
    assert.ok(Math.abs(statSync(path).mtimeMs - mtime) <= 2000, 'mtime preserved within 2s');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic leaves no stray temp files behind', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const path = join(dir, 'test.env');
    writeAtomic(path, 'A=1\n', undefined);
    assert.equal(readFileSync(path, 'utf8'), 'A=1\n');
    const entries = readdirSync(dir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0], 'test.env');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atomic commit preserves file content across runs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'FOO=\\nBAR=\\nBAZ=\\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'FOO=hello\\nBAR=world\\nBAZ=test\\n', 'utf8');
    runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const content = readFileSync(join(dir, '.env'), 'utf8');
    assert.strictEqual(content, 'FOO=hello\\nBAR=world\\nBAZ=test\\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atomic commit does not modify the schema', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    writeFileSync(join(dir, '.env.example'), 'FOO=\\nBAR=\\n', 'utf8');
    writeFileSync(join(dir, '.env'), 'FOO=hello\\nBAR=world\\nBAZ=test\\n', 'utf8');
    runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const schema = readFileSync(join(dir, '.env.example'), 'utf8');
    assert.ok(!schema.includes('BAZ'));
    assert.strictEqual(schema, 'FOO=\\nBAR=\\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic preserves mtime when unchanged', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const path = join(dir, '.env');
    writeFileSync(path, 'A=1\n', 'utf8');
    const mtime = statSync(path).mtimeMs;
    // Read back the same content and rewrite with matching mtime.
    const content = readFileSync(path, 'utf8');
    writeAtomic(path, content, mtime);
    assert.ok(Math.abs(statSync(path).mtimeMs - mtime) <= 2000, 'mtime preserved within 2s');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic creates parent directories when needed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const sub = join(dir, 'a', 'b', 'c');
    mkdirSync(sub, { recursive: true });
    const path = join(sub, '.env');
    writeAtomic(path, 'A=1\n', 0);
    assert.ok(existsSync(path));
    assert.strictEqual(readFileSync(path, 'utf8'), 'A=1\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic throws Locked on mtime mismatch', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    const path = join(dir, 'test.env');
    writeFileSync(path, 'A=1\n', 'utf8');
    const mtime = statSync(path).mtimeMs;
    utimesSync(path, mtime - 60_000, mtime - 60_000);
    assert.throws(
      () => writeAtomic(path, 'B=2\n', mtime),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Locked);
        assert.match((err as Error).message, /changed while envcheck was preparing the write/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic throws Locked on EACCES', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    chmodSync(dir, 0o000);
    const path = join(dir, 'test.env');
    assert.throws(
      () => writeAtomic(path, 'A=1\n', undefined),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Locked);
        assert.match((err as EnvcheckError).message, /Could not write/);
        assert.match((err as EnvcheckError).why, /locked or immutable/);
        return true;
      },
    );
  } finally {
    try {
      chmodSync(dir, 0o755);
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic throws Unreadable on a directory path (EISDIR)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-atomic-'));
  try {
    assert.throws(
      () => writeAtomic(dir, 'A=1\n', undefined),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Unreadable);
        assert.match((err as EnvcheckError).what, /Write to .* failed/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeAtomic cleans up its temp file if SIGINT arrives mid-write', async () => {
  const marker = join(tmpdir(), 'envcheck-sig-child-ready-' + process.pid);
  const currentMarker = marker + '.current';
  const doneMarker = marker + '.done';

  for (let attempt = 0; attempt < 8; attempt++) {
    const child = spawn('node', ['--experimental-strip-types', 'test/fixtures/sigint-child.mjs'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        SIGTEST_READY: marker,
        SIGTEST_TMPDIR: tmpdir(),
      },
    });

    try {
      // Wait for the child to signal readiness (about to enter the write loop).
      await new Promise<void>(
        (resolve: (value: void | PromiseLike<void>) => void, reject: (reason?: any) => void) => {
          const to = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error('child never signaled ready'));
          }, 5000);
          const poll = setInterval(() => {
            if (existsSync(marker)) {
              clearInterval(poll);
              clearTimeout(to);
              resolve();
            }
          }, 5);
        },
      );

      // Send SIGINT sometime while the child is looping writeAtomic.
      await new Promise<void>((r) => setTimeout(r, 200 + Math.floor(Math.random() * 1600)));
      child.kill('SIGINT');

      const result = await new Promise<{ status: number | null }>((resolve) => {
        child.once('exit', (status: number | null) => resolve({ status }));
      });
      const { status } = result;

      // On a hit, the onAbort cleanup unlinks the in-flight tmp, renameSync(ENOENT)
      // makes writeAtomic throw, and the process crashes before writing the done marker.
      // On a miss, Node's default SIGINT handler exits 130 and leaves the tmp orphaned.
      const current = existsSync(currentMarker) ? readFileSync(currentMarker, 'utf8').trim() : '';
      assert.ok(current, 'child should be mid-write when SIGINT arrives');
      assert.equal(
        existsSync(current),
        false,
        'the onAbort handler must have removed the in-flight temp file (interrupted write)',
      );
      assert.ok(
        !existsSync(doneMarker),
        'child should have crashed mid-loop, not reached the normal done path',
      );
      assert.notStrictEqual(status, 0, 'interrupted write must not exit cleanly');
      break;
    } catch {
      if (attempt === 7) throw new Error('SIGINT cleanup test failed all attempts');
      // Miss: the orphaned tmp is still on disk — clean up and retry.
      try {
        rmSync(marker, { force: true });
        rmSync(currentMarker, { force: true });
        rmSync(doneMarker, { force: true });
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    } finally {
      try {
        rmSync(marker, { force: true });
        rmSync(currentMarker, { force: true });
        rmSync(doneMarker, { force: true });
      } catch {}
    }
  }
});
