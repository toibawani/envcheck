# envcheck

Compare every `.env*` file in a project to the one file you actually meant to be the contract. Usually `.env.example`.

Missing keys, empty values, orphans, and near-miss typos (`DATBASE_URL` vs `DATABASE_URL`). Values stay masked unless you pass `--reveal`. Files matching `.gitignore` are not read — that is the point, not a side effect.

Toiba · [github.com/toibawani](https://github.com/toibawani) · toibawani14@gmail.com

## Install

```sh
npm install -g envcheck
envcheck check
```

Or without installing:

```sh
npx envcheck check
```

Node 18 or newer. The published package is a single bundled file. No TypeScript at runtime.

From a checkout:

```sh
npm install
npm run build
node dist/cli.js check
```

## Commands

| Command | What it does |
| --- | --- |
| `envcheck check [dir]` | Scan and report. Exit 1 if anything drifted. |
| `envcheck fix [dir]` | Prompt for missing keys, offer to drop orphans, preview, then write. |
| `envcheck about` | Version, author, exit codes. |
| `envcheck --help` | Help for the command in front of the flag. |
| `envcheck --version` | Version inlined from `package.json` at build time. |

### Flags

| Flag | |
| --- | --- |
| `--schema <file>` | Contract file. Default: `.env.example`, then `.env.sample`, then `.env.template`. |
| `--ignore <glob>` | Extra ignore. Repeatable. Also reads `.gitignore` and `.envcheckignore`. |
| `--max-distance <n>` | Typo cutoff. Default 3. |
| `--reveal` | Print values. Default masks to the first and last two characters. |
| `--json` | JSON on stdout. No color, no spinner. |
| `--no-color` | Disable ANSI. Also honored: `NO_COLOR`, non-TTY. |
| `--verbose` | Attach the underlying error. Off by default — no raw stacks. |

CLI flags override `.envcheckrc`.

```json
{
  "schema": ".env.example",
  "ignore": ["**/.env.local"],
  "maxDistance": 2
}
```

## Example

```text
$ envcheck check
envcheck /Users/you/app
schema .env.example

ok  .env.test
!!  .env
    missing  STRIPE_SECRET
    empty    PORT:4
    typo     DATBASE_URL → DATABASE_URL:2
    extra    OLD_FLAG:6 ol…ag

4 issues across 2 files
next: envcheck fix
```

`envcheck fix` refuses to run when stdin is not a TTY, so CI cannot hang on a prompt. Use `envcheck check --json` there.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Every scanned file matches the schema. |
| 1 | Drift: missing, empty, extra, typo, or duplicate. |
| 2 | Bad usage, or `fix` without a TTY. |
| 3 | No `.env*` files, or no schema. |
| 4 | Permission denied, binary, or malformed syntax. |
| 5 | `.envcheckrc` is not valid JSON. |
| 6 | SIGINT. In-flight reads stop. A half-written temp file is removed. No partial rename. |
| 7 | File changed under us, or the write was rejected by the OS. |

## What it parses

`KEY=value`, `export KEY=value`, single and double quotes, `#` comments (including the comment above a key, used as a default hint in `fix`), blank lines, backslash line continuations, and `${OTHER}` / `$OTHER` interpolation. Interpolation is flagged, not expanded — expanding it would mean executing someone else's env file.

Invalid keys, unterminated quotes, and NUL bytes are errors with a file:line and a next step, not a stack trace.

## Layout

```text
src/cli.ts         arguments, help, exit
src/run.ts         check/fix orchestration
src/scan.ts        walk, symlink-cycle stop, ignore stack
src/gitignore.ts   pattern match
src/parse.ts       file → entries
src/parse-line.ts  one assignment
src/diff.ts        missing / empty / extra / typo
src/distance.ts    Levenshtein
src/load.ts        read, UTF-8, binary reject
src/format.ts      text and JSON
src/fix.ts         prompts, preview, write
src/atomic.ts      temp file + rename
src/config.ts      .envcheckrc
src/color.ts       NO_COLOR / TTY
src/errors.ts      what / why / fix
src/signals.ts     SIGINT
```

No circular imports. No runtime dependencies. `cac` and `commander` both lost to a 80-line parser: the flag surface is small, and a parser framework would be the only dependency on the cold-start path. Color is a few ANSI wrappers for the same reason — picocolors would be the right package if we needed it, but we don't.

Spinners are hand-rolled and only start if a scan is still going after 100ms, and only on a TTY. Piped output stays quiet.

## Versioning

`v0.1.0` is the first tagged build that scans, diffs, and fixes. From here:

- **patch** — bugfix, same flags, same exit codes, same JSON shape
- **minor** — new flag or new report field
- **major** — exit code change, removed flag, or a JSON rename

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. Copyright Toiba.
