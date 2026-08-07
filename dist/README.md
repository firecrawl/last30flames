# last30flames — Codex & Claude skill packages

Two harness-specific packages of the same keyless research skill. The **engine is identical in both** — only the manifest file (`SKILL.md` vs `skill.md`), its frontmatter, and the install path differ.

Source: https://github.com/Laksh-star/last30flames (fork of https://github.com/firecrawl/last30flames)

---

## What the skill does

Gathers five signals **in parallel** and hands them to the agent to write a short, source-grounded brief of what's new on a topic within a recent time window (`--days N`, default 30):

- **Firecrawl Search** — full-page markdown web results (keyless free tier).
- **Hacker News** (public Algolia API) — points + comments.
- **Lobste.rs** (public JSON feeds) — points + comments.
- **Bluesky** (public AT Protocol API) — likes + reposts + replies.
- **GitHub** (official API) — stars + recent push activity.

No LLM in the engine. No API keys required (`FIRECRAWL_API_KEY` / `GITHUB_TOKEN` only raise rate limits). Only binary required: **`bun`**.

---

## Package layout

```
dist/
├── codex/last30flames/      # OpenAI Codex CLI skill
│   ├── SKILL.md             # Codex frontmatter + harness-agnostic body
│   ├── scripts/             # run.sh + the Bun/TS engine (unchanged)
│   ├── package.json
│   ├── bun.lock
│   ├── tsconfig.json
│   ├── .env.example
│   └── LICENSE
└── claude/last30flames/     # Anthropic Claude Code skill
    ├── skill.md             # Claude frontmatter + harness-agnostic body
    ├── scripts/             # run.sh + the Bun/TS engine (unchanged)
    ├── package.json
    ├── bun.lock
    ├── tsconfig.json
    ├── .env.example
    └── LICENSE
```

The `scripts/` directory is byte-identical across both packages. Both manifests keep the upstream `metadata.openclaw` block so future `git pull` merges from `firecrawl/last30flames` don't conflict on the manifest file.

### Build shareable zips (optional)

The folders are the source of truth. If you need zips for claude.ai upload or a skill-installer, build them locally so the skill folder is the zip root:

```bash
cd dist
(cd codex  && zip -qr ../last30flames-codex.zip  last30flames)
(cd claude && zip -qr ../last30flames-claude.zip last30flames)
```

---

## Install

### Codex CLI

Codex auto-discovers skills from `~/.agents/skills/` (newer open-agent convention) and `~/.codex/skills/` (legacy/compat). Project skills go in `<repo>/.agents/skills/`.

```bash
# User-level (all projects)
mkdir -p ~/.agents/skills
cp -r dist/codex/last30flames ~/.agents/skills/

# Or project-level (this repo only)
mkdir -p .agents/skills
cp -r dist/codex/last30flames .agents/skills/
```

Codex re-reads skills at session start — restart your Codex session after installing.

### Claude Code

Claude Code auto-discovers skills from `~/.claude/skills/` (personal/global) and `<repo>/.claude/skills/` (project).

```bash
# Personal (all projects)
mkdir -p ~/.claude/skills
cp -r dist/claude/last30flames ~/.claude/skills/

# Or project-level (this repo only)
mkdir -p .claude/skills
cp -r dist/claude/last30flames .claude/skills/
```

Restart Claude Code so the skill index reloads. The skill is invokable as `/last30flames` and auto-loads when your prompt matches the `description` trigger.

### claude.ai (web)

Zip the `claude/last30flames` folder so the folder is the zip root, then upload under **Settings → Features** (Pro/Max/Team/Enterprise with code execution). Build the zip from the repo root:

```bash
cd dist && (cd claude && zip -qr ../last30flames-claude.zip last30flames)
```

The zip will have `last30flames/` as its root (folder name = skill name), which is what claude.ai expects.

---

## Prerequisites (both harnesses)

1. **Install `bun`** — https://bun.sh (the engine's only runtime). `scripts/run.sh` runs `bun install` automatically on first invocation.
2. **(Optional) `FIRECRAWL_API_KEY`** — only raises Firecrawl rate limits/concurrency. Without it, the keyless free tier is used.
3. **(Optional) `GITHUB_TOKEN`** — only raises GitHub API rate limits.

Copy `dist/<harness>/last30flames/.env.example` to `.env` in the skill dir if you want to set the optional keys (Bun loads `.env` automatically).

---

## Usage (identical in both harnesses)

```
/last30flames AI coding agents
/last30flames local LLM inference --days 7
/last30flames cursor vs zed
/last30flames --resolve "Apple"
```

The agent reads the numbered research context the engine prints to stdout and writes the brief, citing inline like `[1]`, `[3]` and ending with a clickable `Sources:` list.

---

## How these packages were derived from upstream

1. Cloned `Laksh-star/last30flames` (fork of `firecrawl/last30flames`).
2. Copied `skills/last30flames/{scripts,package.json,bun.lock,tsconfig.json,.env.example}` + `LICENSE` **unchanged** into both `dist/codex/last30flames/` and `dist/claude/last30flames/`.
3. Wrote a harness-specific manifest on top:
   - **Codex** → `SKILL.md` with Codex-compatible frontmatter (`name`, `description` ≤1024 chars, `allowed-tools: Bash, Read`, `user-invocable: true`, `license`, `homepage`/`repository` pinned to the Laksh-star fork, `upstream` field, `tags`, `metadata.version` + `metadata.requires`). Kept the upstream `metadata.openclaw` block.
   - **Claude** → `skill.md` (Anthropic lowercase) with Claude frontmatter (`name` ≤64 chars matching dir, `description` ≤1024 chars, `allowed-tools: Bash, Read`, `user-invokable: true`, `argument-hint`, `license`, structured `author`, `homepage`/`repository`, `metadata.version`). Kept the upstream `metadata.openclaw` block.
4. The skill body (engine invocation, resolution, comparison, save/reuse, brief-writing, HTML brief) is carried over **verbatim** from upstream — it is already harness-agnostic by design. A short harness-specific note is prepended inside the body.

No engine code was modified. The skill remains keyless and harness-agnostic.

---

## Pushing back to the Laksh-star fork

These packages are designed to merge cleanly back into the fork. Suggested repo layout if you want both shipped from one repo:

```
last30flames/
├── skills/last30flames/          # upstream original (unchanged)
├── dist/codex/last30flames/      # Codex package (this conversion)
└── dist/claude/last30flames/     # Claude package (this conversion)
```

Because the engine files are identical to upstream and the manifests keep the `metadata.openclaw` block, `git pull` from `firecrawl/last30flames` will not conflict on the converted packages.
