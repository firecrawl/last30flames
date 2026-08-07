// format.test.ts
// Cross-source clustering: the same story found by web, HN, and GitHub must
// become one numbered entry carrying every source's engagement signal.

import { describe, expect, test } from "bun:test";
import { clusterSources, formatBundle } from "./format";
import type { Source } from "./types";

const web = (url: string, extra: Partial<Source> = {}): Source => ({
  origin: "web",
  title: "Big release",
  url,
  content: "Full page markdown with lots of detail about the release.",
  ...extra,
});

const hn = (url: string, extra: Partial<Source> = {}): Source => ({
  origin: "hackernews",
  title: "Big release",
  url,
  signal: "120 points, 45 comments",
  content: "Big release",
  ...extra,
});

describe("clusterSources", () => {
  test("merges the same URL across origins, keeping the richest content", () => {
    const clusters = clusterSources([hn("https://example.com/post"), web("https://example.com/post/")]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.primary.origin).toBe("web");
    expect(clusters[0]!.also.map((s) => s.origin)).toEqual(["hackernews"]);
  });

  test("normalises hash, trailing slash, www, and protocol", () => {
    const clusters = clusterSources([
      web("http://www.example.com/post#intro"),
      hn("https://example.com/post"),
    ]);
    expect(clusters).toHaveLength(1);
  });

  test("keeps different URLs separate", () => {
    const clusters = clusterSources([web("https://example.com/a"), hn("https://example.com/b")]);
    expect(clusters).toHaveLength(2);
  });

  test("never clusters across comparison sides", () => {
    const clusters = clusterSources([
      web("https://example.com/post", { entity: "Cursor" }),
      hn("https://example.com/post", { entity: "Zed" }),
    ]);
    expect(clusters).toHaveLength(2);
  });

  test("keeps first-seen order for the merged entry", () => {
    const clusters = clusterSources([
      web("https://example.com/first"),
      hn("https://example.com/second"),
      web("https://example.com/second"),
    ]);
    expect(clusters.map((c) => c.primary.url)).toEqual([
      "https://example.com/first",
      "https://example.com/second",
    ]);
  });
});

describe("formatBundle", () => {
  const bundle = (sources: Source[], entities?: string[]) => ({
    topic: "big release",
    days: 30,
    entities,
    sources,
  });

  test("renders a merged entry with combined origins and per-origin signals", () => {
    const out = formatBundle(bundle([web("https://example.com/post"), hn("https://example.com/post")]));
    expect(out).toContain("## [1] web + hackernews: Big release — hackernews: 120 points, 45 comments");
    expect(out).not.toContain("## [2]");
    expect(out).toContain("merged into one numbered entry");
  });

  test("single-origin entries render exactly as before", () => {
    const out = formatBundle(bundle([hn("https://example.com/post")]));
    expect(out).toContain("## [1] hackernews: Big release — 120 points, 45 comments");
    expect(out).not.toContain("merged into one numbered entry");
  });

  test("comparison mode keeps continuous numbering over clusters", () => {
    const out = formatBundle(
      bundle(
        [
          web("https://example.com/post", { entity: "Cursor" }),
          hn("https://example.com/post", { entity: "Cursor" }),
          web("https://example.com/other", { entity: "Zed" }),
        ],
        ["Cursor", "Zed"],
      ),
    );
    expect(out).toContain("## [1] web + hackernews:");
    expect(out).toContain("## [2] web:");
    expect(out).not.toContain("## [3]");
  });
});
