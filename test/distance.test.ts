import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levenshtein, suggestKey } from '../src/distance.ts';

test('suggestKey returns the same key when there is an exact match', () => {
  const keys = ['DATABASE_URL', 'API_KEY', 'REDIS_URL'];
  assert.strictEqual(suggestKey('DATABASE_URL', keys), 'DATABASE_URL');
});

test('suggestKey finds the closest match within maxDistance', () => {
  const keys = ['DATABASE_URL', 'API_KEY', 'REDIS_URL'];
  assert.strictEqual(suggestKey('DATBASE_URL', keys), 'DATABASE_URL');
});

test('suggestKey returns undefined when no match within maxDistance', () => {
  const keys = ['DATABASE_URL', 'API_KEY'];
  assert.strictEqual(suggestKey('ZOMGWHAT', keys, 3), undefined);
});

test('suggestKey prefers shorter distance', () => {
  const keys = ['API_KEY', 'APP_KEY'];
  assert.strictEqual(suggestKey('APIKEY', keys), 'API_KEY');
});

test('suggestKey ignores single-character keys', () => {
  const keys = ['A', 'B', 'C'];
  const suggestion = suggestKey('X', keys, 3);
  assert.strictEqual(suggestion, undefined);
});

test('suggestKey finds match with distance equal to maxDistance', () => {
  const keys = ['DATABASE_URL'];
  assert.strictEqual(suggestKey('DBASE_URL', keys), 'DATABASE_URL');
});

test('suggestKey returns first match when multiple are equally close', () => {
  const keys = ['API_KEY', 'APP_KEY'];
  const s = suggestKey('APIKEY', keys);
  assert.ok(s === 'API_KEY' || s === 'APP_KEY');
});

test('suggestKey handles numbers in keys', () => {
  const keys = ['PORT3000', 'PORT8080'];
  const s = suggestKey('PORT300', keys, 1);
  assert.strictEqual(s, 'PORT3000');
});

test('levenshtein basics', () => {
  assert.equal(levenshtein('a', 'a'), 0);
  assert.equal(levenshtein('DATBASE_URL', 'DATABASE_URL'), 1);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('suggests the closest schema key', () => {
  assert.equal(
    suggestKey('DATBASE_URL', ['DATABASE_URL', 'REDIS_URL', 'API_KEY'], 3),
    'DATABASE_URL',
  );
});

test('STRIPE_SECERT maps to STRIPE_SECRET', () => {
  assert.equal(suggestKey('STRIPE_SECERT', ['STRIPE_SECRET', 'STRIPE_KEY'], 3), 'STRIPE_SECRET');
});

test('cap stops runaway distance', () => {
  assert.ok(levenshtein('a'.repeat(40), 'b'.repeat(40), 3) > 3);
});

test('ignores schema keys shorter than 4 chars', () => {
  assert.equal(suggestKey('AB', ['ABC', 'ABCD'], 3), 'ABCD');
});

test('false positive: unrelated long key is not suggested', () => {
  assert.equal(suggestKey('COMPLETELY_OTHER', ['DATABASE_URL'], 2), undefined);
});

test('suggestKey suggests transposed keys', () => {
  assert.equal(suggestKey('BAZY', ['ABZY']), 'ABZY');
  assert.equal(suggestKey('PASSWORd', ['PASSWORD']), 'PASSWORD');
});
