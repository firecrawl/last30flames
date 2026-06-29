#!/usr/bin/env bash
# Harness-agnostic launcher. Any agent runtime (Claude Code, OpenClaw, opencode,
# Codex, Gemini, ...) can call this without knowing its own install layout: the
# script locates its OWN directory, installs deps once, and runs the engine.
# No CLAUDE_PLUGIN_ROOT, no assumptions about the current working directory.
set -euo pipefail

# Directory this script lives in (resolves through symlinks too).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")" # one up from scripts/ = the skill root

cd "$SKILL_DIR"

# First-run install of the tiny Bun project (just dev types - zero runtime deps).
if [ ! -d node_modules ]; then
  echo "Installing dependencies (first run)..." >&2
  bun install >&2
fi

# Ensure the Firecrawl CLI is available. If it isn't already on PATH, warm bun's
# cache so the first search isn't a surprise download. (The engine falls back to
# `bunx firecrawl-cli` automatically, which fetches + caches it from npm.)
if ! command -v firecrawl >/dev/null 2>&1; then
  echo "Fetching the Firecrawl CLI via bunx (first run only)..." >&2
  bunx firecrawl-cli --version >&2 || true
fi

# Pass every argument straight through to the engine ("topic" --days N).
exec bun run scripts/index.ts "$@"
