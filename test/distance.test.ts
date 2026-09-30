import { test } from "node:test";
import assert from "node:assert/strict";
import { levenshtein, suggestKey } from "../src/distance.ts";

test("levenshtein basics", () => {
  assert.equal(levenshtein("a", "a"), 0);
  assert.equal(levenshtein("DATBASE_URL", "DATABASE_URL"), 1);
  assert.equal(levenshtein("", "abc"), 3);
});

test("suggests the closest schema key", () => {
  assert.equal(suggestKey("DATBASE_URL", ["DATABASE_URL", "REDIS_URL", "API_KEY"], 3), "DATABASE_URL");
});

test("STRIPE_SECERT maps to STRIPE_SECRET", () => {
  assert.equal(suggestKey("STRIPE_SECERT", ["STRIPE_SECRET", "STRIPE_KEY"], 3), "STRIPE_SECRET");
});

test("cap stops runaway distance", () => {
  assert.ok(levenshtein("a".repeat(40), "b".repeat(40), 3) > 3);
});

test("ignores schema keys shorter than 4 chars", () => {
  assert.equal(suggestKey("AB", ["ABC", "ABCD"], 3), "ABCD");
});

test("false positive: unrelated long key is not suggested", () => {
  assert.equal(suggestKey("COMPLETELY_OTHER", ["DATABASE_URL"], 2), undefined);
});
