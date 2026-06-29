---
name: lastNdays
description: "Research what is actually new about any topic in a recent time window. Pulls full-content web results (Firecrawl) plus honest engagement signals from Hacker News and GitHub, then you synthesize a short, source-grounded brief."
argument-hint: 'lastNdays AI coding agents | lastNdays local LLM inference --days 7'
allowed-tools: Bash, Read
user-invocable: true
homepage: https://github.com/firecrawl/lastNdays
repository: https://github.com/firecrawl/lastNdays
license: MIT
metadata:
  openclaw:
    emoji: "🔥"
    requires:
      env: []
      optionalEnv: [FIRECRAWL_API_KEY, GITHUB_TOKEN]
      bins: [bun]
    files:
      - "scripts/*"
  tags:
    - research
    - recency
    - firecrawl
    - web-search
    - hackernews
    - github
    - citations
---

# lastNdays

Research a topic across the **recent** web and write a short, source-grounded brief.

This skill is a thin engine plus your synthesis. The engine gathers sources and
prints a clean, numbered **research context**; you (the model running this skill)
read that context and write the brief.

**No keys are required.** The engine never calls an LLM (you do the synthesis),
and it reaches Firecrawl through the Firecrawl CLI, which runs on a keyless free
tier when no key is set. If `FIRECRAWL_API_KEY` *is* in the environment the CLI
uses it automatically for higher limits and concurrency - so a key is a speed
upgrade, never a requirement. A user who starts keyless and later sets
`FIRECRAWL_API_KEY` (or runs `firecrawl login`) is authenticated on the very next
run, with nothing to reinstall.

## How it works

Three sources run in parallel:

- **Firecrawl Search** - web results scraped into full-page markdown, not snippets.
- **Hacker News** (public Algolia API) - points + comment counts.
- **GitHub** (official API) - stars + recent push activity.

Engagement numbers come only from APIs that publish them openly. The skill never
touches Reddit, X, TikTok, Instagram, or anything behind a login or cookie.

## Run the engine

This works in any agent harness (Claude Code, OpenClaw, opencode, Codex, Gemini,
...). You already know the absolute path of this `SKILL.md` because you just read
it; call `scripts/run.sh` next to it. It self-locates, installs deps on first run,
and takes the topic plus an optional `--days N` window (any number - 7, 30, 365;
default 30):

```bash
bash <SKILL_DIR>/scripts/run.sh "<TOPIC>" --days 30
```

Replace `<SKILL_DIR>` with the directory this file is in. Do not rely on
`$CLAUDE_PLUGIN_ROOT` or the current working directory - the launcher handles
both. The only requirement is the `bun` binary; no API key is needed (set
`FIRECRAWL_API_KEY` only if you want higher Firecrawl limits).

Progress prints to stderr; the numbered research context prints to stdout. Read
the stdout - that is your evidence.

## Write the brief

From the numbered sources, write a few tight paragraphs that:

- **Lead with what is genuinely new or moving** in the window. Not background.
- **Ground every claim in the sources and cite inline** like `[1]`, `[3]`.
- **Use the engagement numbers** (HN points/comments, GitHub stars) as a signal
  of what people actually care about - weight high-engagement items.
- **Say plainly where evidence is thin** rather than inventing detail. If HN or
  GitHub returned little, that honesty is part of the answer.

Do not dump a raw "Sources:" list or paste the research context back. Synthesize.
