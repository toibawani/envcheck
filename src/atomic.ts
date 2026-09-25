import { closeSync, openSync, writeSync, fsyncSync, renameSync, unlinkSync, statSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";
import { onAbort } from "./signals.ts";

export function writeAtomic(path: string, contents: string, expectedMtime: number | undefined): void {
  const dir = dirname(path);
  const tmp = join(dir, `.envcheck-${randomBytes(6).toString("hex")}.tmp`);
  const off = onAbort(() => {
    try {
      unlinkSync(tmp);
    } catch {
      // already gone
    }
  });

  let fd: number | undefined;
  try {
    if (expectedMtime !== undefined) {
      try {
        const cur = statSync(path).mtimeMs;
        if (Math.abs(cur - expectedMtime) > 1) {
          throw new EnvcheckError(
            Exit.Locked,
            `${path} changed while envcheck was preparing the write.`,
            `mtime was ${expectedMtime}, now ${cur}. Another process edited the file.`,
            `Re-run envcheck fix so the preview matches the file on disk.`,
          );
        }
      } catch (err) {
        if (err instanceof EnvcheckError) throw err;
      }
    }

    fd = openSync(tmp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    const buf = Buffer.from(contents, "utf8");
    writeSync(fd, buf);
    fsyncSync(fd);
    closeSync(fd);
    fd = undefined;
    renameSync(tmp, path);
  } catch (err) {
    if (fd !== undefined) {
      try {
        closeSync(fd);
      } catch {
        // ignore
      }
    }
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
    if (err instanceof EnvcheckError) throw err;
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM" || code === "EBUSY" || code === "ETXTBSY") {
      throw new EnvcheckError(
        Exit.Locked,
        `Could not write ${path}.`,
        `The filesystem returned ${code}. The file may be locked or immutable.`,
        `ls -lO ${path} && envcheck fix`,
      );
    }
    throw new EnvcheckError(
      Exit.Unreadable,
      `Write to ${path} failed.`,
      (err as Error).message,
      "Nothing was renamed into place. Fix the underlying error and re-run envcheck fix.",
    );
  } finally {
    off();
  }
}
