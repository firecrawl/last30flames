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

export async function searchLobsters(topic: string, days: number): Promise<Source[]> {
  try {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // Topic tokens worth matching on; drop tiny glue words like "of", "vs".
    const tokens = topic.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
    if (tokens.length === 0) return [];

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

    // Keep stories in the window that mention the topic, preferring stories
    // that match more of its words, then higher scores.
    const matched = stories
      .filter((s) => Date.parse(s.created_at) >= cutoff)
      .map((s) => {
        const haystack = `${s.title} ${s.tags.join(" ")} ${s.description_plain}`.toLowerCase();
        // Whole-word match so "rust" doesn't hit "trust" or "frustration".
        const hit = (t: string) =>
          new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(haystack);
        return { story: s, hits: tokens.filter(hit).length };
      })
      .filter((m) => m.hits > 0)
      .sort((a, b) => b.hits - a.hits || b.story.score - a.story.score)
      .slice(0, 5);

    return matched.map(({ story }) => ({
      origin: "lobsters" as const,
      title: story.title,
      url: story.url || story.comments_url,
      // The honest numbers, surfaced for the synthesis step.
      signal: `${story.score} points, ${story.comment_count} comments`,
      content: story.description_plain || story.title,
    }));
  } catch (err) {
    // One source failing must never crash the run; degrade to no Lobste.rs results.
    console.error(`[lobsters] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
