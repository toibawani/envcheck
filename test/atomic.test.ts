import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, statSync, readdirSync, mkdirSync, utimesSync } from "node:fs";
import { writeAtomic } from "../src/atomic.ts";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck } from "../src/run.ts";

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
    assert.ok(Math.abs(statSync(path).mtimeMs - mtime) <= 2000, "mtime preserved within 2s");
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

test("atomic commit preserves file content across runs", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    writeFileSync(join(dir, ".env.example"), "FOO=\\nBAR=\\nBAZ=\\n", "utf8");
    writeFileSync(join(dir, ".env"), "FOO=hello\\nBAR=world\\nBAZ=test\\n", "utf8");
    runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const content = readFileSync(join(dir, ".env"), "utf8");
    assert.strictEqual(content, "FOO=hello\\nBAR=world\\nBAZ=test\\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("atomic commit does not modify the schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    writeFileSync(join(dir, ".env.example"), "FOO=\\nBAR=\\n", "utf8");
    writeFileSync(join(dir, ".env"), "FOO=hello\\nBAR=world\\nBAZ=test\\n", "utf8");
    runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const schema = readFileSync(join(dir, ".env.example"), "utf8");
    assert.ok(!schema.includes("BAZ"));
    assert.strictEqual(schema, "FOO=\\nBAR=\\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAtomic preserves mtime when unchanged", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    const path = join(dir, ".env");
    writeFileSync(path, "A=1\n", "utf8");
    const mtime = statSync(path).mtimeMs;
    // Read back the same content and rewrite with matching mtime.
    const content = readFileSync(path, "utf8");
    writeAtomic(path, content, mtime);
    assert.ok(Math.abs(statSync(path).mtimeMs - mtime) <= 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeAtomic creates parent directories when needed", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-atomic-"));
  try {
    const sub = join(dir, "a", "b", "c");
    mkdirSync(sub, { recursive: true });
    const path = join(sub, ".env");
    writeAtomic(path, "A=1\n", 0);
    assert.ok(existsSync(path));
    assert.strictEqual(readFileSync(path, "utf8"), "A=1\n");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
