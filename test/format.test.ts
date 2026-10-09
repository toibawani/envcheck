import { test } from "node:test";
import assert from "node:assert/strict";
import { renderText, renderJson } from "../src/format.ts";

test("renderText shows ok for matching files", () => {
  const input = {
    root: "/test",
    schemaRel: ".env.example",
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map() },
        },
        report: {
          path: ".env",
          rel: ".env",
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
  } as Parameters<typeof renderText>[0];
  const text = renderText(input);
  assert.ok(text.includes("ok"));
  assert.ok(text.includes(".env"));
});

test("renderText shows issues for drift", () => {
  const input = {
    root: "/test",
    schemaRel: ".env.example",
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map() },
        },
        report: {
          path: ".env",
          rel: ".env",
          ok: false,
          missing: ["MISSING_KEY"],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as Parameters<typeof renderText>[0];
  const text = renderText(input);
  assert.ok(text.includes("missing"));
  assert.ok(text.includes("MISSING_KEY"));
});

test("renderText shows stats when provided", () => {
  const input = {
    root: "/test",
    schemaRel: ".env.example",
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    stats: { missing: 1, empty: 0, typo: 0, extra: 0, dup: 0, interpolated: 0, other: 0 },
    files: [
      {
        loaded: {
          bytes: 4,
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map() },
        },
        report: {
          path: ".env",
          rel: ".env",
          ok: false,
          missing: ["MISSING_KEY"],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as Parameters<typeof renderText>[0];
  const text = renderText(input);
  assert.ok(text.includes("1 missing"));
});

test("renderJson returns valid JSON with summary", () => {
  const input = {
    root: "/test",
    schemaRel: ".env.example",
    reveal: false,
    skipEmpty: false,
    skipNoPairs: false,
    files: [
      {
        loaded: {
          bytes: 4,
          emptyFile: false,
          noPairs: false,
          parsed: { entries: [], map: new Map() },
        },
        report: {
          path: ".env",
          rel: ".env",
          ok: false,
          missing: ["MISSING_KEY"],
          empty: [],
          extra: [],
          typos: [],
          interpolated: [],
          duplicates: [],
        },
      },
    ],
  } as Parameters<typeof renderJson>[0];
  const json = JSON.parse(renderJson(input));
  assert.ok(json.summary);
  assert.strictEqual(json.summary.missing, 1);
  assert.strictEqual(json.ok, false);
});
