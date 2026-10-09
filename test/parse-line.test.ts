import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssignment, findInterpolations } from '../src/parse-line.ts';
import { EnvcheckError } from '../src/errors.ts';
import { Exit } from '../src/exit.ts';

test('parseAssignment parses simple KEY=value', () => {
  const { entry } = parseAssignment('FOO=bar', ['FOO=bar'], 0, 'file.env', 1, undefined);
  assert.strictEqual(entry.key, 'FOO');
  assert.strictEqual(entry.value, 'bar');
});

test('parseAssignment rejects lines without = with comment', () => {
  try {
    parseAssignment('notanassignment', ['notanassignment'], 0, 'file.env', 1, undefined);
    throw new Error('should have thrown');
  } catch (err) {
    assert.ok((err as Error).message.includes('not a KEY=VALUE assignment'));
  }
});

test('parseAssignment accepts leading export', () => {
  const { entry } = parseAssignment(
    'export BAZ=qux',
    ['export BAZ=qux'],
    0,
    'file.env',
    1,
    undefined,
  );
  assert.strictEqual(entry.key, 'BAZ');
  assert.strictEqual(entry.value, 'qux');
  assert.ok(entry.exported);
});

test('parseAssignment trims whitespace around key and value', () => {
  const { entry } = parseAssignment(
    '  SPACEY  =  spaced value  ',
    ['  SPACEY  =  spaced value  '],
    0,
    'file.env',
    1,
    undefined,
  );
  assert.strictEqual(entry.key, 'SPACEY');
  assert.strictEqual(entry.value, 'spaced value');
});

test('findInterpolations detects variable interpolations', () => {
  const found = findInterpolations('Hello ${NAME} and $OTHER');
  assert.deepStrictEqual(found.sort(), ['NAME', 'OTHER']);
});

test('findInterpolations ignores invalid names', () => {
  const found = findInterpolations('$123 $-invalid');
  assert.strictEqual(found.length, 0);
});

test('parseAssignment rejects trailing junk after a quoted value', () => {
  const lines = ['FOO="bar" junk after'];
  assert.throws(
    () => parseAssignment(lines[0]!, lines, 0, 'file.env', 1, undefined),
    (err: unknown) => {
      assert.ok(err instanceof EnvcheckError);
      assert.equal(err.exitCode, Exit.Unreadable);
      assert.match(err.message, /trailing junk/);
      return true;
    },
  );
});
