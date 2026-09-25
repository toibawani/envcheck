import { readFileSync, statSync } from "node:fs";
import { c } from "./color.ts";
import { confirm, ask } from "./prompt.ts";
import type { LoadedEnv } from "./load.ts";
import type { ParseResult } from "./parse.ts";
import { maskValue } from "./parse.ts";
import { diffFile } from "./diff.ts";
import { writeAtomic } from "./atomic.ts";

export async function fixFile(
  loaded: LoadedEnv,
  schema: ParseResult,
  maxDistance: number,
  reveal: boolean,
): Promise<"changed" | "skipped" | "clean"> {
  const report = diffFile(loaded.rel, loaded.parsed, schema, maxDistance);
  const dirty =
    report.missing.length + report.empty.length + report.extra.length + report.typos.length > 0 ||
    loaded.emptyFile;
  if (!dirty) return "clean";

  process.stdout.write(`\n${c.bold(loaded.rel)}\n`);
  let text = loaded.bytes === 0 ? "" : readFileSync(loaded.abs, "utf8");
  if (!text.endsWith("\n") && text.length > 0) text += "\n";
  const mtime = statSync(loaded.abs).mtimeMs;
  let changed = false;

  for (const key of report.missing) {
    const schemaEntry = schema.map.get(key);
    const hint = schemaEntry?.comment;
    const sample = schemaEntry && !schemaEntry.empty ? maskValue(schemaEntry.value) : undefined;
    process.stdout.write(`${c.red("missing")} ${key}`);
    if (hint) process.stdout.write(c.dim(`  # ${hint}`));
    if (sample) process.stdout.write(c.dim(`  schema ${sample}`));
    process.stdout.write("\n");

    const useDefault = hint ? await confirm(`  use comment as value? "${hint}"`) : false;
    let value: string | undefined;
    if (useDefault && hint) value = hint;
    else if (await confirm(`  set ${key} now?`)) {
      value = await ask("  value: ");
    }
    if (value === undefined) {
      process.stdout.write(c.dim("  skipped\n"));
      continue;
    }
    const line = `${key}=${quoteIfNeeded(value)}\n`;
    process.stdout.write(c.dim("  + ") + line);
    if (await confirm("  write this line?")) {
      text += line;
      changed = true;
    }
  }

  for (const typo of report.typos) {
    const current = loaded.parsed.map.get(typo.key);
    const shown = reveal ? current?.value ?? "" : maskValue(current?.value ?? "");
    process.stdout.write(
      `${c.yellow("typo")} ${typo.key} ${c.dim("→")} ${c.green(typo.suggestion)} ${c.dim(shown)}\n`,
    );
    if (!(await confirm(`  rename ${typo.key} to ${typo.suggestion}?`))) continue;
    text = renameKey(text, typo.key, typo.suggestion);
    changed = true;
  }

  for (const extra of report.extra) {
    process.stdout.write(`${c.dim("extra")} ${extra.key} ${c.dim("(not in schema)")}\n`);
    if (!(await confirm(`  remove ${extra.key}?`))) continue;
    text = removeKey(text, extra.key);
    changed = true;
  }

  if (!changed) return "skipped";

  process.stdout.write("\n" + c.bold("preview") + "\n");
  process.stdout.write(previewDiff(readFileSync(loaded.abs, "utf8"), text));
  if (!(await confirm(`write ${loaded.rel}?`))) {
    process.stdout.write(c.dim("left untouched\n"));
    return "skipped";
  }
  writeAtomic(loaded.abs, text, mtime);
  process.stdout.write(c.green(`wrote ${loaded.rel}\n`));
  return "changed";
}

function quoteIfNeeded(value: string): string {
  if (value === "") return "";
  if (/[\s#"'\\$]/.test(value)) return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return value;
}

function renameKey(text: string, from: string, to: string): string {
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const t = line.trimStart();
      const exported = t.startsWith("export ") ? "export " : "";
      const body = exported ? t.slice(7) : t;
      if (body.startsWith(from + "=")) {
        const indent = line.slice(0, line.length - line.trimStart().length);
        return indent + exported + to + body.slice(from.length);
      }
      return line;
    })
    .join("\n");
}

function removeKey(text: string, key: string): string {
  const lines = text.split("\n");
  const kept = lines.filter((line) => {
    const t = line.trim();
    const body = t.startsWith("export ") ? t.slice(7) : t;
    return !body.startsWith(key + "=");
  });
  return kept.join("\n");
}

function previewDiff(before: string, after: string): string {
  const a = before.split("\n");
  const b = after.split("\n");
  const out: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (a[i] === b[i]) continue;
    if (a[i] !== undefined && b[i] === undefined) out.push(c.red("- " + a[i]));
    else if (a[i] === undefined && b[i] !== undefined) out.push(c.green("+ " + b[i]));
    else {
      if (a[i] !== undefined) out.push(c.red("- " + a[i]));
      if (b[i] !== undefined) out.push(c.green("+ " + b[i]));
    }
  }
  if (out.length === 0) out.push(c.dim("(no textual change)"));
  return out.join("\n") + "\n";
}
