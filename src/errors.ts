import { Exit } from "./exit.ts";
import type { ExitCode } from "./exit.ts";

/** Base class for every user-facing failure. Carries what, why, and the next command. */
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

/** The schema of record was not found (no .env.example/.sample/.template in scope). */
export class SchemaNotFound extends EnvcheckError {
  constructor(file: string) {
    super(
      Exit.NotFound,
      `Schema not found: ${file}.`,
      `No contract file (${file}, .env.sample, or .env.template) was found in the scan directory.`,
      `envcheck init    # seed a schema from your existing .env files`,
    );
  }
}

/** A file could not be read (permission denied, binary, malformed UTF-8). */
export class ReadError extends EnvcheckError {
  constructor(rel: string, cause: string, hint: string) {
    super(Exit.Unreadable, `Could not read ${rel}.`, cause, hint);
  }
}

/** A file was locked or changed under us (EACCES on open, rename collision). */
export class LockError extends EnvcheckError {
  constructor(rel: string, cause: string) {
    super(
      Exit.Locked,
      `File locked: ${rel}.`,
      cause,
      `Close any editor or process holding ${rel} and run envcheck check again.`,
    );
  }
}

/** .envcheckrc could not be parsed (bad JSON or unknown keys). */
export class ConfigError extends EnvcheckError {
  constructor(configPath: string, what: string, why: string, fix: string) {
    super(Exit.Config, `Bad ${configPath}.`, what, fix);
  }
}

/** The run was interrupted (SIGINT); no partial write was left behind. */
export class InterruptedError extends EnvcheckError {
  constructor() {
    super(Exit.Interrupted, "Interrupted.", "No changes were written.", "envcheck check");
  }
}

export function isEnvcheckError(err: unknown): err is EnvcheckError {
  return err instanceof EnvcheckError;
}
