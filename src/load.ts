import { readFileSync, statSync } from "node:fs";
import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";
import { isBinary, parseEnv, type ParseResult } from "./parse.ts";

export interface LoadedEnv {
  rel: string;
  abs: string;
  bytes: number;
  emptyFile: boolean;
  noPairs: boolean;
  parsed: ParseResult;
}

export function loadEnvFile(abs: string, rel: string): LoadedEnv {
  let buf: Buffer;
  try {
    buf = readFileSync(abs);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      throw new EnvcheckError(
        Exit.Unreadable,
        `Permission denied reading ${rel}.`,
        `open returned ${code}. envcheck will not skip a file it was asked to check.`,
        `chmod u+r ${rel} && envcheck check`,
      );
    }
    if (code === "ENOENT") {
      throw new EnvcheckError(
        Exit.NotFound,
        `${rel} disappeared during the scan.`,
        "The file was listed, then unlinked before it could be read.",
        "Re-run envcheck check",
      );
    }
    throw new EnvcheckError(
      Exit.Unreadable,
      `Could not read ${rel}.`,
      (err as Error).message,
      "Re-run envcheck check --verbose if this keeps happening.",
    );
  }

  if (buf.length === 0) {
    return {
      rel,
      abs,
      bytes: 0,
      emptyFile: true,
      noPairs: true,
      parsed: { entries: [], map: new Map(), duplicates: [], comments: new Map() },
    };
  }

  if (isBinary(buf)) {
    throw new EnvcheckError(
      Exit.Unreadable,
      `${rel} is not valid UTF-8 text.`,
      "A NUL byte was found in the first 8KB, which means this is binary data, not an env file.",
      `file ${rel}    # confirm, then remove it from the scan with .envcheckignore`,
    );
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    throw new EnvcheckError(
      Exit.Unreadable,
      `${rel} is not valid UTF-8.`,
      "The bytes do not decode as UTF-8. envcheck refuses to guess an encoding for a file full of secrets.",
      `iconv -f latin1 -t utf-8 ${rel} > ${rel}.utf8 && mv ${rel}.utf8 ${rel}`,
    );
  }

  const parsed = parseEnv(text, rel);
  return {
    rel,
    abs,
    bytes: buf.length,
    emptyFile: false,
    noPairs: parsed.entries.length === 0,
    parsed,
  };
}

export function fileMtime(abs: string): number {
  return statSync(abs).mtimeMs;
}
