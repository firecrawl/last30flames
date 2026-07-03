// lobsters.ts
// Honest engagement signal #3. Lobste.rs publishes scores and comment counts
// openly through its public JSON feeds - no key, no login, no scraping.
// There is no keyword-search JSON endpoint, so we page /newest.json through
// the recency window and filter by topic ourselves.

import type { Source } from "./types";

// Each /newest page holds 25 stories (~a day of submissions), so 60 pages
// comfortably covers a 30-day window with headroom; it caps a 365-day ask.
const MAX_PAGES = 60;
const PAGE_BATCH = 5; // fetch a few pages at a time, stop once past the cutoff

type LobstersStory = {
  short_id: string;
  created_at: string;
  title: string;
  url: string;
  comments_url: string;
  score: number;
  comment_count: number;
  description_plain: string;
  tags: string[];
};

// Takes the queries of every side at once (one string[] per side) and sweeps
// the feed exactly once per run, filtering per side locally - a comparison
// must not re-fetch the same ~35 /newest pages once per side. Returns one
// Source[] per side, in the same order.
export async function searchLobsters(perSideQueries: string[][], days: number): Promise<Source[][]> {
  const empty = perSideQueries.map(() => [] as Source[]);
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Tokens worth matching on, kept separate per query so one query's common
    // word ("editor") can't match on behalf of another. Drop tiny glue words
    // like "of", "vs".
    const sideTokenSets = perSideQueries.map((queries) =>
      queries
        .map((q) => q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3))
        .filter((tokens) => tokens.length > 0),
    );
    if (sideTokenSets.every((tokenSets) => tokenSets.length === 0)) return empty;

    const stories: LobstersStory[] = [];
    let pastCutoff = false;
    for (let page = 1; page <= MAX_PAGES && !pastCutoff; page += PAGE_BATCH) {
      const batch = await Promise.all(
        Array.from({ length: PAGE_BATCH }, async (_, i) => {
          const res = await fetch(`https://lobste.rs/newest/page/${page + i}.json`);
          if (!res.ok) return [];
          return (await res.json()) as LobstersStory[];
        }),
      );
      for (const pageStories of batch) {
        stories.push(...pageStories);
        // Feeds are newest-first, so once a page ends before the cutoff
        // every later page is older too - stop paging.
        const last = pageStories[pageStories.length - 1];
        if (pageStories.length === 0 || (last && Date.parse(last.created_at) < cutoff)) {
          pastCutoff = true;
        }
      }
    }

    // Keep stories in the window that mention a query, preferring stories
    // that match more of that query's words, then higher scores. Match and
    // rank per query (top 5 each, like the other sources) rather than over
    // the union of all queries' tokens, so a common word from one query
    // can't flood the picks; merge by story id afterwards.
    const inWindow = stories.filter((s) => Date.parse(s.created_at) >= cutoff);
    // Whole-word match so "rust" doesn't hit "trust" or "frustration".
    const hit = (haystack: string, t: string) =>
      new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);

    return sideTokenSets.map((tokenSets) => {
      const picked = new Map<string, LobstersStory>();
      for (const tokens of tokenSets) {
        const matched = inWindow
          .map((s) => {
            const haystack = `${s.title} ${s.tags.join(" ")} ${s.description_plain}`.toLowerCase();
            return { story: s, hits: tokens.filter((t) => hit(haystack, t)).length };
          })
          .filter((m) => m.hits > 0)
          .sort((a, b) => b.hits - a.hits || b.story.score - a.story.score)
          .slice(0, 5);
        for (const { story } of matched) picked.set(story.short_id, story);
      }

      return [...picked.values()].map((story) => ({
        origin: "lobsters" as const,
        title: story.title,
        url: story.url || story.comments_url,
        // The honest numbers, surfaced for the synthesis step.
        signal: `${story.score} points, ${story.comment_count} comments`,
        content: story.description_plain || story.title,
      }));
    });
  } catch (err) {
    // One source failing must never crash the run; degrade to no Lobste.rs results.
    console.error(`[lobsters] skipped: ${err instanceof Error ? err.message : err}`);
    return empty;
  }
}
