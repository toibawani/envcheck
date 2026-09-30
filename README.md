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

Node 18 or newer. Single bundled file. No TypeScript at runtime.

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

### Flags that matter

| Flag | |
| --- | --- |
| `--schema <file>` | Contract file. Default: `.env.example`, then `.env.sample`, then `.env.template`. |
| `--fail-on <list>` | Exit 1 only for these kinds: `missing,empty,extra,typo,dup`. Default: all. |
| `--ignore <glob>` | Extra ignore. Repeatable. Also reads `.gitignore` and `.envcheckignore`. |
| `--max-distance <n>` | Typo cutoff. Default 3. |
| `--reveal` | Print values. Default masks short secrets fully. |
| `--json` | JSON on stdout with `version`, `summary`, `exitCode`. |
| `--force` | Allow `init` to overwrite an existing schema. |
| `--dry-run` | `init` prints the schema and writes nothing. |
| `--no-color` | Disable ANSI. Also: `NO_COLOR`, non-TTY. |

CLI flags override `.envcheckrc`.

## Example

```text
$ envcheck check test/fixtures/golden
!!  .env
    empty    PORT:5
    empty    REDIS_URL:6
    typo     DATBASE_URL → DATABASE_URL:2
    extra    EXTRA_ORPHAN:7 ••••
next: envcheck fix
```

Strict CI that only fails on typos:

```sh
envcheck check --fail-on typo
```

No schema yet:

```sh
envcheck init --dry-run
envcheck init
```

## CI

GitHub Actions:

```yaml
- run: npm i -g envcheck
- run: envcheck check --json
```

Pre-commit:

```sh
envcheck check --fail-on missing,typo
```

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Clean |
| 1 | Drift |
| 2 | Usage |
| 3 | Nothing to scan / no schema |
| 4 | Unreadable / binary / bad syntax |
| 5 | Bad `.envcheckrc` |
| 6 | Interrupted (SIGINT) |
| 7 | File locked on write |

Same table is printed by `envcheck about`.

## License

MIT
