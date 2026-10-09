import { platform, arch, release } from "node:os";
import { version as nodeVersion } from "node:process";
import { join, relative } from "node:path";
import { statSync } from "node:fs";
import { version } from "./version.ts";
import { loadConfig } from "./config.ts";
import { scanEnvFiles, defaultSchemaRel } from "./scan.ts";

export interface DiagnoseReport {
  envcheck: string;
  node: string;
  platform: string;
  cwd: string;
  schema:
    | { path: string; rel: string }
    | { status: "not-found"; paths: string[] };
  config: { path: string } | { status: "not-found" | "invalid"; message: string };
  files: { path: string; bytes: number; schema: boolean }[];
  issueCount: number;
  issues: string[];
}

export function diagnose(cwd: string): DiagnoseReport {
  const envcheckVersion = version();
  const issues: string[] = [];

  // Config
  let configPath: string | undefined;
  let configInvalidMessage: string | undefined;
  try {
    const cfg = loadConfig(cwd);
    configPath = cfg.configPath;
    if (!cfg.schema) {
      issues.push("no schema configured; use --schema or add a \"schema\" key to .envcheckrc");
    }
  } catch (err) {
    configInvalidMessage = err instanceof Error ? err.message : "unknown config error";
    issues.push(`.envcheckrc invalid: ${configInvalidMessage}`);
  }

  // Scan and pick the schema
  let files: { abs: string; rel: string; name: string }[];
  try {
    files = scanEnvFiles({ root: cwd, extraIgnore: [] });
  } catch (err) {
    files = [];
    issues.push(`scanning .env files failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Schema
  const schemaRel = defaultSchemaRel(files);
  let schema:
    | { path: string; rel: string }
    | { status: "not-found"; paths: string[] };
  if (schemaRel) {
    const hit = files.find((f) => f.rel === schemaRel);
    if (hit) {
      schema = { path: hit.abs, rel: hit.rel };
    } else {
      schema = { status: "not-found", paths: [schemaRel] };
      issues.push(`schema not found at ${schemaRel}`);
    }
  } else {
    schema = { status: "not-found", paths: [".env.example", ".env.sample", ".env.template"] };
    issues.push("no schema found; run \"envcheck init\" to seed .env.example");
  }

  // Env files
  const paths = files.map((f) => f.rel);
  return {
    envcheck: envcheckVersion,
    node: nodeVersion,
    platform: `${platform()} ${arch()} ${release()}`,
    cwd,
    schema,
    config: (function getConfig(): DiagnoseReport["config"] {
      if (configInvalidMessage) {
        return { status: "invalid", message: configInvalidMessage };
      }
      if (configPath) {
        return { path: configPath };
      }
      return { status: "not-found", message: "no .envcheckrc found" };
    })(),
    files: paths.map((path) => {
      const abs = join(cwd, path);
      const isSchema = schemaRel === path;
      try {
        return { path, bytes: statSync(abs).size, schema: isSchema };
      } catch {
        return { path, bytes: 0, schema: isSchema };
      }
    }),
    issueCount: issues.length,
    issues,
  };
}
