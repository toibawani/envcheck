import { c } from "./color.ts";
import type { FileReport } from "./diff.ts";
import { maskValue } from "./parse.ts";
import type { LoadedEnv } from "./load.ts";

export interface RenderInput {
  root: string;
  schemaRel: string;
  files: { loaded: LoadedEnv; report: FileReport }[];
  reveal: boolean;
  ignoredNote?: string;
}

export function renderText(input: RenderInput): string {
  const lines: string[] = [];
  lines.push(`${c.bold("envcheck")} ${c.dim(input.root)}`);
  lines.push(`${c.dim("schema")} ${input.schemaRel}`);
  lines.push("");

  let problems = 0;
  for (const { loaded, report } of input.files) {
    if (report.ok && !loaded.emptyFile && !loaded.noPairs) {
      lines.push(`${c.green("ok")}  ${report.path}`);
      continue;
    }
    const mark = report.ok ? c.yellow("·") : c.red("!!");
    lines.push(`${mark}  ${c.bold(report.path)}${loaded.emptyFile ? c.dim("  (0 bytes)") : ""}`);

    if (loaded.emptyFile) {
      problems++;
      lines.push(`    ${c.yellow("empty file")}  zero bytes, so there is nothing to compare`);
    } else if (loaded.noPairs) {
      problems++;
      lines.push(`    ${c.yellow("no keys")}  file has comments or whitespace only`);
    }

    for (const key of report.missing) {
      problems++;
      lines.push(`    ${c.red("missing")}  ${key}`);
    }
    for (const e of report.empty) {
      problems++;
      lines.push(`    ${c.yellow("empty")}    ${e.key}${c.dim(`:${e.line}`)}`);
    }
    for (const t of report.typos) {
      problems++;
      lines.push(`    ${c.yellow("typo")}     ${t.key} ${c.dim("→")} ${c.green(t.suggestion)}${c.dim(`:${t.line}`)}`);
    }
    for (const e of report.extra) {
      problems++;
      const shown = input.reveal
        ? loaded.parsed.map.get(e.key)?.value ?? ""
        : maskValue(loaded.parsed.map.get(e.key)?.value ?? "");
      lines.push(`    ${c.dim("extra")}    ${e.key}${c.dim(`:${e.line}`)} ${c.dim(shown)}`);
    }
    for (const d of report.duplicates) {
      problems++;
      lines.push(`    ${c.yellow("dup")}      ${d} ${c.dim("later assignment wins")}`);
    }
    for (const n of report.interpolated) {
      lines.push(`    ${c.dim("interp")}   ${n.key} ${c.dim("refs")} ${n.refs.join(", ")}`);
    }
  }

  lines.push("");
  if (problems === 0) {
    lines.push(
      c.green(
        `${input.files.length} file${input.files.length === 1 ? "" : "s"} match ${input.schemaRel}`,
      ),
    );
  } else {
    const counts = { missing: 0, empty: 0, typo: 0, extra: 0, dup: 0, other: 0 };
    for (const { loaded, report } of input.files) {
      counts.missing += report.missing.length;
      counts.empty += report.empty.length;
      counts.typo += report.typos.length;
      counts.extra += report.extra.length;
      counts.dup += report.duplicates.length;
      if (loaded.emptyFile || loaded.noPairs) counts.other++;
    }
    const parts: string[] = [];
    if (counts.missing) parts.push(`${counts.missing} missing`);
    if (counts.empty) parts.push(`${counts.empty} empty`);
    if (counts.typo) parts.push(`${counts.typo} typo`);
    if (counts.extra) parts.push(`${counts.extra} extra`);
    if (counts.dup) parts.push(`${counts.dup} dup`);
    if (counts.other) parts.push(`${counts.other} empty-file`);
    lines.push(
      `${c.red(String(problems))} issue${problems === 1 ? "" : "s"} across ${input.files.length} file${input.files.length === 1 ? "" : "s"}` +
        (parts.length ? c.dim(`  (${parts.join(", ")})`) : ""),
    );
    lines.push(c.dim("next: envcheck fix"));
  }
  return lines.join("\n") + "\n";
}

export function renderJson(input: RenderInput): string {
  const files = input.files.map(({ loaded, report }) => ({
    path: report.path,
    bytes: loaded.bytes,
    emptyFile: loaded.emptyFile,
    noPairs: loaded.noPairs,
    ok: report.ok && !loaded.emptyFile && !loaded.noPairs,
    missing: report.missing,
    empty: report.empty,
    extra: report.extra.map((e) => ({
      key: e.key,
      line: e.line,
      value: input.reveal
        ? loaded.parsed.map.get(e.key)?.value ?? ""
        : maskValue(loaded.parsed.map.get(e.key)?.value ?? ""),
    })),
    typos: report.typos,
    interpolated: report.interpolated,
    duplicates: report.duplicates,
  }));
  const summary = {
    missing: files.reduce((n, f) => n + f.missing.length, 0),
    empty: files.reduce((n, f) => n + f.empty.length, 0),
    extra: files.reduce((n, f) => n + f.extra.length, 0),
    typos: files.reduce((n, f) => n + f.typos.length, 0),
    duplicates: files.reduce((n, f) => n + f.duplicates.length, 0),
  };
  const issueCount =
    summary.missing +
    summary.empty +
    summary.extra +
    summary.typos +
    summary.duplicates +
    files.reduce((n, f) => n + (f.emptyFile || f.noPairs ? 1 : 0), 0);
  return (
    JSON.stringify({ schema: input.schemaRel, files, summary, issueCount, ok: issueCount === 0 }, null, 2) +
    "\n"
  );
}
