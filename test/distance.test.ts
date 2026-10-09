import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestKey } from "../src/distance.ts";

test("suggestKey returns the same key when there is an exact match", () => {
  const keys = ["DATABASE_URL", "API_KEY", "REDIS_URL"];
  assert.strictEqual(suggestKey("DATABASE_URL", keys), "DATABASE_URL");
});

test("suggestKey finds the closest match within maxDistance", () => {
  const keys = ["DATABASE_URL", "API_KEY", "REDIS_URL"];
  assert.strictEqual(suggestKey("DATBASE_URL", keys), "DATABASE_URL");
});

test("suggestKey returns undefined when no match within maxDistance", () => {
  const keys = ["DATABASE_URL", "API_KEY"];
  assert.strictEqual(suggestKey("ZOMGWHAT", keys, 3), undefined);
});

test("suggestKey prefers shorter distance", () => {
  const keys = ["API_KEY", "APP_KEY"];
  assert.strictEqual(suggestKey("APIKEY", keys), "API_KEY");
});

test("suggestKey handles single-character keys", () => {
  const keys = ["A", "B", "C"];
  const suggestion = suggestKey("X", keys, 3);
  assert.ok(["A", "B", "C"].includes(suggestion));
});
