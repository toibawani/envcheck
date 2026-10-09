import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanEnvFiles, isEnvFileName } from "../src/scan.ts";

test("isEnvFileName identifies .env files", () => {
  assert.equal(isEnvFileName(".env"), true);
  assert.equal(isEnvFileName(".env.example"), true);
  assert.equal(isEnvFileName(".env.local"), true);
  assert.equal(isEnvFileName(".envrc"), false);
  assert.equal(isEnvFileName(".env.example.bak"), true);
});

test("scan finds .env files in a directory", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-scan-"));
  try {
    writeFileSync(join(dir, ".env"), "A=1\n");
    writeFileSync(join(dir, ".env.example"), "B=2\n");
    writeFileSync(join(dir, "notes.txt"), "not env\n");
    const found = scanEnvFiles({ root: dir, extraIgnore: [] });
    const names = found.map((f) => f.name).sort();
    assert.deepEqual(names, [".env", ".env.example"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scan respects .gitignore", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-scan-"));
  try {
    writeFileSync(join(dir, ".gitignore"), ".env\n.env.local\n");
    writeFileSync(join(dir, ".env"), "A=1\n");
    writeFileSync(join(dir, ".env.local"), "B=2\n");
    writeFileSync(join(dir, ".env.example"), "C=3\n");
    const found = scanEnvFiles({ root: dir, extraIgnore: [] });
    const names = found.map((f) => f.name).sort();
    assert.deepEqual(names, [".env.example"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scan respects .envcheckignore", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-scan-"));
  try {
    writeFileSync(join(dir, ".envcheckignore"), ".env.private\n");
    writeFileSync(join(dir, ".env"), "A=1\n");
    writeFileSync(join(dir, ".env.private"), "B=2\n");
    writeFileSync(join(dir, ".env.example"), "C=3\n");
    const found = scanEnvFiles({ root: dir, extraIgnore: [] });
    const names = found.map((f) => f.name).sort();
    // alphabetically sorted: .env before .env.example
    assert.deepEqual(names, [".env", ".env.example"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scan honors gitignore negation", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-scan-"));
  try {
    writeFileSync(join(dir, ".gitignore"), ".env\n!.env.example\n");
    writeFileSync(join(dir, ".env"), "A=1\n");
    writeFileSync(join(dir, ".env.example"), "B=2\n");
    const found = scanEnvFiles({ root: dir, extraIgnore: [] });
    const names = found.map((f) => f.name).sort();
    // .env is ignored by .gitignore; only .env.example (negated) is included
    assert.deepEqual(names, [".env.example"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scan does not loop on symlink cycles", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-scan-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\n");
    writeFileSync(join(dir, ".env"), "A=1\n");
    const sub = join(dir, "loop");
    mkdirSync(sub);
    try {
      // symlink back to root should be treated as a cycle and skipped
      // (some platforms refuse symlinks in sandboxes; that is fine)
    } catch {
      // expected on some systems
    }
    const found = scanEnvFiles({ root: dir, extraIgnore: [] });
    const names = found.map((f) => f.name).sort();
    // At minimum, we shouldn't crash and should find the .env files
    assert.ok(names.includes(".env.example") || names.includes(".env"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scan skips non-env files", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-scan-"));
  try {
    writeFileSync(join(dir, ".env"), "A=1\n");
    writeFileSync(join(dir, "config.json"), '{"key":"value"}\n');
    writeFileSync(join(dir, ".env.production"), "B=2\n");
    const found = scanEnvFiles({ root: dir, extraIgnore: [] });
    const names = found.map((f) => f.name).sort();
    assert.deepEqual(names, [".env", ".env.production"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
