// format.ts
// Turns the raw research bundle into one clean markdown "research context".
// This tool does NOT call an LLM itself - it runs inside an agent harness
// (OpenClaw, opencode, Claude Code, ...) and the harness's own model reads
// the output and writes the final brief. That keeps the tool key-light:
// no Anthropic key, no per-user LLM cost, just web data + honest signals.

import type { ResearchBundle, Source } from "./types";
import { normalizeUrl } from "./url";

// One rendered entry: a primary source plus any other origins that found the
// same URL, each keeping its own engagement signal.
export type Cluster = { primary: Source; also: Source[] };

// The gather step deliberately keeps a URL that appears in several sources
// (index.ts dedupes within an origin only), because each origin carries
// different information: web brings full content, HN/Lobste.rs bring
// engagement numbers. Merging them is this step's job, so the same story
// isn't numbered twice and the synthesizer sees all its engagement signals
// on one entry. Shares the gather-side dedupe's normaliser (url.ts), plus
// protocol/www folding so trivially different spellings of one URL still
// meet - a format-only extra since gather-side dedup keys already scope by
// origin and don't need it.
// Clusters never cross comparison sides - the same URL surfacing for both
// sides is itself signal and stays visible per side.
const clusterKey = (s: Source) =>
  `${s.entity ?? ""}|${normalizeUrl(s.url, { foldOrigin: true })}`;

export function clusterSources(sources: Source[]): Cluster[] {
  const byKey = new Map<string, Cluster>();
  for (const s of sources) {
    const key = clusterKey(s);
    const c = byKey.get(key);
    if (!c) {
      byKey.set(key, { primary: s, also: [] });
      continue;
    }
    // The richest content wins the body (a scraped web page beats an HN
    // title blurb); the other member still contributes its signal line.
    if (s.content.length > c.primary.content.length) {
      c.also.push(c.primary);
      c.primary = s;
    } else {
      c.also.push(s);
    }
  }
  return [...byKey.values()];
}

export function formatBundle(bundle: ResearchBundle): string {
  const comparing = bundle.entities?.length ? bundle.entities : undefined;
  const clusters = clusterSources(bundle.sources);
  const merged = clusters.some((c) => c.also.length > 0);
  const header =
    (comparing
      ? `# Research context: ${comparing.map((e) => `"${e}"`).join(" vs ")} (last ${bundle.days} days)\n\n`
      : `# Research context: "${bundle.topic}" (last ${bundle.days} days)\n\n`) +
    (merged
      ? `${bundle.sources.length} sources gathered from web, Hacker News, Lobste.rs, Bluesky, GitHub, merged into ${clusters.length} numbered ${clusters.length === 1 ? "entry" : "entries"} where the same story appeared in several sources.\n`
      : `${bundle.sources.length} sources gathered from web, Hacker News, Lobste.rs, Bluesky, GitHub.\n`) +
    (bundle.queries?.length
      ? `Searched via refined queries: ${bundle.queries.map((q) => `"${q}"`).join(", ")}.\n`
      : "") +
    (comparing
      ? `Sources are grouped per side; numbering is continuous across sides so every citation stays unique.\n`
      : "") +
    `Each source is numbered so the brief can cite it inline like [1], [3].\n`;

  // Number every entry and carry its engagement "signal" (HN points,
  // GitHub stars) alongside the content so the model can weigh what matters.
  // A merged entry lists each origin's signal prefixed with its origin.
  const block = (c: Cluster, n: number) => {
    const members = [c.primary, ...c.also];
    const origins = [...new Set(members.map((s) => s.origin))].join(" + ");
    const withSignal = members.filter((s) => s.signal);
    const signal = withSignal.length
      ? ` — ${withSignal
          .map((s) => (members.length > 1 ? `${s.origin}: ${s.signal}` : s.signal))
          .join("; ")}`
      : "";
    return `## [${n}] ${origins}: ${c.primary.title}${signal}\n${c.primary.url}\n\n${c.primary.content}`;
  };

  if (!comparing) {
    return [header, ...clusters.map((c, i) => block(c, i + 1))].join("\n\n---\n\n");
  }

  // Comparison mode: one section per side, numbering continuous across the
  // whole context. Sources arrive grouped by side already; iterating the
  // declared side order keeps the output stable even if that changes.
  // Every member of a cluster shares one entity (it's part of the key), so
  // filtering on the primary's entity keeps whole clusters together.
  const parts: string[] = [header];
  let n = 0;
  for (const entity of comparing) {
    parts.push(`# Side: ${entity}`);
    const sideClusters = clusters.filter((c) => c.primary.entity === entity);
    if (!sideClusters.length) parts.push(`(no sources found for "${entity}" in the window)`);
    for (const c of sideClusters) parts.push(block(c, ++n));
  }
  return parts.join("\n\n---\n\n");
}
