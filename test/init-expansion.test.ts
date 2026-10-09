import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init.ts";

test("init writes keys sorted without secret values", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-init-"));
  try {
    writeFileSync(join(dir, ".env"), "ZEBRA=z\nALPHA=a\nMID=secret\n", "utf8");
    const outcome = runInit({
      cwd: dir,
      schema: ".env.example",
      ignore: [],
      force: false,
      dryRun: false,
    });
    assert.strictEqual(outcome.exitCode, 0);
    const content = readFileSync(join(dir, ".env.example"), "utf8");
    const keys = content
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => line.split("=")[0]);
    assert.deepStrictEqual(keys, ["ALPHA", "MID", "ZEBRA"]);
    assert.ok(!content.includes("secret"));
    assert.ok(!content.includes("=z"));
    assert.ok(!content.includes("=a"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("init respects --force to overwrite existing schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-init-"));
  try {
    writeFileSync(join(dir, ".env.example"), "OLD=1\n", "utf8");
    writeFileSync(join(dir, ".env"), "NEW=2\n", "utf8");
    assert.throws(() => {
      runInit({ cwd: dir, schema: ".env.example", ignore: [], force: false,
      dryRun: false });    });
    const outcome = runInit({ cwd: dir, schema: ".env.example", ignore: [], force: true,
      dryRun: false });
    assert.strictEqual(outcome.exitCode, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
