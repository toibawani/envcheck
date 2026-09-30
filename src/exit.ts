/**
 * Exit codes are part of the public contract. CI scripts can branch on them.
 * about renders EXIT_TABLE so the docs cannot drift from the code.
 */
export const Exit = {
  Ok: 0,
  Drift: 1,
  Usage: 2,
  NotFound: 3,
  Unreadable: 4,
  Config: 5,
  Interrupted: 6,
  Locked: 7,
} as const;

export type ExitCode = (typeof Exit)[keyof typeof Exit];

export const EXIT_TABLE: ReadonlyArray<{ code: ExitCode; label: string }> = [
  { code: Exit.Ok, label: "clean — every scanned file matches the schema" },
  { code: Exit.Drift, label: "drift — missing, empty, extra, typo, or dup keys" },
  { code: Exit.Usage, label: "usage — bad flags, or fix with no TTY" },
  { code: Exit.NotFound, label: "not found — no .env files, or no schema" },
  { code: Exit.Unreadable, label: "unreadable — permission, binary, or bad syntax" },
  { code: Exit.Config, label: "config — .envcheckrc is not valid JSON" },
  { code: Exit.Interrupted, label: "interrupted — SIGINT; no partial write left" },
  { code: Exit.Locked, label: "locked — target changed under us, or busy" },
];

export function formatExitTable(): string {
  return EXIT_TABLE.map((row) => `  ${row.code}  ${row.label}`).join("\n");
}
