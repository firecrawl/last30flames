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
//
// Comparison mode for "X vs Y" topics: each side gets its own full gather
// (web, HN, Lobste.rs, Bluesky, GitHub) in one pass, and the context is
// grouped per side. Sides come from splitting the topic on "vs"/"versus",
// or explicitly via repeated --compare flags. --query / --github-user /
// --github-repo given AFTER a --compare flag scope to that side:
//
//   bun run src/index.ts "cursor vs zed" \
//     --compare "Cursor" --query "Cursor AI editor" --github-repo getcursor/cursor \
//     --compare "Zed"    --query "Zed editor"       --github-repo zed-industries/zed

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
const MAX_SIDES = 3;

let days = DEFAULT_DAYS;
let limit = DEFAULT_LIMIT;
let resolveMode = false;
const topicParts: string[] = [];

// One side of the research. A normal run is the degenerate case of exactly
// one side whose name is the whole topic; comparison mode is two or more.
type Side = { name: string; queries: string[]; githubUser: string; githubRepo: string };

const newSide = (name: string): Side => ({ name, queries: [], githubUser: "", githubRepo: "" });

// Flags that scope to a side (--query, --github-user, --github-repo) attach
// to the most recent --compare, or to the top-level bucket when no --compare
// has been seen yet.
const topLevel = newSide("");
const compares: Side[] = [];
const currentSide = () => compares[compares.length - 1] ?? topLevel;

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
    case "--compare": {
      const name = (args[++i] ?? "").trim();
      if (name) compares.push(newSide(name));
      else console.error("Ignoring empty --compare.");
      break;
    }
    case "--query": {
      const q = (args[++i] ?? "").trim();
      if (q) currentSide().queries.push(q);
      else console.error("Ignoring empty --query.");
      break;
    }
    case "--github-user": {
      const u = (args[++i] ?? "").trim();
      if (u) currentSide().githubUser = u;
      else console.error("Ignoring empty --github-user.");
      break;
    }
    case "--github-repo": {
      const r = (args[++i] ?? "").trim();
      if (r && !/^[^/\s]+\/[^/\s]+$/.test(r)) {
        console.error(`Ignoring --github-repo "${r}" (expected owner/name).`);
      } else if (r) {
        currentSide().githubRepo = r;
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
      "       (--limit is per-run but approximate with multiple --query flags: each query scrapes at least 2 pages)\n" +
      '       Comparison: [--compare "side"]... with per-side --query/--github-* after each --compare,\n' +
      '       or just a topic containing "vs" (e.g. "cursor vs zed").\n' +
      '       bun run src/index.ts --resolve "your topic"',
  );
  process.exit(1);
}

// Resolution mode: print candidate identities for the topic and exit. The
// agent reads this, derives refined subqueries, and re-runs the main gather.
if (resolveMode) {
  const flagsGiven =
    compares.length || topLevel.queries.length || topLevel.githubUser || topLevel.githubRepo ||
    days !== DEFAULT_DAYS || limit !== DEFAULT_LIMIT;
  if (flagsGiven) {
    console.error("--resolve only takes a topic; ignoring the other flags.");
  }
  console.error(`Resolving "${topic}"...`);
  console.log(await resolveTopic(topic));
  process.exit(0);
}

// Work out the sides. Explicit --compare flags win; otherwise a topic
// containing "vs"/"versus" auto-splits into one side per segment. A plain
// topic is a single side, which keeps the original one-shot behaviour.
let sides: Side[];
if (compares.length >= 2) {
  sides = compares;
} else {
  if (compares.length === 1) {
    console.error("--compare needs at least two sides; folding it into a normal run.");
    topLevel.queries.push(...compares[0]!.queries);
    topLevel.githubUser ||= compares[0]!.githubUser;
    topLevel.githubRepo ||= compares[0]!.githubRepo;
  }
  const split = topic.split(/\s+(?:vs\.?|versus)\s+/i).map((s) => s.trim()).filter(Boolean);
  if (split.length >= 2) {
    // Auto-split comparison. Top-level scoping flags are ambiguous here (which
    // side would they belong to?), so they are dropped with a pointer to the
    // explicit form rather than silently applied to every side.
    if (topLevel.queries.length || topLevel.githubUser || topLevel.githubRepo) {
      console.error(
        'Topic looks like a comparison; ignoring top-level --query/--github-* flags. ' +
          'Use --compare "<side>" followed by that side\'s flags to scope them.',
      );
    }
    sides = split.map(newSide);
  } else {
    topLevel.name = topic;
    sides = [topLevel];
  }
}

if (sides.length > MAX_SIDES) {
  console.error(`Keeping the first ${MAX_SIDES} sides (${sides.length} given).`);
  sides.length = MAX_SIDES;
}

const comparison = sides.length > 1;
let refinedCount = 0;
for (const side of sides) {
  if (side.queries.length > MAX_QUERIES) {
    console.error(
      `Keeping the first ${MAX_QUERIES} --query values for "${side.name}" (${side.queries.length} given).`,
    );
    side.queries.length = MAX_QUERIES;
  }
  refinedCount += side.queries.length;
}

// Progress goes to stderr so stdout stays pure research context that the
// agent (or a pipe) can capture cleanly.
console.error(
  comparison
    ? `Comparing ${sides.map((s) => `"${s.name}"`).join(" vs ")} over the last ${days} days` +
        (refinedCount ? ` via ${refinedCount} refined queries` : "") +
        "..."
    : `Researching "${topic}" over the last ${days} days` +
        (refinedCount ? ` via ${refinedCount} refined queries` : "") +
        "...",
);

// One full gather per side. All sides and all sources run at once so the
// comparison is a single pass, not serial per-entity runs. Search-backed
// sources fan out over that side's refined queries (falling back to the side
// name); Lobste.rs filters locally over its recent feed, so it takes all of a
// side's queries in one call. Each source already catches its own errors and
// returns []; allSettled is a belt-and-suspenders backstop so one rejection
// can never sink the whole run.
async function gatherSide(side: Side): Promise<Source[]> {
  const sideQueries = side.queries.length ? side.queries : [side.name];
  // Split the web-scrape budget across sides, then across each side's
  // refined queries. The floor of 2 per query means the budget is
  // approximate: a two-side comparison with two refined queries per side and
  // the default limit of 5 may scrape up to 8 pages (2 per query), which the
  // keyless tier handles fine.
  const perQueryLimit = Math.max(2, Math.ceil(limit / sides.length / sideQueries.length));
  const tag = comparison ? `[${side.name}] ` : "";

  const fanOut = (search: (q: string, d: number) => Promise<Source[]>) =>
    Promise.all(sideQueries.map((q) => search(q, days))).then((r) => r.flat());

  const settled = await Promise.allSettled([
    fanOut((q, d) => searchWeb(q, d, perQueryLimit)).then((r) => (console.error(`✓ ${tag}Searched the web`), r)),
    fanOut(searchHackerNews).then((r) => (console.error(`✓ ${tag}Checked Hacker News`), r)),
    searchLobsters(sideQueries, days).then((r) => (console.error(`✓ ${tag}Checked Lobste.rs`), r)),
    fanOut(searchBluesky).then((r) => (console.error(`✓ ${tag}Checked Bluesky`), r)),
    searchGitHub(side.name, days, {
      user: side.githubUser || undefined,
      repo: side.githubRepo || undefined,
    }).then((r) => (console.error(`✓ ${tag}Checked GitHub`), r)),
  ]);
  const found = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  // Tag each source with its side so formatting can group the context per
  // entity. Single-side runs stay untagged and format exactly as before.
  return comparison ? found.map((s) => ({ ...s, entity: side.name })) : found;
}

const gathered = (await Promise.all(sides.map(gatherSide))).flat();

// Refined queries overlap on purpose, so drop duplicate URLs before numbering.
// The key is scoped by side and origin: dedupe only collapses the same URL
// found twice WITHIN a source (query overlap), never across sources - a page
// that shows up in both web search and Hacker News carries different
// information each time (full content vs. engagement signal), and a pinned
// GitHub repo must never lose to a scraped copy of its page. The same URL
// surfacing for both sides of a comparison is kept too - that overlap is
// itself signal. Normalise lightly (drop the fragment and a trailing slash)
// so trivially different URLs still collapse; keep the query string, which
// can be meaningful.
const dedupeKey = (s: Source) => {
  try {
    const u = new URL(s.url);
    u.hash = "";
    u.pathname = u.pathname.replace(/\/$/, "");
    return `${s.entity ? `${s.entity} ` : ""}${s.origin} ${u}`;
  } catch {
    return `${s.entity ? `${s.entity} ` : ""}${s.origin} ${s.url}`;
  }
};
const seen = new Set<string>();
const sources = gathered.filter((s) => {
  const key = dedupeKey(s);
  return !seen.has(key) && (seen.add(key), true);
});

// Print the research context. The agent harness reads this and writes the
// final brief - this tool deliberately does no LLM synthesis itself.
console.log(
  formatBundle({
    topic,
    days,
    queries: refinedCount ? sides.flatMap((s) => s.queries) : undefined,
    entities: comparison ? sides.map((s) => s.name) : undefined,
    sources,
  }),
);
