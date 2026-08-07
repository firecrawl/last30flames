// types.ts
// A couple of tiny shared shapes used across the tool.
// Kept deliberately small: just enough to pass data from the
// "gather" steps into the "synthesize" step without guessing.

// One piece of evidence we hand to Claude. Everything we collect
// (web pages, Hacker News stories, Lobste.rs stories, Bluesky posts,
// GitHub repos) is
// flattened into this same shape so the synthesis prompt only has to
// understand one thing.
export type Source = {
  origin: "web" | "hackernews" | "lobsters" | "bluesky" | "github"; // where it came from
  title: string;
  url: string;
  // Free-text engagement / freshness signal, already humanised,
  // e.g. "120 points, 45 comments" or "1.2k stars, pushed 2026-06-20".
  signal?: string;
  // The actual content we feed the model. For web results this is the
  // full page markdown from Firecrawl; for HN/GitHub it's a short blurb.
  content: string;
  // Which side of a comparison this source belongs to ("Cursor" in a
  // "Cursor vs Zed" run). Absent on normal single-topic runs.
  entity?: string;
};

// Everything the sources found, bundled for synthesis.
export type ResearchBundle = {
  topic: string;
  days: number; // the "last N days" window the user asked for
  // Refined subqueries from the pre-research resolution pass, when the agent
  // ran one. Absent means the raw topic was searched directly.
  queries?: string[];
  // Comparison-mode side names, in gather order. Present only when the run
  // compared two or more entities; formatting then groups sources per side.
  entities?: string[];
  sources: Source[];
};
