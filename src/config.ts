import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { EnvcheckError } from "./errors.ts";
import { Exit } from "./exit.ts";

export interface ProjectConfig {
  schema?: string;
  ignore?: string[];
  root?: string;
  maxDistance?: number;
}

export interface ResolvedConfig {
  schema: string | undefined;
  ignore: string[];
  root: string;
  maxDistance: number;
  configPath: string | undefined;
}

const DEFAULTS = {
  maxDistance: 3,
};

export function loadConfig(cwd: string): ResolvedConfig {
  const candidates = [".envcheckrc", ".envcheckrc.json"];
  let configPath: string | undefined;
  let raw: ProjectConfig = {};

  for (const name of candidates) {
    const p = join(cwd, name);
    if (!existsSync(p)) continue;
    configPath = p;
    let text: string;
    try {
      text = readFileSync(p, "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      throw new EnvcheckError(
        Exit.Config,
        `Could not read ${name}.`,
        code === "EACCES"
          ? `The process does not have permission to read ${p}.`
          : `The filesystem returned ${(err as Error).message}.`,
        `chmod u+r ${name} && envcheck check`,
      );
    }
    try {
      raw = JSON.parse(text) as ProjectConfig;
    } catch (err) {
      const msg = err instanceof SyntaxError ? err.message : "invalid JSON";
      throw new EnvcheckError(
        Exit.Config,
        `${name} is not valid JSON.`,
        msg,
        `Fix the JSON in ${name}, or delete it and pass flags: envcheck check --schema .env.example`,
      );
    }
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      throw new EnvcheckError(
        Exit.Config,
        `${name} must be a JSON object.`,
        `Got ${Array.isArray(raw) ? "an array" : typeof raw} at the top level.`,
        `Rewrite ${name} as { "schema": ".env.example" }`,
      );
    }
    break;
  }

  if (raw.ignore !== undefined && !Array.isArray(raw.ignore)) {
    throw new EnvcheckError(
      Exit.Config,
      `${configPath ?? ".envcheckrc"} has an invalid "ignore" field.`,
      `"ignore" must be an array of glob strings.`,
      `Use "ignore": ["**/.env.local"]`,
    );
  }
  if (raw.maxDistance !== undefined && (!Number.isInteger(raw.maxDistance) || raw.maxDistance < 0)) {
    throw new EnvcheckError(
      Exit.Config,
      `${configPath ?? ".envcheckrc"} has an invalid "maxDistance".`,
      "It must be a non-negative integer (Levenshtein cutoff for typo suggestions).",
      `Use "maxDistance": 3`,
    );
  }

  return {
    schema: raw.schema,
    ignore: raw.ignore ?? [],
    root: cwd,
    maxDistance: raw.maxDistance ?? DEFAULTS.maxDistance,
    configPath,
  };
}
