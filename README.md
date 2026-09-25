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
| `envcheck init [dir]` | Build `.env.example` from keys already in your `.env` files (never copies secrets). |
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
| `--json` | JSON on stdout. No color, no spinner. Includes a `summary` object. |
| `--force` | Allow `init` to overwrite an existing schema. |
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

4 issues across 2 files  (1 missing, 1 empty, 1 typo, 1 extra)
next: envcheck fix
```

No schema yet? Seed one from the keys you already use:

```sh
envcheck init
# writes .env.example with KEY= lines only — never your secret values
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Match |
| 1 | Drift |
| 2 | Usage |
| 3 | Nothing to scan / no schema |
| 4 | Unreadable / binary / bad UTF-8 |
| 5 | Bad `.envcheckrc` |
| 6 | Interrupted (SIGINT) |
| 7 | File locked on write |

## License

MIT
