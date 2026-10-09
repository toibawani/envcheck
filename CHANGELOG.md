# Changelog for envcheck

# This file documents all notable changes. See CONTRIBUTING.md for the

# versioning policy. Entries are grouped by type and ordered newest-first.

## [0.2.0] — 2026-01-03

### Added

- `envcheck doctor` subcommand to verify environment and schema setup
- `--stats` flag to aggregate issue counts in the final summary line
- `--skip-empty` flag to skip files that are completely empty
- `--skip-no-pairs` flag to skip files containing only comments or whitespace
- JSON summary object in `--json` output

### Fixed

- Typo detection bug where correctly-named keys in the working file were
  misreported as extra (typo scoring now matches schema keys correctly)

### Changed

- Refactored check engine to export runnable interfaces (`CheckFlags`,
  `RunCheckInput`) for external tooling and testability

## [0.1.0] — 2025-12-27

Initial release.

- `envcheck check` — scan and report missing, empty, extra, and typo'd keys
- `envcheck fix` — walk missing and orphaned keys, preview, then write
- `envcheck init` — build `.env.example` from keys already in your `.env` files
- `envcheck about` — version, author, exit codes
- Typo detection with configurable `--max-distance`
- Masked values by default; `--reveal` to print values
- `.envcheckrc` config support with `.envcheckignore`
- No external runtime dependencies; pure Node + TypeScript
  EOF
