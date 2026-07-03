<div align="center">

# 🔥

# /last30flames

**An agent skill that researches what is actually new about any topic in a recent time window.**

No API keys required - works out of the box.

</div>

Works in any agent harness that supports skills.

> Inspired by [last30days](https://github.com/mvanhorn/last30days-skill) by Matt
> Van Horn.

It gathers five signals **in parallel** and hands them to the agent to write a
short, source-grounded brief:

- **Firecrawl Search** - web results scraped into full-page markdown, not snippets.
- **Hacker News** (public Algolia API) - points + comment counts.
- **Lobste.rs** (public JSON feeds) - points + comment counts.
- **Bluesky** (public AT Protocol API) - likes + reposts + replies.
- **GitHub** (official API) - stars + recent push activity.

Engagement numbers come only from APIs that publish them openly. The skill never
touches Reddit, X, TikTok, Instagram, or anything behind a login or cookie.

## Design principles

- **Small enough to read.** The engine is a handful of small TypeScript files
  with zero runtime dependencies. You can audit everything it runs on your
  machine in five minutes.
- **Keyless.** Works out of the box. Keys only raise rate limits, never unlock
  features.
- **Only open, permitted sources.** Firecrawl search of the public web, plus the
  official Hacker News, Lobste.rs, Bluesky, and GitHub APIs. Nothing behind a login, and
  nothing that violates a platform's terms of service.
- **No LLM in the engine.** It only gathers and prints sources; your agent does
  the synthesis. No second model, no extra bill.

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

### Ambiguous topics

For topics that could mean more than one thing (a person's name, "Apple",
"Cursor"), the skill first runs a cheap resolution pass - a snippet-only
Firecrawl search plus GitHub user/repo candidate lookups - then re-searches
with 2-4 refined subqueries and, for people and projects, scopes GitHub to the
matching login or repo. The engine only gathers candidates; the agent does the
disambiguating. Direct flags: `--query` (repeatable), `--github-user`,
`--github-repo owner/name`, and `--resolve` for the candidate pass.

### Comparisons

A topic like `cursor vs zed` runs a full gather per side in one pass and groups
the research context per side, so the brief can compare traction and shipping
activity directly.
Auto-splitting on "vs"/"versus" in any capitalization needs no flags (only
all-caps "VS" is exempt, so "best VS Code extensions" stays a single topic);
for ambiguous names, `--compare
"<side>"` declares each side explicitly, and any `--query`/`--github-user`/
`--github-repo` flags that follow scope to that side.
The web-scrape budget is shared across sides, so raise `--limit` when you want
full per-side depth.

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

### Shareable HTML brief

Ask for a shareable version and the skill writes the brief as a self-contained
dark-mode HTML file (inline CSS, no JavaScript, works offline) that drops
cleanly into Slack, email, or Notion:

```
/last30flames AI coding agents, give me a shareable HTML brief
```

Inline `[N]` citations become clickable jumps to the sources list. The file is
saved in the same thread folder under `~/.last30flames/` and the skill reports
the path.

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
  scripts/             the engine: one small file per job (entry point, one
                       module per source, formatting, launcher)
```
