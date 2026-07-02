// bluesky.ts
// Honest engagement signal #4, and the only social-chatter one. Bluesky's
// AT Protocol search endpoint is public and keyless for public posts, and it
// publishes likes/reposts/replies openly - no key, no login, no scraping.

import type { Source } from "./types";

type BlueskyPost = {
  uri: string; // at://did:plc:xxx/app.bsky.feed.post/rkey
  author: { handle: string; displayName?: string };
  record: { text?: string; createdAt?: string };
  replyCount?: number;
  repostCount?: number;
  likeCount?: number;
};

export async function searchBluesky(topic: string, days: number): Promise<Source[]> {
  try {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const url = new URL("https://api.bsky.app/xrpc/app.bsky.feed.searchPosts");
    url.searchParams.set("q", topic);
    // "top" ranks by engagement, so the first page is already the posts we want.
    url.searchParams.set("sort", "top");
    url.searchParams.set("since", cutoff.toISOString());
    url.searchParams.set("limit", "25");

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { posts?: BlueskyPost[] };

    // `since` filters on indexedAt, not createdAt, so re-check the window and
    // re-rank by total engagement before keeping the top few.
    const engagement = (p: BlueskyPost) =>
      (p.likeCount ?? 0) + (p.repostCount ?? 0) + (p.replyCount ?? 0);

    return (data.posts ?? [])
      .filter((p) => {
        const created = Date.parse(p.record?.createdAt ?? "");
        return !Number.isNaN(created) && created >= cutoff.getTime();
      })
      .sort((a, b) => engagement(b) - engagement(a))
      .slice(0, 5)
      .map((post) => {
        const rkey = post.uri.split("/").pop();
        const text = (post.record?.text ?? "").trim();
        return {
          origin: "bluesky" as const,
          // Posts have no title; use a trimmed first line of the text.
          title: `@${post.author.handle}: ${text.split("\n")[0]!.slice(0, 80) || "(no text)"}`,
          url: `https://bsky.app/profile/${post.author.handle}/post/${rkey}`,
          // The honest numbers, surfaced for the synthesis step.
          signal: `${post.likeCount ?? 0} likes, ${post.repostCount ?? 0} reposts, ${post.replyCount ?? 0} replies`,
          content: text,
        };
      });
  } catch (err) {
    // One source failing must never crash the run; degrade to no Bluesky results.
    console.error(`[bluesky] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
