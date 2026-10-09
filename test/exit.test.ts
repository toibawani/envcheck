import { test } from "node:test";
import assert from "node:assert/strict";
import { Exit, EXIT_TABLE, formatExitTable } from "../src/exit.ts";

test("EXIT_TABLE covers every Exit value once", () => {
  const codes = EXIT_TABLE.map((r) => r.code);
  const values = Object.values(Exit);
  assert.deepEqual([...codes].sort(), [...values].sort());
  assert.equal(new Set(codes).size, codes.length);
});

test("formatExitTable lists each code", () => {
  const text = formatExitTable();
  for (const row of EXIT_TABLE) {
    assert.match(text, new RegExp(String(row.code)));
  }
});
