# Contributing to last30flames

Thanks for your interest in improving last30flames. This is a small project - a
thin Bun + TypeScript engine plus a skill that drives an agent's synthesis - so
contributions stay lightweight.

## Ways to contribute

- **Bug reports.** Open an issue with the topic and `--days` you ran, the command,
  and what you expected versus what happened. Include stderr output if the engine
  errored.
- **Fixes and features.** Small, focused pull requests are easiest to review.
- **Docs.** `SKILL.md` drives agent behavior and `README.md` is for humans - keep
  the two consistent when you change one.

## Development setup

The engine lives under `skills/last30flames`:

```bash
cd skills/last30flames
bun install
bun run scripts/index.ts "AI coding agents" --days 30
```

The only hard requirement is the `bun` binary. No API key is needed - the
Firecrawl CLI runs on a keyless free tier. Set `FIRECRAWL_API_KEY` or
`GITHUB_TOKEN` only for higher rate limits.

Progress prints to stderr; the numbered research context prints to stdout.

## Conventions

- Keep each engine file small and single-purpose (see the Layout section in the
  README) - one file per job.
- The engine never calls an LLM; synthesis is the agent's job. Keep that boundary.
- Only gather engagement signals from APIs that publish them openly. Do not add
  sources behind a login or cookie.
- When you edit `SKILL.md`, verify placeholders (`<SKILL_DIR>`, `<thread>`,
  `<slug>`) stay defined and consistent with how the agent is told to use them.

## Pull requests

1. Fork and branch off `main`.
2. Make your change and confirm the engine still runs end to end.
3. Open a PR describing what changed and why. Link any related issue.

By contributing, you agree that your contributions are licensed under the
[MIT License](LICENSE).
