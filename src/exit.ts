/**
 * Exit codes are part of the public contract. CI scripts can branch on them.
 *
 * 0  clean — schema matches every scanned file
 * 1  drift — missing, empty, extra, or typo'd keys
 * 2  usage — bad flags, missing required argument, non-interactive `fix`
 * 3  not found — no .env files, or no schema
 * 4  unreadable — permission denied, binary, or malformed syntax
 * 5  config — .envcheckrc is not valid JSON
 * 6  interrupted — SIGINT; in-flight reads aborted, no partial write left behind
 * 7  locked — target file changed under us, or the lock was already held
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
