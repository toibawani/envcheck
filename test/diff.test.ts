import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/parse.ts";
import { diffFile } from "../src/diff.ts";

test("missing, empty, extra, typo", () => {
  const schema = parseEnv("DATABASE_URL=postgres://local\nPORT=3000\nSECRET=\n", "schema");
  const file = parseEnv("DATBASE_URL=postgres://local\nPORT=\nEXTRA=1\n", ".env");
  const report = diffFile(".env", file, schema, 3);
  assert.deepEqual(report.missing, ["DATABASE_URL", "SECRET"]);
  assert.deepEqual(report.empty.map((e) => e.key), ["PORT"]);
  assert.equal(report.typos[0]?.key, "DATBASE_URL");
  assert.equal(report.typos[0]?.suggestion, "DATABASE_URL");
  assert.deepEqual(report.extra.map((e) => e.key), ["EXTRA"]);
  assert.equal(report.ok, false);
});
