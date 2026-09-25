import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";
import type { EnvEntry } from "./parse.ts";

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseAssignment(
  trimmed: string,
  lines: string[],
  index: number,
  fileLabel: string,
  lineNo: number,
  pendingComment: string | undefined,
): { entry: EnvEntry; nextIndex: number } {
  let body = trimmed;
  let exported = false;
  if (body.startsWith("export ") || body.startsWith("export\t")) {
    exported = true;
    body = body.slice(body.indexOf(" ") + 1).trimStart();
  }

  const eq = body.indexOf("=");
  if (eq < 0) {
    throw new EnvcheckError(
      Exit.Unreadable,
      `${fileLabel}:${lineNo} is not a KEY=VALUE assignment.`,
      `Expected KEY=VALUE, got "${clip(trimmed, 60)}".`,
      `Edit ${fileLabel} line ${lineNo} so it reads KEY=value, or comment it out with #.`,
    );
  }

  const key = body.slice(0, eq).trim();
  if (!KEY_RE.test(key)) {
    throw new EnvcheckError(
      Exit.Unreadable,
      `${fileLabel}:${lineNo} has an invalid key "${clip(key, 40)}".`,
      "Keys must match [A-Za-z_][A-Za-z0-9_]* — no spaces, hyphens, or leading digits.",
      `Rename the key on line ${lineNo} of ${fileLabel} to ${suggestKey(key)}.`,
    );
  }

  const read = readValue(body.slice(eq + 1), lines, index, fileLabel, lineNo);
  let comment = pendingComment;
  if (read.inlineComment && !comment) comment = read.inlineComment;

  const interpolations = read.quoted === "single" ? [] : findInterpolations(read.value);
  return {
    nextIndex: read.nextIndex,
    entry: {
      key,
      value: read.value,
      line: lineNo,
      quoted: read.quoted,
      exported,
      interpolated: interpolations.length > 0,
      interpolations,
      comment,
      empty: read.value.length === 0,
    },
  };
}

interface ReadValue {
  value: string;
  quoted: EnvEntry["quoted"];
  inlineComment: string | undefined;
  nextIndex: number;
}

function readValue(
  rest: string,
  lines: string[],
  index: number,
  fileLabel: string,
  lineNo: number,
): ReadValue {
  if (rest.startsWith("'") || rest.startsWith('"')) {
    const quote = rest[0] as "'" | '"';
    const closed = readQuoted(rest, quote, fileLabel, lineNo);
    const after = rest.slice(closed.consumed).trim();
    let inline: string | undefined;
    if (after.startsWith("#")) inline = after.replace(/^#\s?/, "");
    else if (after.length > 0) {
      throw new EnvcheckError(
        Exit.Unreadable,
        `${fileLabel}:${lineNo} has trailing junk after a quoted value.`,
        `Unexpected "${clip(after, 40)}" after the closing quote.`,
        `Move the extra text into a # comment on line ${lineNo} of ${fileLabel}.`,
      );
    }
    const value = quote === '"' ? unescapeDouble(closed.value) : closed.value;
    return { value, quoted: quote === "'" ? "single" : "double", inlineComment: inline, nextIndex: index + 1 };
  }

  if (rest.trimEnd().endsWith("\\")) {
    const acc: string[] = [rest.trimEnd().slice(0, -1)];
    let j = index;
    while ((lines[j] ?? "").trimEnd().endsWith("\\") && j + 1 < lines.length) {
      j++;
      const next = lines[j] ?? "";
      if (next.trimEnd().endsWith("\\")) acc.push(next.trimEnd().slice(0, -1));
      else acc.push(next);
    }
    return { value: acc.join("\n"), quoted: "none", inlineComment: undefined, nextIndex: j + 1 };
  }

  const hash = rest.search(/\s+#/);
  let inline: string | undefined;
  let bare = rest;
  if (hash >= 0) {
    inline = rest.slice(hash).replace(/^\s+#\s?/, "");
    bare = rest.slice(0, hash);
  }
  return { value: bare.trim(), quoted: "none", inlineComment: inline, nextIndex: index + 1 };
}

function readQuoted(
  rest: string,
  quote: "'" | '"',
  fileLabel: string,
  lineNo: number,
): { value: string; consumed: number } {
  let i = 1;
  let out = "";
  while (i < rest.length) {
    const ch = rest[i]!;
    if (quote === '"' && ch === "\\") {
      out += ch;
      if (i + 1 < rest.length) {
        out += rest[i + 1];
        i += 2;
        continue;
      }
    }
    if (ch === quote) return { value: out, consumed: i + 1 };
    out += ch;
    i++;
  }
  throw new EnvcheckError(
    Exit.Unreadable,
    `${fileLabel}:${lineNo} has an unterminated ${quote === "'" ? "single" : "double"} quote.`,
    "The opening quote never finds a matching closer before end of line.",
    `Close the quote on line ${lineNo} of ${fileLabel}.`,
  );
}

function unescapeDouble(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

const INTERP_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

export function findInterpolations(value: string): string[] {
  const found: string[] = [];
  INTERP_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = INTERP_RE.exec(value)) !== null) {
    const name = m[1] ?? m[2];
    if (name) found.push(name);
  }
  return found;
}

function suggestKey(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[0-9]+/, "");
  return cleaned.length > 0 ? cleaned.toUpperCase() : "MY_KEY";
}

function clip(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
