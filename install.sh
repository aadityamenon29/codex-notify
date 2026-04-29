#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "codex-notify requires Node/npm so it can run through npx." >&2
  exit 1
fi

exec npx --yes github:aadityamenon29/codex-notify install "$@"
