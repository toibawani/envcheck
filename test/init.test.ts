import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInit } from "../src/init.ts";

test("init writes sorted keys without secret values", () => {
  const dir = mkdtempSync(join(tmpdir(), "envcheck-init-"));
  try {
    writeFileSync(join(dir, ".env"), "ZEBRA=secret1\nALPHA=secret2\n# redis host\nREDIS_URL=redis://x\n");
    const out = runInit({ cwd: dir, ignore: [], force: false });
    assert.equal(out.exitCode, 0);
    const example = readFileSync(join(dir, ".env.example"), "utf8");
    assert.match(example, /^ALPHA=$/m);
    assert.match(example, /^REDIS_URL=$/m);
    assert.match(example, /^ZEBRA=$/m);
    assert.doesNotMatch(example, /secret/);
    // sorted
    const keys = example.split("\n").filter((l) => /^[A-Z_]+=$/.test(l));
    assert.deepEqual(keys, ["ALPHA=", "REDIS_URL=", "ZEBRA="]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
