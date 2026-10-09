import { test } from 'node:test';
import assert from 'node:assert/strict';
import { version } from '../src/version.ts';

test('version returns a semantic version string', () => {
  const v = version();
  assert.ok(typeof v === 'string');
  assert.ok(/^\d+\.\d+\.\d+/.test(v), 'version ' + v + ' does not look semantic');
});
