---
name: last30flames
description: "Research what's genuinely new about a topic in a recent time window. Use when the user asks what's new, recent, or trending on a subject and wants a source-grounded brief rather than a quick lookup."
argument-hint: 'last30flames AI coding agents | last30flames local LLM inference --days 7'
allowed-tools: Bash, Read
user-invocable: true
homepage: https://github.com/firecrawl/last30flames
repository: https://github.com/firecrawl/last30flames
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
    - lobsters
    - bluesky
    - github
    - citations
---

# last30flames

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

Five sources run in parallel:

- **Firecrawl Search** - web results scraped into full-page markdown, not snippets.
- **Hacker News** (public Algolia API) - points + comment counts.
- **Lobste.rs** (public JSON feeds) - points + comment counts.
- **Bluesky** (public AT Protocol API) - likes + reposts + replies.
- **GitHub** (official API) - stars + recent push activity.

Engagement numbers come only from APIs that publish them openly. The skill never
touches Reddit, X, TikTok, Instagram, or anything behind a login or cookie.

## Run the engine

This works in any agent harness that supports skills. You already know the
absolute path of this `SKILL.md` because you just read it; call `scripts/run.sh`
next to it. It self-locates, installs deps on first run,
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

## Resolve ambiguous topics first (recommended)

If the topic could point at more than one thing - a person's name, a product
that shares a name with something common ("Apple", "Cursor"), a bare handle -
run a cheap resolution pass before the main gather:

```bash
bash <SKILL_DIR>/scripts/run.sh --resolve "<TOPIC>"
```

It prints candidate identities (web titles + descriptions, GitHub repo and user
candidates) without scraping any pages. Read them and decide:

- **2-4 refined subqueries** that pin down the intended entity (e.g. for
  "Cursor" the AI editor: `"Cursor AI editor"`, `"Cursor IDE agent"`).
  Each subquery multiplies the Firecrawl search/scrape work, so runtime scales
  with query count - use the fewest that pin down the entity, usually 2.
- If the topic is a **person or project**, the matching **GitHub login** and/or
  **owner/name repo**.

Then run the main gather with those, passing `--query` once per subquery:

```bash
bash <SKILL_DIR>/scripts/run.sh "<TOPIC>" --days 30 \
  --query "<subquery 1>" --query "<subquery 2>" \
  --github-user <login> --github-repo <owner/name>
```

The engine searches the web, Hacker News, Lobste.rs, and Bluesky with each
subquery (up to 4, deduplicating overlapping results), and scopes GitHub to the
given login/repo. All flags are optional - a clear, specific topic can skip
resolution entirely and run one-shot as before. The resolution pass never
decides anything itself; you do.

## Comparison topics ("X vs Y")

When the topic pits two or three things against each other ("cursor vs zed",
"bun versus deno"), the engine runs a full gather per side in one pass and
groups the research context per side, with continuous citation numbering.

A topic containing "vs"/"versus" auto-splits, so the simple form just works
(all-caps "VS" is ignored, so topics like "best VS Code extensions" stay a
single side; use `--compare` to compare things whose names contain "VS"):

```bash
bash <SKILL_DIR>/scripts/run.sh "cursor vs zed" --days 30
```

The web-scrape budget (`--limit`) is shared across sides, so each side of a
comparison scrapes fewer pages than a dedicated run would; pass a higher
`--limit` (e.g. `--limit 10` for two sides) when you want full per-side depth.

For sharper sides, pass `--compare` once per side; any `--query`,
`--github-user`, or `--github-repo` flags that follow a `--compare` scope to
that side (run `--resolve` per side first if a name is ambiguous):

```bash
bash <SKILL_DIR>/scripts/run.sh "cursor vs zed" \
  --compare "Cursor" --query "Cursor AI editor" --github-repo getcursor/cursor \
  --compare "Zed" --query "Zed editor" --github-repo zed-industries/zed
```

Synthesize a side-by-side brief from the grouped context: what moved for each
side in the window, then a direct comparison (traction via the engagement
numbers, notable shipping activity, best-for). Cite both sides inline as
usual; the numbering never collides because it is continuous across sides.

## Save & reuse the context (optional)

By default, do not write any files - just synthesize the brief. Only save when
the user asks (e.g. "save the context", "I'll want this again later").

Saved contexts live under `~/.last30flames/`, grouped into **thread folders** so a
run of related calls can be reloaded as one set. A thread is just a named
subdirectory; each call saves its own file, which keeps every call's `[1]`, `[2]`
citation numbering intact (never concatenate two contexts into one file - the
numbering would collide):

```
~/.last30flames/<thread>/
  <slug>-<YYYY-MM-DD>.md      # one file per engine call
```

**On save:** redirect the engine's stdout so the *raw numbered research context* is
preserved (that is the reusable evidence - not the brief). Pick the thread folder
first:

- If the user names a thread ("save this to my ai-agents research"), slugify it as
  `<thread>`.
- Otherwise reuse the thread from earlier saves in this same conversation, so
  related calls land together.
- If neither applies, derive `<thread>` from the topic and tell the user the name
  you chose so they can reference it later.

Derive `<slug>` by slugifying the topic (lowercase, spaces to hyphens, drop
punctuation) so the filename tells you what the call was about. Then create the
folder and write the file, and report the exact path afterward:

```bash
mkdir -p ~/.last30flames/<thread>
bash <SKILL_DIR>/scripts/run.sh "<TOPIC>" --days 30 > ~/.last30flames/<thread>/<slug>-<YYYY-MM-DD>.md
```

Because the redirect sends the research context to the file instead of stdout,
the Bash output shows only stderr progress. If the user also wants the brief this
session, `Read` the saved file first to get the context, then synthesize as usual.

If the user explicitly names a different path, honor it instead.

**On reuse (a later session):** the user need not recall exact names. If they
reference saved research even loosely ("load my ai-agents research"), list the
thread folders under `~/.last30flames/` and match on the thread name; then `Read`
**every** `.md` file in that folder and synthesize across all of them, keeping
citations namespaced by source file so numbers from different calls don't clash.
To reload a single call rather than the whole thread, match one file by its
`<slug>-<date>` name. If nothing matches, ask where they saved it.

Because each filename is `<slug>-<YYYY-MM-DD>.md`, both topic and save date are
recoverable from the name alone - no external memory needed. Before synthesizing,
check each file's date against the `--days` window: if today is more than that many
days past the saved date, the recency claim no longer holds - warn the user that
context is stale and offer to re-run fresh.

Reuse-shaped prompts to handle this way (do not re-run the engine):

```
last30flames load my ai-agents research
last30flames using my saved ai-agents research, what did I find on local inference?
```

## Write the brief

From the numbered sources, write a few tight paragraphs that:

- **Lead with what is genuinely new or moving** in the window. Not background.
- **Ground every claim in the sources and cite inline** like `[1]`, `[3]`.
- **Use the engagement numbers** (HN points/comments, GitHub stars) as a signal
  of what people actually care about - weight high-engagement items.
- **Say plainly where evidence is thin** rather than inventing detail. If HN or
  GitHub returned little, that honesty is part of the answer.

After the brief, end with a compact **Sources** list so every inline citation is
clickable. One line per source you actually cited, keeping the same numbers used
inline, as markdown links:

```
Sources:
[1] [Title of the page](https://example.com/article) - example.com
[3] [Show HN: Something](https://news.ycombinator.com/item?id=123) - news.ycombinator.com
```

List only cited sources - this is a reference list for the reader, not a dump of
the research context. Never paste the raw research context back.

## Shareable HTML brief (optional)

When the user asks for a shareable version of the brief ("make this shareable", "give me an HTML file", "something I can drop in Slack/email/Notion"), emit the synthesis as a self-contained dark-mode HTML file alongside the normal chat response.
The file has inline CSS, no JavaScript, and no external assets, so it works offline and renders the same everywhere.

First write the brief you synthesized - including its `Sources:` list with the same numbering - as markdown into the thread folder, picking `<thread>` and `<slug>` exactly as in the save flow above:

```bash
mkdir -p ~/.last30flames/<thread>
# Write the brief markdown to ~/.last30flames/<thread>/<slug>-<YYYY-MM-DD>-brief.md
bun <SKILL_DIR>/scripts/htmlify.ts ~/.last30flames/<thread>/<slug>-<YYYY-MM-DD>-brief.md
```

The converter turns headings, paragraphs, lists, links, and inline `[N]` citations into HTML - each citation becomes a clickable jump to its entry in the Sources list - writes `<slug>-<YYYY-MM-DD>-brief.html` next to the markdown, and prints the output path.
Report that path to the user.
If the user names a different output location, pass it with `-o <path>`.

This converts your synthesized brief, not the raw research context - never htmlify the engine's stdout.
