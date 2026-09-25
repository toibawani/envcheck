import { readdirSync, readFileSync, realpathSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";
import { parseIgnore, isIgnored, type IgnoreRule } from "./gitignore.ts";
import { aborted } from "./signals.ts";

export interface FoundFile {
  abs: string;
  rel: string;
  name: string;
}

export function isEnvFileName(name: string): boolean {
  return name === ".env" || name.startsWith(".env.");
}

export interface ScanOptions {
  root: string;
  extraIgnore: string[];
}

interface Frame {
  dir: string;
  rules: IgnoreRule[];
}

export function scanEnvFiles(opts: ScanOptions): FoundFile[] {
  const root = opts.root;
  const found: FoundFile[] = [];
  const seenReal = new Set<string>();
  const rootRules = [
    ...loadIgnoreFile(join(root, ".gitignore")),
    ...loadIgnoreFile(join(root, ".envcheckignore")),
    ...parseIgnore(opts.extraIgnore.join("\n")),
  ];
  walk(root, [{ dir: root, rules: rootRules }]);
  found.sort((a, b) => a.rel.localeCompare(b.rel));
  return found;

  function walk(dir: string, stack: Frame[]): void {
    if (aborted()) {
      throw new EnvcheckError(
        Exit.Interrupted,
        "Scan aborted.",
        "SIGINT arrived while reading the tree.",
        "Re-run envcheck check when you are ready.",
      );
    }
    let real: string;
    try {
      real = realpathSync(dir);
    } catch {
      real = dir;
    }
    if (seenReal.has(real)) return;
    seenReal.add(real);

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      const rel = relOf(root, dir) || ".";
      if (code === "EACCES" || code === "EPERM") {
        throw new EnvcheckError(
          Exit.Unreadable,
          `Permission denied reading ${rel}.`,
          `readdir returned ${code}.`,
          `chmod u+rx ${rel} && envcheck check`,
        );
      }
      throw new EnvcheckError(
        Exit.Unreadable,
        `Could not list ${rel}.`,
        (err as Error).message,
        "Check that the directory still exists and retry: envcheck check",
      );
    }

    for (const ent of entries) {
      if (ent.name === ".git" || ent.name === "node_modules") continue;
      const abs = join(dir, ent.name);
      let isDir = ent.isDirectory();
      let isFile = ent.isFile();
      if (ent.isSymbolicLink()) {
        const kind = classifySymlink(abs, seenReal);
        if (kind === "cycle" || kind === "broken") continue;
        isDir = kind === "dir";
        isFile = kind === "file";
      }
      if (isDir) {
        if (pathIgnored(abs, true, stack)) continue;
        const next = stack.slice();
        const more = [
          ...loadIgnoreFile(join(abs, ".gitignore")),
          ...loadIgnoreFile(join(abs, ".envcheckignore")),
        ];
        if (more.length) next.push({ dir: abs, rules: more });
        walk(abs, next);
        continue;
      }
      if (!isFile || !isEnvFileName(ent.name)) continue;
      if (pathIgnored(abs, false, stack)) continue;
      found.push({ abs, rel: relOf(root, abs), name: ent.name });
    }
  }
}

function classifySymlink(abs: string, seenReal: Set<string>): "dir" | "file" | "cycle" | "broken" {
  try {
    const real = realpathSync(abs);
    if (seenReal.has(real)) return "cycle";
    const st = statSync(real);
    if (st.isDirectory()) return "dir";
    if (st.isFile()) return "file";
    return "broken";
  } catch {
    return "broken";
  }
}

function pathIgnored(abs: string, isDir: boolean, stack: Frame[]): boolean {
  for (const frame of stack) {
    const rel = relOf(frame.dir, abs);
    if (!rel || rel.startsWith("..")) continue;
    if (isIgnored(rel, isDir, frame.rules)) return true;
  }
  return false;
}

function relOf(root: string, abs: string): string {
  const rel = relative(root, abs);
  if (!rel) return "";
  return rel.split(sep).join("/");
}

function loadIgnoreFile(path: string): IgnoreRule[] {
  if (!existsSync(path)) return [];
  try {
    return parseIgnore(readFileSync(path, "utf8"));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EACCES" || code === "EPERM") {
      throw new EnvcheckError(
        Exit.Unreadable,
        `Permission denied reading ${path}.`,
        `open returned ${code}.`,
        `chmod u+r ${path}`,
      );
    }
    return [];
  }
}

export function defaultSchemaRel(files: FoundFile[]): string | undefined {
  const preferred = [".env.example", ".env.sample", ".env.template"];
  for (const name of preferred) {
    const hit = files.find((f) => f.name === name && !f.rel.includes("/"));
    if (hit) return hit.rel;
  }
  for (const name of preferred) {
    const hit = files.find((f) => f.name === name);
    if (hit) return hit.rel;
  }
  return undefined;
}
