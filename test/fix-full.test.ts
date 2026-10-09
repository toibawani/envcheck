import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixFile } from '../src/fix.ts';
import type { LoadedEnv } from '../src/load.ts';
import type { ParseResult } from '../src/parse.ts';
import { parseEnv, maskValue } from '../src/parse.ts';
import { _setPrompts } from '../src/prompt.ts';

function makeLoaded(path: string, text: string): LoadedEnv {
  const parsed = parseEnv(text, path);
  return {
    rel: path,
    abs: path,
    bytes: Buffer.byteLength(text, 'utf8'),
    emptyFile: text.trim().length === 0,
    noPairs: parsed.entries.length === 0,
    parsed,
  };
}

test('fixFile returns clean when file matches schema', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-fix-'));
  try {
    const env = join(dir, '.env');
    const schema = parseEnv('FOO=a\nBAR=b\n', 'schema');
    const loaded = makeLoaded(env, 'FOO=a\nBAR=b\n');
    const result = await fixFile(loaded, schema, 3, false);
    assert.equal(result, 'clean');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixFile adds missing keys and writes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-fix-'));
  try {
    const env = join(dir, '.env');
    writeFileSync(env, 'FOO=a\n', 'utf8');
    const schema = parseEnv('FOO=a\nBAR=b\n', 'schema');
    const loaded = makeLoaded(env, 'FOO=a\n');
    const mtime = statSync(env).mtimeMs;
    const answers: string[] = [];
    try {
      _setPrompts(
        async (q) => {
          answers.push(q);
          return true;
        },
        async (q) => {
          answers.push(q);
          return 'secret';
        },
      );
      const result = await fixFile(loaded, schema, 3, false);
      assert.equal(result, 'changed');
      const content = readFileSync(env, 'utf8');
      assert.ok(content.includes('FOO=a'));
      assert.ok(content.includes('BAR=secret'));
    } finally {
      _setPrompts(undefined, undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixFile skips missing keys when declined', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-fix-'));
  try {
    const env = join(dir, '.env');
    writeFileSync(env, 'FOO=a\n', 'utf8');
    const schema = parseEnv('FOO=a\nBAR=b\n', 'schema');
    const loaded = makeLoaded(env, 'FOO=a\n');
    try {
      _setPrompts(
        async (q) => q.includes('rename') || q.includes('write'),
        async (q) => {
          if (q.includes('value')) return 'n';
          return 'n';
        },
      );
      const result = await fixFile(loaded, schema, 3, false);
      assert.equal(result, 'skipped');
      const content = readFileSync(env, 'utf8');
      assert.equal(content.trim(), 'FOO=a');
    } finally {
      _setPrompts(undefined, undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixFile renames typos when confirmed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-fix-'));
  try {
    const env = join(dir, '.env');
    writeFileSync(env, 'DATBASE_URL=x\n', 'utf8');
    const schema = parseEnv('DATABASE_URL=\n', 'schema');
    const loaded = makeLoaded(env, 'DATBASE_URL=x\n');
    try {
      _setPrompts(
        async (q) => {
          if (q.includes('rename')) return true;
          if (q.includes('write')) return true;
          return false;
        },
        async () => 'n',
      );
      const result = await fixFile(loaded, schema, 3, false);
      assert.equal(result, 'changed');
      const content = readFileSync(env, 'utf8');
      assert.ok(content.includes('DATABASE_URL='));
      assert.ok(!content.includes('DATBASE_URL'));
    } finally {
      _setPrompts(undefined, undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixFile removes extra keys when confirmed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-fix-'));
  try {
    const env = join(dir, '.env');
    writeFileSync(env, 'FOO=a\nEXTRA=orphan\n', 'utf8');
    const schema = parseEnv('FOO=a\n', 'schema');
    const loaded = makeLoaded(env, 'FOO=a\nEXTRA=orphan\n');
    try {
      _setPrompts(
        async (q) => q.includes('write') || q.includes('remove'),
        async (q) => {
          if (q.includes('remove')) return 'y';
          return 'n';
        },
      );
      const result = await fixFile(loaded, schema, 3, false);
      assert.equal(result, 'changed');
      const content = readFileSync(env, 'utf8');
      assert.ok(content.includes('FOO=a'));
      assert.ok(!content.includes('EXTRA'));
    } finally {
      _setPrompts(undefined, undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('fixFile writes nothing when preview declined', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'envcheck-fix-'));
  try {
    const env = join(dir, '.env');
    writeFileSync(env, 'FOO=a\nEXTRA=drift\n', 'utf8');
    const schema = parseEnv('FOO=a\n', 'schema');
    const before = readFileSync(env, 'utf8');
    const loaded = makeLoaded(env, 'FOO=a\nEXTRA=drift\n');
    try {
      _setPrompts(
        async (q) => {
          if (q.includes('write')) return false;
          return true;
        },
        async (q) => 'n',
      );
      const result = await fixFile(loaded, schema, 3, false);
      assert.equal(result, 'skipped');
      assert.equal(readFileSync(env, 'utf8'), before);
    } finally {
      _setPrompts(undefined, undefined);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('maskValue hides values shorter than 5 chars', () => {
  assert.equal(maskValue('abc'), '••••');
  assert.equal(maskValue('abcd'), '••••');
  assert.equal(maskValue(''), '(empty)');
});

test('maskValue masks long values first/last 2 chars', () => {
  assert.equal(maskValue('12345'), '12…45');
  assert.equal(maskValue('abcdefghijklmnop'), 'ab…op');
});
