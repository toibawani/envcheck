import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDoctor } from "../src/doctor.ts";

test("doctor reports version and node version", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-doc-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\n", "utf8");
    const outcome = runDoctor({ cwd: dir, schema: undefined, ignore: [] });
    assert.ok(outcome.text.includes("envcheck doctor"));
    assert.ok(outcome.text.match(/version \d/));
    assert.ok(outcome.text.match(/node v/));
    assert.ok(outcome.exitCode === 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("doctor reports schema of record when present", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-doc-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\nB=2\n", "utf8");
    const outcome = runDoctor({ cwd: dir, schema: undefined, ignore: [] });
    assert.ok(outcome.text.includes("Schema of record found: .env.example"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("doctor returns not found when no schema exists", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-doc-"));
  try {
    const outcome = runDoctor({ cwd: dir, schema: undefined, ignore: [] });
    assert.ok(outcome.text.includes("No .env.example schema found"));
    assert.ok(outcome.exitCode === 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("doctor shows configuration line", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-doc-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\n", "utf8");
    const outcome = runDoctor({ cwd: dir, schema: undefined, ignore: [] });
    assert.ok(outcome.text.includes("config"));
    assert.ok(outcome.text.includes("maxDistance"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
