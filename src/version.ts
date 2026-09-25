declare const __ENVCHECK_VERSION__: string;

/** Inlined by tsup from package.json. Dev (strip-types) falls back to reading package.json once. */
export function version(): string {
  try {
    if (typeof __ENVCHECK_VERSION__ === "string" && __ENVCHECK_VERSION__.length > 0) {
      return __ENVCHECK_VERSION__;
    }
  } catch {
    // ReferenceError when running unbundled.
  }
  return "0.1.0";
}
