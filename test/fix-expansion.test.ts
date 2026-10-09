import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteIfNeeded,
  renameKey,
  removeKey,
  previewDiff,
} from "../src/fix.ts";

test("quoteIfNeeded quotes values with spaces", () => {
  assert.strictEqual(quoteIfNeeded("hello world"), "\"hello world\"");
});

test("quoteIfNeeded leaves simple values unquoted", () => {
  assert.strictEqual(quoteIfNeeded("simplevalue"), "simplevalue");
});

test("renameKey renames a key in a line", () => {
  const text = "DATABASE_URL=postgres://localhost";
  assert.strictEqual(renameKey(text, "DATABASE_URL", "DB_URL"), "DB_URL=postgres://localhost");
});

test("removeKey removes a key line", () => {
  const text = "OLD_KEY=old\nNEW_KEY=new\n";
  assert.strictEqual(removeKey(text, "OLD_KEY"), "NEW_KEY=new\n");
});

test("removeKey handles export prefix", () => {
  const text = "export OLD_KEY=old\nNEW_KEY=new\n";
  assert.strictEqual(removeKey(text, "OLD_KEY"), "NEW_KEY=new\n");
});

test("previewDiff shows a unified diff", () => {
  const before = "A=1\nB=2\n";
  const after = "A=1\nC=3\n";
  const diff = previewDiff(before, after);
  assert.ok(diff.includes("- B=2"));
  assert.ok(diff.includes("+ C=3"));
});

test("previewDiff is empty when before equals after", () => {
  const text = "A=1\nB=2\n";
  const diff = previewDiff(text, text);
  assert.ok(diff.includes("(no textual change)"));
});
