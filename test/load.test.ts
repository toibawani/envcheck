import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, statSync, chmodSync } from 'node:fs';
import { fileMtime } from '../src/load.ts';
import { EnvcheckError } from '../src/errors.ts';
import { Exit } from '../src/exit.ts';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnvFile } from '../src/load.ts';

test('loadEnvFile parses a basic env file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    assert.strictEqual(loaded.bytes, 8);
    assert.strictEqual(loaded.parsed.entries.length, 2);
    assert.ok(!loaded.emptyFile);
    assert.ok(!loaded.noPairs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile reports an empty file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), '', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    assert.ok(loaded.emptyFile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile reports comments-only as noPairs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), '# comment\n# another\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    assert.ok(loaded.noPairs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile preserves quoted values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'A="hello world"\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    const a = loaded.parsed.map.get('A');
    assert.ok(a);
    assert.strictEqual(a.value, 'hello world');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile loads keys as a map', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'A=1\nB=2\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    assert.ok(loaded.parsed.map.has('A'));
    assert.ok(loaded.parsed.map.has('B'));
    assert.ok(!loaded.parsed.map.has('C'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile handles keys with equals signs in values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'A=1=2=3\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    const a = loaded.parsed.map.get('A');
    assert.ok(a);
    assert.strictEqual(a.value, '1=2=3');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile handles export prefix', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'export EXPORTED=1\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    const a = loaded.parsed.map.get('EXPORTED');
    assert.ok(a);
    assert.ok(a.exported);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile handles inline comments', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'A=1 # inline comment\n', 'utf8');
    const loaded = loadEnvFile(join(dir, '.env'), '.env');
    const a = loaded.parsed.map.get('A');
    assert.ok(a);
    assert.strictEqual(a.comment, 'inline comment');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile throws NotFound when the file disappears before reading', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    const path = join(dir, '.env');
    writeFileSync(path, 'FOO=bar\n', 'utf8');
    rmSync(path);
    assert.throws(
      () => loadEnvFile(path, 'vanished.env'),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.NotFound);
        assert.match((err as Error).message, /disappeared during the scan/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile throws Unreadable for invalid UTF-8 with no NUL byte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    const path = join(dir, '.env');
    writeFileSync(path, Buffer.from([0xff, 0xfe, 0x80, 0x81]), 'utf8');
    assert.throws(
      () => loadEnvFile(path, 'badutf8.bin'),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Unreadable);
        assert.match((err as EnvcheckError).what, /not valid UTF-8/);
        assert.match((err as EnvcheckError).fix, /iconv/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fileMtime returns the file mtimeMs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    const path = join(dir, '.env');
    writeFileSync(path, 'FOO=bar\n', 'utf8');
    const mtime = statSync(path).mtimeMs;
    assert.equal(fileMtime(path), mtime);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile throws Unreadable on permission denied (EACCES)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    writeFileSync(join(dir, '.env'), 'FOO=bar\n', 'utf8');
    chmodSync(join(dir, '.env'), 0o000);
    assert.throws(
      () => loadEnvFile(join(dir, '.env'), '.env'),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Unreadable);
        assert.match((err as Error).message, /Permission denied reading/);
        return true;
      },
    );
  } finally {
    try {
      chmodSync(join(dir, '.env'), 0o644);
    } catch {}
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnvFile throws Unreadable for binary data with NUL byte', () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-load-'));
  try {
    const buf = Buffer.concat([Buffer.from('FOO=bar\n'), Buffer.from([0x00, 0x01, 0x02])]);
    writeFileSync(join(dir, '.env'), buf);
    assert.throws(
      () => loadEnvFile(join(dir, '.env'), '.env'),
      (err: unknown) => {
        assert.ok(err instanceof EnvcheckError);
        assert.equal((err as EnvcheckError).exitCode, Exit.Unreadable);
        assert.match((err as Error).message, /not valid UTF-8 text/);
        return true;
      },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
