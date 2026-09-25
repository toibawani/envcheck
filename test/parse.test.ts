import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv } from "../src/parse.ts";
import { EnvcheckError } from "../src/errors.ts";

test("quoted, export, comments, empty lines", () => {
  const src = `
# database url
export DATABASE_URL="postgres://localhost/app"
EMPTY=
# just a comment

QUOTED='say "hi"'
INLINE=value # note
`;
  const parsed = parseEnv(src, ".env");
  assert.equal(parsed.map.get("DATABASE_URL")?.value, "postgres://localhost/app");
  assert.equal(parsed.map.get("DATABASE_URL")?.exported, true);
  assert.equal(parsed.map.get("DATABASE_URL")?.comment, "database url");
  assert.equal(parsed.map.get("EMPTY")?.empty, true);
  assert.equal(parsed.map.get("QUOTED")?.value, 'say "hi"');
  assert.equal(parsed.map.get("INLINE")?.value, "value");
  assert.equal(parsed.map.get("INLINE")?.comment, "note");
});

test("double-quote escapes and interpolation flag", () => {
  const parsed = parseEnv('MSG="hello\\nworld"\nURL=${HOST}/v1\nLITERAL=\'${HOST}\'\n', "t.env");
  assert.equal(parsed.map.get("MSG")?.value, "hello\nworld");
  assert.equal(parsed.map.get("URL")?.interpolated, true);
  assert.deepEqual(parsed.map.get("URL")?.interpolations, ["HOST"]);
  assert.equal(parsed.map.get("LITERAL")?.interpolated, false);
  assert.equal(parsed.map.get("LITERAL")?.value, "${HOST}");
});

test("multiline backslash continuation", () => {
  const parsed = parseEnv("CERT=-----BEGIN-----\\\nABCDEF\n", "t.env");
  assert.equal(parsed.map.get("CERT")?.value, "-----BEGIN-----\nABCDEF");
});

test("unterminated quote", () => {
  assert.throws(() => parseEnv('BROKEN="oops\n', "t.env"), (err: unknown) => {
    assert.ok(err instanceof EnvcheckError);
    assert.match(err.what, /unterminated/);
    assert.match(err.fix, /Close the quote/);
    return true;
  });
});

test("invalid key characters", () => {
  assert.throws(() => parseEnv("MY-KEY=1\n", "t.env"), (err: unknown) => {
    assert.ok(err instanceof EnvcheckError);
    assert.match(err.what, /invalid key/);
    return true;
  });
});

test("not an assignment", () => {
  assert.throws(() => parseEnv("just words\n", "t.env"), (err: unknown) => {
    assert.ok(err instanceof EnvcheckError);
    assert.match(err.what, /not a KEY=VALUE/);
    return true;
  });
});

test("NUL byte rejected", () => {
  assert.throws(() => parseEnv("A=1\u0000\n", "t.env"), (err: unknown) => {
    assert.ok(err instanceof EnvcheckError);
    assert.match(err.why, /NUL/);
    return true;
  });
});

test("duplicate keys, later wins", () => {
  const parsed = parseEnv("A=1\nA=2\n", "t.env");
  assert.equal(parsed.map.get("A")?.value, "2");
  assert.deepEqual(parsed.duplicates, ["A"]);
});

test("empty file vs comments-only", () => {
  const empty = parseEnv("", "t.env");
  assert.equal(empty.entries.length, 0);
  const comments = parseEnv("# only\n\n# still\n", "t.env");
  assert.equal(comments.entries.length, 0);
});
