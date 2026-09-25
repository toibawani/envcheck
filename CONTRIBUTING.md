# Contributing

envcheck is a small CLI. Keep it small.

## Branches

`type/short-topic`

- `feat/scan-symlinks`
- `fix/quote-escape`
- `docs/exit-codes`
- `test/parser-continuations`

No slashes beyond the type prefix. No ticket numbers unless you already have one.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/).

- `feat:` user-visible behavior
- `fix:` a bug, including a wrong exit code or a bad error message
- `docs:` README, contributing, comments that are part of the contract
- `test:` tests only
- `chore:` tooling, CI, deps

Subject line is imperative and under 72 characters. The body says why, not a recap of the diff.

## Tests

```sh
npm install
npm test
npm run typecheck
```

Parser changes need a case in `test/parse.test.ts`. Ignore-rule changes need a case in `test/ignore.test.ts`. If you touch exit codes, update the table in the README in the same commit.

## Runtime dependencies

There are none. That is deliberate. A new runtime dependency needs a comment in the PR explaining why Node's standard library cannot do the job, and a note on cold-start cost.

## Releasing

Semantic versioning, starting at `v0.1.0`.

- patch: bugfix, no flag or exit-code change
- minor: new flag, new reported category, still backward compatible for `--json` consumers
- major: exit code change, removed flag, or a `--json` field rename

Tag the commit that `npm run build` produced, not a docs-only follow-up.
