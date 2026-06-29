// types.ts
// A couple of tiny shared shapes used across the tool.
// Kept deliberately small: just enough to pass data from the
// "gather" steps into the "synthesize" step without guessing.

// One piece of evidence we hand to Claude. Everything we collect
// (web pages, Hacker News stories, GitHub repos) is flattened into
// this same shape so the synthesis prompt only has to understand one thing.
export type Source = {
  origin: "web" | "hackernews" | "github"; // where it came from
  title: string;
  url: string;
  // Free-text engagement / freshness signal, already humanised,
  // e.g. "120 points, 45 comments" or "1.2k stars, pushed 2026-06-20".
  signal?: string;
  // The actual content we feed the model. For web results this is the
  // full page markdown from Firecrawl; for HN/GitHub it's a short blurb.
  content: string;
};

// Everything the three sources found, bundled for synthesis.
export type ResearchBundle = {
  topic: string;
  days: number; // the "last N days" window the user asked for
  sources: Source[];
};
