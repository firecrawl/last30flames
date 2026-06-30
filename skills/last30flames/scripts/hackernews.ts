// hackernews.ts
// Honest engagement signal #1. Hacker News publishes points and comment
// counts openly through Algolia's public search API - no key, no login,
// no scraping. We just ask for recent stories on the topic.

import type { Source } from "./types";

export async function searchHackerNews(topic: string, days: number): Promise<Source[]> {
  try {
    // Algolia lets us filter by created_at as a Unix timestamp.
    // Build the cutoff for "N days ago" so we only see recent discussion.
    const cutoff = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
    url.searchParams.set("query", topic);
    url.searchParams.set("tags", "story");
    url.searchParams.set("numericFilters", `created_at_i>${cutoff}`);
    url.searchParams.set("hitsPerPage", "5");

    // Bun's built-in fetch - no HTTP library needed.
    const res = await fetch(url);
    const data = (await res.json()) as any;

    return (data.hits ?? []).map((hit: any) => ({
      origin: "hackernews" as const,
      title: hit.title ?? "(untitled)",
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      // The honest numbers, surfaced for the synthesis step.
      signal: `${hit.points ?? 0} points, ${hit.num_comments ?? 0} comments`,
      content: hit.title ?? "",
    }));
  } catch (err) {
    // One source failing must never crash the run; degrade to no HN results.
    console.error(`[hackernews] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
