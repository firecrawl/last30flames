// index.ts
// CLI entry point. Reads the topic (and an optional --days window), kicks off
// all three data sources in parallel, hands the bundle to Claude, and prints
// the brief. Progress lines are printed as we go so the demo narrates itself.
//
//   bun run src/index.ts "AI coding agents"
//   bun run src/index.ts "local LLM inference" --days 7

import { searchWeb } from "./firecrawl";
import { searchHackerNews } from "./hackernews";
import { searchGitHub } from "./github";
import { formatBundle } from "./format";

// Tiny hand-rolled arg parse: everything that isn't --days is the topic.
// (No CLI library - the spec wants the dependency list to stay at two.)
const args = process.argv.slice(2);

const daysFlag = args.indexOf("--days");
// Validate --days: reject NaN (fall back to 30) and clamp to a sane 1-365 window
// so negatives, zero, and absurd values can't produce a broken or empty range.
const DEFAULT_DAYS = 30;
let days = DEFAULT_DAYS;
if (daysFlag !== -1) {
  const parsed = Number(args[daysFlag + 1]);
  if (Number.isNaN(parsed)) {
    console.error(`Could not parse --days; using default ${DEFAULT_DAYS}.`);
  } else {
    days = Math.min(365, Math.max(1, Math.floor(parsed)));
    if (days !== parsed) console.error(`Clamped --days to ${days} (allowed range 1-365).`);
  }
}

const limitFlag = args.indexOf("--limit");
// Optional --limit controls how many web results we scrape (default 5 for the demo).
const DEFAULT_LIMIT = 5;
let limit = DEFAULT_LIMIT;
if (limitFlag !== -1) {
  const parsed = Number(args[limitFlag + 1]);
  if (Number.isNaN(parsed)) {
    console.error(`Could not parse --limit; using default ${DEFAULT_LIMIT}.`);
  } else {
    limit = Math.min(20, Math.max(1, Math.floor(parsed)));
    if (limit !== parsed) console.error(`Clamped --limit to ${limit} (allowed range 1-20).`);
  }
}

// Drop the flags and their values; everything else is the topic.
const flagIndices = new Set<number>();
for (const flag of [daysFlag, limitFlag]) {
  if (flag !== -1) {
    flagIndices.add(flag);
    flagIndices.add(flag + 1);
  }
}
const topic = args.filter((_, i) => !flagIndices.has(i)).join(" ").trim();

if (!topic) {
  console.error('Usage: bun run src/index.ts "your topic" [--days 30] [--limit 5]');
  process.exit(1);
}

// Progress goes to stderr so stdout stays pure research context that the
// agent (or a pipe) can capture cleanly.
console.error(`Researching "${topic}" over the last ${days} days...`);

// All three sources run at once so the demo feels fast. Each logs when it lands.
// Each source already catches its own errors and returns []; allSettled is a
// belt-and-suspenders backstop so one rejection can never sink the whole run.
const settled = await Promise.allSettled([
  searchWeb(topic, days, limit).then((r) => (console.error("✓ Searched the web"), r)),
  searchHackerNews(topic, days).then((r) => (console.error("✓ Checked Hacker News"), r)),
  searchGitHub(topic, days).then((r) => (console.error("✓ Checked GitHub"), r)),
]);
const [web, hn, github] = settled.map((s) =>
  s.status === "fulfilled" ? s.value : [],
) as [Awaited<ReturnType<typeof searchWeb>>, Awaited<ReturnType<typeof searchHackerNews>>, Awaited<ReturnType<typeof searchGitHub>>];

// Print the research context. The agent harness reads this and writes the
// final brief - this tool deliberately does no LLM synthesis itself.
console.log(formatBundle({ topic, days, sources: [...web, ...hn, ...github] }));
