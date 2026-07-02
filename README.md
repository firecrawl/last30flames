<div align="center">

# last30flames

**An agent skill that researches what is actually new about any topic in a recent time window.**

No API keys required - works out of the box.

</div>

Works in any agent harness that supports skills.

> Inspired by [last30days](https://github.com/mvanhorn/last30days-skill) by Matt
> Van Horn.

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

Works in any agent harness that supports skills.
It only needs the `bun` binary - no API key required.

**Recommended** - via [skills.sh](https://www.skills.sh/), which installs into
whichever harness you use:

```
npx skills add firecrawl/last30flames
```

In Claude Code you can alternatively install through the plugin marketplace:

```
/plugin marketplace add firecrawl/last30flames
/plugin install last30flames
```

In any other harness, point it at this repo's `skills/last30flames/SKILL.md` (or copy
that folder into the harness's skills directory). The engine is launched through
`skills/last30flames/scripts/run.sh`, which self-locates and installs deps on first
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
/last30flames AI coding agents
/last30flames local LLM inference --days 7
```

`--days` sets the recency window (default 30). Any number works - 7, 30, 365.

### Save and reuse research

Ask the skill to save a run, and it writes the raw research context to a thread
folder under `~/.last30flames/` (findable from any later session):

```
/last30flames AI coding agents, save this to my ai-agents research
```

Related calls in the same session land in the same thread. In a later session,
reload it without re-scraping:

```
/last30flames load my ai-agents research
/last30flames using my saved ai-agents research, what did I find on local inference?
```

If a saved context is older than its recency window, the skill warns you it's
stale and offers to re-run fresh.

## Run the engine directly

The engine is a tiny Bun + TypeScript project under `skills/last30flames`:

```bash
cd skills/last30flames
bun install
bun run scripts/index.ts "AI coding agents" --days 30
```

Progress prints to stderr; the numbered research context prints to stdout, so you
can pipe it (`> context.md`) or let the agent read it.

## Layout

```
.claude-plugin/        plugin.json + marketplace.json (distribution)
skills/last30flames/
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
