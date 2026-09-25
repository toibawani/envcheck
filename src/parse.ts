import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";
import { parseAssignment } from "./parse-line.ts";

export interface EnvEntry {
  key: string;
  value: string;
  line: number;
  quoted: "none" | "single" | "double";
  exported: boolean;
  interpolated: boolean;
  interpolations: string[];
  comment: string | undefined;
  empty: boolean;
}

export interface ParseResult {
  entries: EnvEntry[];
  map: Map<string, EnvEntry>;
  duplicates: string[];
  comments: Map<string, string>;
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) {
    if (buf[i] === 0) return true;
  }
  return false;
}

export function parseEnv(text: string, fileLabel: string): ParseResult {
  if (text.includes("\u0000")) {
    throw new EnvcheckError(
      Exit.Unreadable,
      `${fileLabel} is not valid UTF-8 text.`,
      "The file contains NUL bytes, so it is being treated as binary rather than an env file.",
      `file ${fileLabel}`,
    );
  }

  const entries: EnvEntry[] = [];
  const map = new Map<string, EnvEntry>();
  const duplicates: string[] = [];
  const comments = new Map<string, string>();
  const lines = splitLines(text);

  let i = 0;
  let pendingComment: string | undefined;

  while (i < lines.length) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      pendingComment = undefined;
      i++;
      continue;
    }

    if (trimmed.startsWith("#")) {
      pendingComment = trimmed.replace(/^#\s?/, "");
      i++;
      continue;
    }

    const parsed = parseAssignment(trimmed, lines, i, fileLabel, lineNo, pendingComment);
    i = parsed.nextIndex;

    const entry = parsed.entry;
    if (map.has(entry.key)) duplicates.push(entry.key);
    map.set(entry.key, entry);
    entries.push(entry);
    if (entry.comment) comments.set(entry.key, entry.comment);
    pendingComment = undefined;
  }

  return { entries, map, duplicates, comments };
}

function splitLines(text: string): string[] {
  if (text.length === 0) return [];
  const norm = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const parts = norm.split("\n");
  if (parts.length > 0 && parts[parts.length - 1] === "" && norm.endsWith("\n")) {
    parts.pop();
  }
  return parts;
}

export function maskValue(value: string): string {
  if (value.length === 0) return "(empty)";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}…${value.slice(-2)}`;
}
