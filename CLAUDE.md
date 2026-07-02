# last30flames - project constraints

## Data sources (hard rule)

This project must only gather data through:

- The **Firecrawl CLI** (web search + full-page content).
- **Open, public APIs that publish engagement numbers openly** and permit this use, currently the Hacker News Algolia API, the Lobste.rs JSON feeds, the Bluesky AT Protocol API, and the official GitHub API.

Never add sources that scrape or access **Reddit, X/Twitter, TikTok, Instagram, or any platform behind a login, cookie, or whose Terms of Service such access may violate**.
If a proposed feature needs such a source, the answer is no - reframe it around Firecrawl search of the open web instead.
This rule is also stated in `skills/last30flames/SKILL.md` (the runtime copy) - keep the two in sync if either changes.

## Design constraints

New features must preserve the design principles in the README: keyless by default (keys only raise rate limits), no LLM calls in the engine (the agent harness does the synthesis), and no harness-specific assumptions.
