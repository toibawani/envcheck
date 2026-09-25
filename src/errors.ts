import type { ExitCode } from "./exit.ts";

/** Every user-facing failure carries what, why, and the next command. */
export class EnvcheckError extends Error {
  readonly exitCode: ExitCode;
  readonly what: string;
  readonly why: string;
  readonly fix: string;

  constructor(exitCode: ExitCode, what: string, why: string, fix: string) {
    super(what);
    this.name = "EnvcheckError";
    this.exitCode = exitCode;
    this.what = what;
    this.why = why;
    this.fix = fix;
  }
}

export function isEnvcheckError(err: unknown): err is EnvcheckError {
  return err instanceof EnvcheckError;
}
