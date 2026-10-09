import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCheck } from "../src/run.ts";
import { Exit } from "../src/exit.ts";

test("runCheck returns Exit.Ok when files match schema", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-run-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\nB=2\n", "utf8");
    writeFileSync(join(dir, ".env"), "A=1\nB=2\n", "utf8");
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.strictEqual(outcome.exitCode, Exit.Ok);
    assert.ok(outcome.text.includes("ok"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runCheck returns Exit.Drift when schema mismatches", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-run-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\nB=2\n", "utf8");
    writeFileSync(join(dir, ".env"), "A=1\n", "utf8");
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.strictEqual(outcome.exitCode, Exit.Drift);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runCheck uses custom schema path", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-run-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\n", "utf8");
    writeFileSync(join(dir, ".contract"), "A=1\nB=2\n", "utf8");
    writeFileSync(join(dir, ".env"), "A=1\nB=2\n", "utf8");
    const outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      schema: ".contract",
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.strictEqual(outcome.exitCode, Exit.Ok);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runCheck respects maxDistance typo cutoff", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-run-"));
  try {
    writeFileSync(join(dir, ".env.example"), "DATABASE_URL=\n", "utf8");
    writeFileSync(join(dir, ".env"), "XATBASE_URL=\n", "utf8");
    let outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      maxDistance: 3,
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(outcome.text.includes("typo"));
    outcome = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      maxDistance: 1,
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(!outcome.text.includes("typo"));
    assert.ok(outcome.text.includes("extra"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runCheck reveals extra values with --reveal", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-run-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\n", "utf8");
    writeFileSync(join(dir, ".env"), "A=1\nSECRET=supersecret123\n", "utf8");
    const noReveal = runCheck({
      cwd: dir,
      json: false,
      reveal: false,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const reveal = runCheck({
      cwd: dir,
      json: false,
      reveal: true,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    assert.ok(noReveal.text.includes("su…23"));
    assert.ok(!reveal.text.includes("su…23"));
    assert.ok(reveal.text.includes("supersecret123"));
    assert.ok(!noReveal.text.includes("supersecret123"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("runCheck JSON summary includes counts", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-run-"));
  try {
    writeFileSync(join(dir, ".env.example"), "A=1\nB=2\n", "utf8");
    writeFileSync(join(dir, ".env"), "A=1\n", "utf8");
    const outcome = runCheck({
      cwd: dir,
      json: true,
      reveal: true,
      ignore: [],
      stats: false,
      skipEmpty: false,
      skipNoPairs: false,
    });
    const json = JSON.parse(outcome.text);
    assert.ok(!json.ok);
    assert.strictEqual(json.summary.missing, 1);
    assert.strictEqual(json.issueCount, 1);
    assert.ok(json.files[0].missing.includes("B"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
