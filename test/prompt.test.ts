import { test } from "node:test";
import assert from "node:assert/strict";
import { Stream } from "node:stream";
import { assertInteractive } from "../src/prompt.ts";
import { EnvcheckError } from "../src/errors.ts";
import { Exit } from "../src/exit.ts";

test("assertInteractive throws when stdin is not a TTY", () => {
  const stdin = new Stream.Readable({ read() {} });
  Object.defineProperty(stdin, 'isTTY', { value: false, writable: true });
  const stdout = new Stream.Writable({ write() {} });
  Object.defineProperty(stdout, 'isTTY', { value: false, writable: true });
  const oldStdin = process.stdin;
  const oldStdout = process.stdout;
  try {
    Object.defineProperty(process, "stdin", { value: stdin, writable: true });
    Object.defineProperty(process, "stdout", { value: stdout, writable: true });
    assert.throws(
      () => assertInteractive(),
      (err: unknown) => {
        assert(err instanceof EnvcheckError);
        assert.strictEqual((err as EnvcheckError).exitCode, Exit.Usage);
        return true;
      },
    );
  } finally {
    process.stdin = oldStdin;
    process.stdout = oldStdout;
  }
});
