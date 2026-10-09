import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderText, renderJson } from '../src/format.ts';

test('renderText shows ok for matching files', () => {
  const input = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '.env',
          ok: true,
          missing: [],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as unknown as Parameters<typeof renderText>[0];
  const text = renderText(input);
  assert.ok(text.includes('ok'));
  assert.ok(text.includes('.env'));
});

test('renderText shows issues for drift', () => {
  const input = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '.env',
          ok: false,
          missing: ['MISSING_KEY'],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as unknown as Parameters<typeof renderText>[0];
  const text = renderText(input);
  assert.ok(text.includes('missing'));
  assert.ok(text.includes('MISSING_KEY'));
});

test('renderText shows stats when provided', () => {
  const input = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    stats: { missing: 1, empty: 0, typo: 0, extra: 0, dup: 0, interpolated: 0, other: 0 },
    files: [
      {
        loaded: {
          bytes: 4,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '.env',
          ok: false,
          missing: ['MISSING_KEY'],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as unknown as Parameters<typeof renderText>[0];
  const text = renderText(input);
  assert.ok(text.includes('1 missing'));
});

test('renderJson returns valid JSON with summary', () => {
  const input = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '.env',
          ok: false,
          missing: ['MISSING_KEY'],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as unknown as Parameters<typeof renderJson>[0];
  const json = JSON.parse(renderJson(input));
  assert.ok(json.summary);
  assert.strictEqual(json.summary.missing, 1);
  assert.strictEqual(json.ok, false);
});

test('renderText skips empty files when skipEmpty is true', () => {
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: true,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 0,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: true,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: true,
          missing: [],
          empty: [],
          extra: [],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
  };
  const out = renderText(input);
  assert.ok(!out.includes('empty file'));
});

test('renderText reports empty files when skipEmpty is false', () => {
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 0,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: true,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: true,
          missing: [],
          empty: [],
          extra: [],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
    stats: { missing: 0, empty: 0, typo: 0, extra: 0, dup: 0, interpolated: 0, other: 1 },
  };
  const out = renderText(input);
  assert.ok(out.includes('empty file'));
  assert.ok(out.includes('issue'));
});

test('renderText skips no-pairs files when skipNoPairs is true', () => {
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: true,
    files: [
      {
        loaded: {
          bytes: 5,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: true,
          parsed: {
            entries: [],
            map: new Map(),
            duplicates: [],
            comments: new Map([['# c', 'comment']]),
          },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: false,
          missing: [],
          empty: [],
          extra: [],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
  };
  const out = renderText(input);
  assert.ok(!out.includes('no keys'));
});

test('renderText reports no-pairs files when skipNoPairs is false', () => {
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 5,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: true,
          parsed: {
            entries: [],
            map: new Map(),
            duplicates: [],
            comments: new Map([['# c', 'comment']]),
          },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: false,
          missing: [],
          empty: [],
          extra: [],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
    stats: { missing: 0, empty: 0, typo: 0, extra: 0, dup: 0, interpolated: 0, other: 1 },
  };
  const out = renderText(input);
  assert.ok(out.includes('no keys'));
});

test('renderText reports report.empty issues', () => {
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: false,
          missing: [],
          empty: [{ key: 'FOO', line: 1 }],
          extra: [],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
    stats: { missing: 0, empty: 1, typo: 0, extra: 0, dup: 0, interpolated: 0, other: 0 },
  };
  const out = renderText(input);
  assert.ok(out.includes('empty'));
});

test('renderJson reveals raw values when reveal is true', () => {
  const map = new Map();
  map.set('SECRET', { key: 'SECRET', value: 'hunter2' });
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: true,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 7,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map, duplicates: [], comments: new Map() },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: false,
          missing: [],
          empty: [],
          extra: [{ key: 'SECRET', line: 1 }],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
  };
  const out = renderJson(input);
  const parsed = JSON.parse(out);
  assert.equal(parsed.files[0].extra[0].value, 'hunter2');
});

test('renderJson masks values when reveal is false', () => {
  const map = new Map();
  map.set('SECRET', { key: 'SECRET', value: 'hunter2' });
  const input: any = {
    root: '/test',
    schemaRel: '.env.example',
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 7,
          rel: '.env',
          abs: '/test/.env',
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map, duplicates: [], comments: new Map() },
        },
        report: {
          path: '/test/.env',
          rel: '.env',
          ok: false,
          missing: [],
          empty: [],
          extra: [{ key: 'SECRET', line: 1 }],
          typos: [],
          duplicates: [],
          interpolated: [],
        },
      },
    ],
  };
  const out = renderJson(input);
  const parsed = JSON.parse(out);
  assert.ok(parsed.files[0].extra[0].value !== 'hunter2');
});
