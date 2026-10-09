import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteIfNeeded, renameKey, removeKey, previewDiff } from "../src/fix.ts";

test("quoteIfNeeded quotes values needing quotes", () => {
  assert.equal(quoteIfNeeded("simple"), "simple");
  assert.equal(quoteIfNeeded(""), "");
  assert.equal(quoteIfNeeded("with space"), "\"with space\"");
  assert.equal(quoteIfNeeded("a#b"), "\"a#b\"");
  assert.equal(quoteIfNeeded("a'b"), "\"a'b\"");
  assert.equal(quoteIfNeeded("a\"b"), "\"a\\\"b\"");
  assert.equal(quoteIfNeeded("a\\b"), "\"a\\\\b\"");
  assert.equal(quoteIfNeeded("a$b"), "\"a$b\"");
  assert.equal(quoteIfNeeded("a#b=c"), "\"a#b=c\"");
});

test("renameKey renames a key preserving formatting", () => {
  const text = `DATABASE_URL=postgres\n# comment\nexport API_KEY=secret\n`;
  assert.equal(renameKey(text, "DATABASE_URL", "DB_URL"), "DB_URL=postgres\n# comment\nexport API_KEY=secret\n");
  assert.equal(renameKey(text, "API_KEY", "APP_KEY"), "DATABASE_URL=postgres\n# comment\nexport APP_KEY=secret\n");
});

test("renameKey handles export prefix", () => {
  const text = `export DATABASE_URL=postgres\n`;
  assert.equal(renameKey(text, "DATABASE_URL", "DB_URL"), "export DB_URL=postgres\n");
});

test("removeKey removes a key from text", () => {
  const text = `DATABASE_URL=postgres\nPORT=3000\nEXTRA=1\n`;
  assert.equal(removeKey(text, "PORT"), "DATABASE_URL=postgres\nEXTRA=1\n");
  assert.equal(removeKey(text, "NONEXISTENT"), text);
});

test("removeKey handles export prefix", () => {
  const text = `export DATABASE_URL=postgres\n`;
  assert.equal(removeKey(text, "DATABASE_URL"), "");
});

test("previewDiff shows added and removed lines", () => {
  const before = "A=1\nB=2\n";
  const after = "A=1\nB=3\nC=4\n";
  const diff = previewDiff(before, after);
  assert.ok(diff.includes("- B=2"));
  assert.ok(diff.includes("+ B=3"));
  assert.ok(diff.includes("+ C=4"));
});

test("previewDiff shows no change", () => {
  const before = "A=1\nB=2\n";
  const after = "A=1\nB=2\n";
  const diff = previewDiff(before, after);
  assert.ok(diff.includes("(no textual change)"));
});
