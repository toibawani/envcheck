import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorEnabled, configureColor, paint, _setTtyCheck } from '../src/color.ts';

test('colors are enabled by default', () => {
  assert.equal(colorEnabled(), true);
});

test('colors are disabled by configureColor with noColorFlag', () => {
  configureColor({ noColorFlag: true, json: false });
  assert.equal(colorEnabled(), false);
  assert.equal(paint('green', 'x'), 'x');
});

test('colors are disabled by configureColor in json mode', () => {
  configureColor({ noColorFlag: false, json: true });
  assert.equal(colorEnabled(), false);
  assert.equal(paint('red', 'x'), 'x');
});

test('colors are disabled when NO_COLOR env var is set', () => {
  process.env.NO_COLOR = '1';
  try {
    configureColor({ noColorFlag: false, json: false });
    assert.equal(colorEnabled(), false);
  } finally {
    delete process.env.NO_COLOR;
  }
});

test('colors are disabled when TERM is dumb', () => {
  process.env.TERM = 'dumb';
  try {
    configureColor({ noColorFlag: false, json: false });
    assert.equal(colorEnabled(), false);
  } finally {
    delete process.env.TERM;
  }
});

test('colors are enabled when stdout is a TTY', () => {
  try {
    _setTtyCheck(() => true);
    configureColor({ noColorFlag: false, json: false });
    assert.equal(colorEnabled(), true);
  } finally {
    configureColor({ noColorFlag: false, json: false });
  }
});

test('paint applies ANSI escapes when enabled', () => {
  try {
    _setTtyCheck(() => true);
    configureColor({ noColorFlag: false, json: false });
    assert.ok(paint('red', 'x').includes('\u001b[31m'));
    assert.ok(paint('yellow', 'x').includes('\u001b[33m'));
    assert.ok(paint('green', 'x').includes('\u001b[32m'));
    assert.ok(paint('cyan', 'x').includes('\u001b[36m'));
    assert.ok(paint('dim', 'x').includes('\u001b[2m'));
    assert.ok(paint('bold', 'x').includes('\u001b[1m'));
  } finally {
    configureColor({ noColorFlag: false, json: false });
  }
});
