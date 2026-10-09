import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/parse.ts';
import { schemaDefaults } from '../src/diff.ts';
import { diffFile } from '../src/diff.ts';

test('missing, empty, extra, typo', () => {
  const schema = parseEnv('DATABASE_URL=postgres://local\nPORT=3000\nSECRET=\n', 'schema');
  const file = parseEnv('DATBASE_URL=postgres://local\nPORT=\nEXTRA=1\n', '.env');
  const report = diffFile('.env', file, schema, 3);
  assert.deepEqual(report.missing, ['SECRET']);
  assert.deepEqual(
    report.empty.map((e) => e.key),
    ['PORT'],
  );
  assert.equal(report.typos[0]?.key, 'DATBASE_URL');
  assert.equal(report.typos[0]?.suggestion, 'DATABASE_URL');
  assert.deepEqual(
    report.extra.map((e) => e.key),
    ['EXTRA'],
  );
  assert.equal(report.ok, false);
});

test('typo does not fire when canonical key is already present', () => {
  const schema = parseEnv('DATABASE_URL=\n', 'schema');
  const file = parseEnv('DATABASE_URL=ok\nDATBASE_URL=oops\n', '.env');
  const report = diffFile('.env', file, schema, 3);
  assert.equal(report.typos.length, 0);
  assert.deepEqual(
    report.extra.map((e) => e.key),
    ['DATBASE_URL'],
  );
});

test('diffFile reports interpolated keys', () => {
  const schema = parseEnv('BASE_URL=https://api.example.com\n', 'schema');
  const file = parseEnv('URL=${BASE_URL}/v1\n', '.env');
  const report = diffFile('.env', file, schema, 3);
  assert.equal(report.interpolated[0]?.key, 'URL');
  assert.deepEqual(report.interpolated[0]?.refs, ['BASE_URL']);
});

test('diffFile reports duplicate keys', () => {
  const schema = parseEnv('A=1\n', 'schema');
  const file = parseEnv('A=1\nA=2\n', '.env');
  const report = diffFile('.env', file, schema, 3);
  assert.deepEqual(report.duplicates, ['A']);
});

test('diffFile reports ok when file matches schema', () => {
  const schema = parseEnv('A=1\nB=2\n', 'schema');
  const file = parseEnv('A=1\nB=2\n', '.env');
  const report = diffFile('.env', file, schema, 3);
  assert.equal(report.ok, true);
  assert.deepEqual(report.missing, []);
  assert.deepEqual(report.extra, []);
  assert.deepEqual(report.typos, []);
});

test('diffFile reports empty file', () => {
  const schema = parseEnv('A=1\n', 'schema');
  const file = parseEnv('', '.env');
  const report = diffFile('.env', file, schema, 3);
  assert.deepEqual(report.missing, ['A']);
  assert.equal(report.ok, false);
});

test('schemaDefaults returns the schema map', () => {
  const parsed = parseEnv('FOO=bar\nBAR=baz\n', 'schema');
  const defaults = schemaDefaults(parsed);
  assert.ok(defaults.has('FOO'));
  assert.strictEqual(defaults.get('FOO')?.value, 'bar');
  assert.ok(defaults.has('BAR'));
});
