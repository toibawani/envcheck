import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EnvcheckError,
  SchemaNotFound,
  ReadError,
  LockError,
  ConfigError,
  InterruptedError,
  isEnvcheckError,
} from "../src/errors.ts";
import { Exit } from "../src/exit.ts";

test("EnvcheckError carries exitCode and structured fields", () => {
  const err = new EnvcheckError(Exit.Drift, "drift", "keys differ", "envcheck check");
  assert.equal(err.exitCode, Exit.Drift);
  assert.equal(err.name, "EnvcheckError");
  assert.equal(err.message, "drift");
  assert.equal(err.what, "drift");
  assert.equal(err.why, "keys differ");
  assert.equal(err.fix, "envcheck check");
  assert.ok(isEnvcheckError(err));
});

test("isEnvcheckError rejects plain errors", () => {
  assert.equal(isEnvcheckError(new Error("boom")), false);
  assert.equal(isEnvcheckError(null as unknown as unknown), false);
});

test("SchemaNotFound -> NotFound with helpful fix", () => {
  const err = new SchemaNotFound(".env.example");
  assert.equal(err.exitCode, Exit.NotFound);
  assert.ok(err.message.includes(".env.example"));
  assert.equal(err.fix, "envcheck init    # seed a schema from your existing .env files");
});

test("ReadError -> Unreadable with cause and hint", () => {
  const err = new ReadError("secrets.env", "EACCES", "chmod u+r secrets.env && try again");
  assert.equal(err.exitCode, Exit.Unreadable);
  assert.ok(err.message.includes("secrets.env"));
});

test("LockError -> Locked with retry hint", () => {
  const err = new LockError(".env", "rename collided with a concurrently written file");
  assert.equal(err.exitCode, Exit.Locked);
  assert.ok(err.message.includes(".env"));
});

test("ConfigError -> Config with jsonlint hint", () => {
  const err = new ConfigError(".envcheckrc", "Unexpected token '}' at line 4");
  assert.equal(err.exitCode, Exit.Config);
  assert.ok(err.message.includes(".envcheckrc"));
  assert.ok(err.fix.includes("jsonlint"));
});

test("InterruptedError -> Interrupted, no partial write", () => {
  const err = new InterruptedError();
  assert.equal(err.exitCode, Exit.Interrupted);
  assert.equal(err.why, "No changes were written.");
});

test("typed subclasses are also EnvcheckError", () => {
  const errs = [
    new SchemaNotFound("x"),
    new ReadError("y", "z", "h"),
    new LockError("y", "z"),
    new ConfigError("x", "z"),
    new InterruptedError(),
  ];
  for (const err of errs) {
    assert.ok(err instanceof EnvcheckError, `${err.constructor.name} should be EnvcheckError`);
    assert.ok(isEnvcheckError(err));
    assert.ok(err.stack, `${err.constructor.name} should have a stack trace`);
  }
});
