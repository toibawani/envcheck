declare const __ENVCHECK_VERSION__: string;

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Inlined by tsup from package.json. Unbundled runs read package.json once. */
export function version(): string {
  try {
    if (typeof __ENVCHECK_VERSION__ === "string" && __ENVCHECK_VERSION__.length > 0) {
      return __ENVCHECK_VERSION__;
    }
  } catch {
    // define absent under strip-types
  }
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    // fall through
  }
  return "0.0.0";
}
