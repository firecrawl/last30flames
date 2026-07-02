// index.ts
// CLI entry point. Reads the topic (and an optional --days window), kicks off
// all five data sources in parallel, hands the bundle to Claude, and prints
// the brief. Progress lines are printed as we go so the demo narrates itself.
//
//   bun run src/index.ts "AI coding agents"
//   bun run src/index.ts "local LLM inference" --days 7
//
// Two-step flow for ambiguous topics (people, products, generic names):
//
//   bun run src/index.ts --resolve "simonw"          # print candidate identities
//   bun run src/index.ts "simonw" \
//     --query "Simon Willison llm" --query "datasette" \
//     --github-user simonw                            # gather with refined queries

import { searchWeb } from "./firecrawl";
import { searchHackerNews } from "./hackernews";
import { searchLobsters } from "./lobsters";
import { searchBluesky } from "./bluesky";
import { searchGitHub } from "./github";
import { resolveTopic } from "./resolve";
import { formatBundle } from "./format";
import type { Source } from "./types";

// Tiny hand-rolled arg parse: everything that isn't a known flag is the topic.
// (No CLI library - the spec wants the dependency list to stay at two.)
const args = process.argv.slice(2);

const DEFAULT_DAYS = 30;
const DEFAULT_LIMIT = 5;
const MAX_QUERIES = 4;

let days = DEFAULT_DAYS;
let limit = DEFAULT_LIMIT;
let resolveMode = false;
let githubUser = "";
let githubRepo = "";
const queries: string[] = [];
const topicParts: string[] = [];

// Validate numeric flags: reject NaN (fall back to the default) and clamp to
// a sane window so negatives, zero, and absurd values can't break the run.
function parseClamped(raw: string | undefined, name: string, def: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    console.error(`Could not parse ${name}; using default ${def}.`);
    return def;
  }
  const clamped = Math.min(max, Math.max(min, Math.floor(parsed)));
  if (clamped !== parsed) console.error(`Clamped ${name} to ${clamped} (allowed range ${min}-${max}).`);
  return clamped;
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  switch (arg) {
    case "--resolve":
      resolveMode = true;
      break;
    case "--days":
      days = parseClamped(args[++i], "--days", DEFAULT_DAYS, 1, 365);
      break;
    case "--limit":
      limit = parseClamped(args[++i], "--limit", DEFAULT_LIMIT, 1, 20);
      break;
    case "--query": {
      const q = (args[++i] ?? "").trim();
      if (q) queries.push(q);
      else console.error("Ignoring empty --query.");
      break;
    }
    case "--github-user":
      githubUser = (args[++i] ?? "").trim();
      break;
    case "--github-repo": {
      githubRepo = (args[++i] ?? "").trim();
      if (githubRepo && !/^[^/\s]+\/[^/\s]+$/.test(githubRepo)) {
        console.error(`Ignoring --github-repo "${githubRepo}" (expected owner/name).`);
        githubRepo = "";
      }
      break;
    }
    default:
      topicParts.push(arg);
  }
}

const topic = topicParts.join(" ").trim();

if (!topic) {
  console.error(
    'Usage: bun run src/index.ts "your topic" [--days 30] [--limit 5]\n' +
      '       [--query "refined subquery"]... [--github-user login] [--github-repo owner/name]\n' +
      '       bun run src/index.ts --resolve "your topic"',
  );
  process.exit(1);
}

// Resolution mode: print candidate identities for the topic and exit. The
// agent reads this, derives refined subqueries, and re-runs the main gather.
if (resolveMode) {
  console.error(`Resolving "${topic}"...`);
  console.log(await resolveTopic(topic));
  process.exit(0);
}

if (queries.length > MAX_QUERIES) {
  console.error(`Keeping the first ${MAX_QUERIES} --query values (${queries.length} given).`);
  queries.length = MAX_QUERIES;
}
// No refined subqueries means the raw topic is the single query - the
// original one-shot behaviour is unchanged.
const effectiveQueries = queries.length ? queries : [topic];

// Progress goes to stderr so stdout stays pure research context that the
// agent (or a pipe) can capture cleanly.
console.error(
  `Researching "${topic}" over the last ${days} days` +
    (queries.length ? ` via ${queries.length} refined queries` : "") +
    "...",
);

// Split the web-scrape budget across the refined queries so expansion widens
// coverage without multiplying full-page scrapes.
const perQueryLimit = Math.max(2, Math.ceil(limit / effectiveQueries.length));

// All five sources run at once so the demo feels fast. Search-backed sources
// fan out over every refined query; Lobste.rs filters locally over its recent
// feed, so it runs once with all query words (avoids re-paging the feed).
// Each source already catches its own errors and returns []; allSettled is a
// belt-and-suspenders backstop so one rejection can never sink the whole run.
const fanOut = (search: (q: string, d: number) => Promise<Source[]>) =>
  Promise.all(effectiveQueries.map((q) => search(q, days))).then((r) => r.flat());

const settled = await Promise.allSettled([
  fanOut((q, d) => searchWeb(q, d, perQueryLimit)).then((r) => (console.error("✓ Searched the web"), r)),
  fanOut(searchHackerNews).then((r) => (console.error("✓ Checked Hacker News"), r)),
  searchLobsters(effectiveQueries.join(" "), days).then((r) => (console.error("✓ Checked Lobste.rs"), r)),
  fanOut(searchBluesky).then((r) => (console.error("✓ Checked Bluesky"), r)),
  searchGitHub(topic, days, { user: githubUser || undefined, repo: githubRepo || undefined }).then(
    (r) => (console.error("✓ Checked GitHub"), r),
  ),
]);
const gathered = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));

// Refined queries overlap on purpose, so drop duplicate URLs before numbering.
const seen = new Set<string>();
const sources = gathered.filter((s) => !seen.has(s.url) && (seen.add(s.url), true));

// Print the research context. The agent harness reads this and writes the
// final brief - this tool deliberately does no LLM synthesis itself.
console.log(formatBundle({ topic, days, queries: queries.length ? queries : undefined, sources }));
