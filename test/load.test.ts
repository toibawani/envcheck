import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFile } from "../src/load.ts";

test("loadEnvFile parses a basic env file", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "A=1\nB=2\n", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    assert.strictEqual(loaded.bytes, 8);
    assert.strictEqual(loaded.parsed.entries.length, 2);
    assert.ok(!loaded.emptyFile);
    assert.ok(!loaded.noPairs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile reports an empty file", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    assert.ok(loaded.emptyFile);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile reports comments-only as noPairs", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "# comment\n# another\n", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    assert.ok(loaded.noPairs);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile preserves quoted values", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), 'A="hello world"\n', "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    const a = loaded.parsed.map.get("A");
    assert.ok(a);
    assert.strictEqual(a.value, "hello world");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile loads keys as a map", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "A=1\nB=2\n", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    assert.ok(loaded.parsed.map.has("A"));
    assert.ok(loaded.parsed.map.has("B"));
    assert.ok(!loaded.parsed.map.has("C"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile handles keys with equals signs in values", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "A=1=2=3\n", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    const a = loaded.parsed.map.get("A");
    assert.ok(a);
    assert.strictEqual(a.value, "1=2=3");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile handles export prefix", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "export EXPORTED=1\n", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    const a = loaded.parsed.map.get("EXPORTED");
    assert.ok(a);
    assert.ok(a.exported);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadEnvFile handles inline comments", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-load-"));
  try {
    writeFileSync(join(dir, ".env"), "A=1 # inline comment\n", "utf8");
    const loaded = loadEnvFile(join(dir, ".env"), ".env");
    const a = loaded.parsed.map.get("A");
    assert.ok(a);
    assert.strictEqual(a.comment, "inline comment");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
