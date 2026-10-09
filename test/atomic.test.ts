import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync, mkdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeAtomic } from "../src/atomic.ts";

test("writeAtomic creates file with correct content", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    const path = join(dir, "test.env");
    writeAtomic(path, "KEY=value\n", undefined);
    const content = readFileSync(path, "utf8");
    assert.equal(content, "KEY=value\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAtomic creates nested parent directories implicitly via rename", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    const path = join(dir, "nested", "deep", "file.env");
    mkdirSync(join(dir, "nested", "deep"), { recursive: true });
    writeAtomic(path, "A=1\n", undefined);
    assert.equal(readFileSync(path, "utf8"), "A=1\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAtomic preserves existing file mtime when expectedMtime is provided", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    const path = join(dir, "test.env");
    writeFileSync(path, "OLD=value\n", "utf8");
    const mtime = statSync(path).mtimeMs;
    writeAtomic(path, "NEW=value\n", mtime);
    assert.ok(Math.abs(statSync(path).mtimeMs - mtime) <= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAtomic leaves no stray temp files behind", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    const path = join(dir, "test.env");
    writeAtomic(path, "A=1\n", undefined);
    assert.equal(readFileSync(path, "utf8"), "A=1\n");
    const entries = readdirSync(dir);
    assert.equal(entries.length, 1);
    assert.equal(entries[0], "test.env");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
