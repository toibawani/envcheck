import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: false,
  minify: false,
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __ENVCHECK_VERSION__: JSON.stringify(pkg.version),
  },
  // Single ESM file. No runtime TS. Version is inlined so --version never reads disk.
});
