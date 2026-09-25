import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseIgnore, isIgnored } from "../src/gitignore.ts";
import { scanEnvFiles } from "../src/scan.ts";

test("gitignore patterns", () => {
  const rules = parseIgnore("# c\n.env\n!.env.example\nsecrets/\n*.local\n");
  assert.equal(isIgnored(".env", false, rules), true);
  assert.equal(isIgnored(".env.example", false, rules), false);
  assert.equal(isIgnored("secrets/keys.env", false, rules), true);
  assert.equal(isIgnored(".env.local", false, rules), true);
  assert.equal(isIgnored("app/.env", false, rules), true);
});

test("scan honors gitignore, envcheckignore, and does not loop on symlink cycles", () => {
  const root = mkdtempSync(join(tmpdir(), "envcheck-"));
  try {
    writeFileSync(join(root, ".gitignore"), ".env\n!.env.example\n");
    writeFileSync(join(root, ".envcheckignore"), ".env.private\n");
    writeFileSync(join(root, ".env.example"), "A=1\n");
    writeFileSync(join(root, ".env"), "A=secret\n");
    writeFileSync(join(root, ".env.private"), "A=hidden\n");
    writeFileSync(join(root, ".env.development"), "A=\n");
    mkdirSync(join(root, "loop"));
    try {
      symlinkSync(root, join(root, "loop", "back"));
    } catch {
      // some sandboxes refuse symlinks; the rest of the assertion still holds
    }
    const found = scanEnvFiles({ root, extraIgnore: [] }).map((f) => f.name).sort();
    assert.deepEqual(found, [".env.development", ".env.example"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
