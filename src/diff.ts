import type { EnvEntry, ParseResult } from "./parse.ts";
import { suggestKey } from "./distance.ts";

export interface TypoHit {
  key: string;
  suggestion: string;
  line: number;
}

export interface FileReport {
  path: string;
  missing: string[];
  empty: { key: string; line: number }[];
  extra: { key: string; line: number }[];
  typos: TypoHit[];
  interpolated: { key: string; refs: string[]; line: number }[];
  duplicates: string[];
  ok: boolean;
}

export function diffFile(
  filePath: string,
  parsed: ParseResult,
  schema: ParseResult,
  maxDistance: number,
): FileReport {
  const schemaKeys = [...schema.map.keys()];
  const schemaSet = new Set(schemaKeys);
  const missing: string[] = [];
  const empty: FileReport["empty"] = [];
  const extra: FileReport["extra"] = [];
  const typos: TypoHit[] = [];
  const interpolated: FileReport["interpolated"] = [];

  for (const key of schemaKeys) {
    const got = parsed.map.get(key);
    if (!got) {
      missing.push(key);
      continue;
    }
    if (got.empty) empty.push({ key, line: got.line });
  }

  for (const entry of parsed.entries) {
    if (entry.interpolated) {
      interpolated.push({ key: entry.key, refs: entry.interpolations, line: entry.line });
    }
    if (schemaSet.has(entry.key)) continue;
    const suggestion = suggestKey(entry.key, schemaKeys, maxDistance);
    if (suggestion && !parsed.map.has(suggestion)) {
      typos.push({ key: entry.key, suggestion, line: entry.line });
    } else {
      extra.push({ key: entry.key, line: entry.line });
    }
  }

  const report: FileReport = {
    path: filePath,
    missing,
    empty,
    extra,
    typos,
    interpolated,
    duplicates: parsed.duplicates,
    ok: false,
  };
  report.ok =
    missing.length === 0 &&
    empty.length === 0 &&
    extra.length === 0 &&
    typos.length === 0 &&
    parsed.duplicates.length === 0;
  return report;
}

export function schemaDefaults(schema: ParseResult): Map<string, EnvEntry> {
  return schema.map;
}
