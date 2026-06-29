# lastNdays

A Claude Code / OpenClaw / opencode **skill** that researches what is actually
new about any topic in a recent time window.

It gathers three signals **in parallel** and hands them to the agent to write a
short, source-grounded brief:

- **Firecrawl Search** - web results scraped into full-page markdown, not snippets.
- **Hacker News** (public Algolia API) - points + comment counts.
- **GitHub** (official API) - stars + recent push activity.

Engagement numbers come only from APIs that publish them openly. The skill never
touches Reddit, X, TikTok, Instagram, or anything behind a login or cookie.

**No keys required at all.** The engine only gathers and prints a numbered
research context; the agent harness running the skill writes the brief with its
own model (no LLM key). And it reaches Firecrawl through the Firecrawl CLI, which
runs on a keyless free tier - so it works out of the box. Set `FIRECRAWL_API_KEY`
only if you want higher Firecrawl limits and concurrency.

## Install

Works in any agent harness (Claude Code, OpenClaw, opencode, Codex, Gemini, ...).
It only needs the `bun` binary - no API key required.

In Claude Code, via the plugin marketplace:

```
/plugin marketplace add firecrawl/lastNdays
/plugin install lastNdays
```

In any other harness, point it at this repo's `skills/lastNdays/SKILL.md` (or copy
that folder into the harness's skills directory). The engine is launched through
`skills/lastNdays/scripts/run.sh`, which self-locates and installs deps on first
run - no harness-specific environment variables required.

Keys are optional - it runs keyless. Set either only to raise rate limits:

```bash
export FIRECRAWL_API_KEY=fc-...   # higher Firecrawl limits + concurrency
export GITHUB_TOKEN=ghp_...       # higher GitHub rate limit
```

### Starting keyless, adding a key later

Nothing to reinstall or reconfigure. The Firecrawl CLI checks for a key on every
run, so the moment one is present it uses it:

```bash
export FIRECRAWL_API_KEY=fc-...   # or run: firecrawl login
```

Next run is automatically authenticated (higher limits, more concurrency). Confirm
with `firecrawl --status`. Remove the variable (or `firecrawl logout`) to go back
to the keyless free tier. Same binary, same skill - only the rate limits change.

## Use

```
/lastNdays AI coding agents
/lastNdays local LLM inference --days 7
```

`--days` sets the recency window (default 30). Any number works - 7, 30, 365.

## Run the engine directly

The engine is a tiny Bun + TypeScript project under `skills/lastNdays`:

```bash
cd skills/lastNdays
bun install
bun run scripts/index.ts "AI coding agents" --days 30
```

Progress prints to stderr; the numbered research context prints to stdout, so you
can pipe it (`> context.md`) or let the agent read it.

## Layout

```
.claude-plugin/        plugin.json + marketplace.json (distribution)
skills/lastNdays/
  SKILL.md             how the agent invokes the engine and writes the brief
  scripts/             the engine (one file per job, all small)
    index.ts           CLI entry: parse args, gather in parallel, print context
    config.ts          read optional env (GITHUB_TOKEN)
    firecrawl.ts       web layer: full-content search via the Firecrawl CLI (the star)
    hackernews.ts      HN Algolia search
    github.ts          GitHub repo search
    format.ts          render the numbered research context
    types.ts           shared types
    run.sh             self-locating launcher (install deps, run engine)
```
