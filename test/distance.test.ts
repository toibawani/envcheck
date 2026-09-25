import { test } from "node:test";
import assert from "node:assert/strict";
import { levenshtein, suggestKey } from "../src/distance.ts";

test("levenshtein basics", () => {
  assert.equal(levenshtein("DATABASE_URL", "DATABASE_URL"), 0);
  assert.equal(levenshtein("DATBASE_URL", "DATABASE_URL"), 1);
  assert.equal(levenshtein("kitten", "sitting"), 3);
  assert.equal(levenshtein("", "abc"), 3);
});

test("suggests the closest schema key", () => {
  const schema = ["DATABASE_URL", "REDIS_URL", "PORT"];
  assert.equal(suggestKey("DATBASE_URL", schema, 3), "DATABASE_URL");
  assert.equal(suggestKey("PORT", schema, 3), undefined);
  assert.equal(suggestKey("COMPLETELY_DIFFERENT", schema, 3), undefined);
});

test("cap stops runaway distance", () => {
  assert.ok(levenshtein("aaaa", "bbbbbbbbbbbb", 2) > 2);
});
