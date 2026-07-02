# last30flames - project constraints

## Data sources (hard rule)

This project must only gather data through:

- The **Firecrawl CLI** (web search + full-page content).
- **Open, public APIs that publish engagement numbers openly** and permit this use, currently the Hacker News Algolia API and the official GitHub API.

Never add sources that scrape or access **Reddit, X/Twitter, TikTok, Instagram, or any platform behind a login, cookie, or whose Terms of Service such access may violate**.
If a proposed feature needs such a source, the answer is no - reframe it around Firecrawl search of the open web instead.
This rule is also stated in `skills/last30flames/SKILL.md` (the runtime copy) - keep the two in sync if either changes.

## Design principles

- The engine gathers and prints a numbered research context; it never calls an LLM. The agent harness running the skill does the synthesis.
- Keyless by default. `FIRECRAWL_API_KEY` and `GITHUB_TOKEN` are optional rate-limit upgrades, never requirements.
- The skill must work in any agent harness that supports skills - avoid harness-specific assumptions in the engine or SKILL.md.

## Layout

- `skills/last30flames/SKILL.md` - agent-facing instructions.
- `skills/last30flames/scripts/` - the Bun + TypeScript engine, one small file per job.
