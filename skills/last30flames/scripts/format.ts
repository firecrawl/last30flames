// format.ts
// Turns the raw research bundle into one clean markdown "research context".
// This tool does NOT call an LLM itself - it runs inside an agent harness
// (OpenClaw, opencode, Claude Code, ...) and the harness's own model reads
// this output and writes the final brief. That keeps the tool key-light:
// no Anthropic key, no per-user LLM cost, just web data + honest signals.

import type { ResearchBundle } from "./types";

export function formatBundle(bundle: ResearchBundle): string {
  const comparing = bundle.entities?.length ? bundle.entities : undefined;
  const header =
    (comparing
      ? `# Research context: ${comparing.map((e) => `"${e}"`).join(" vs ")} (last ${bundle.days} days)\n\n`
      : `# Research context: "${bundle.topic}" (last ${bundle.days} days)\n\n`) +
    `${bundle.sources.length} sources gathered from the web, Hacker News, Lobste.rs, Bluesky, and GitHub.\n` +
    (bundle.queries?.length
      ? `Searched via refined queries: ${bundle.queries.map((q) => `"${q}"`).join(", ")}.\n`
      : "") +
    (comparing
      ? `Sources are grouped per side; numbering is continuous across sides so every citation stays unique.\n`
      : "") +
    `Each source is numbered so the brief can cite it inline like [1], [3].\n`;

  // Number every source and carry its engagement "signal" (HN points,
  // GitHub stars) alongside the content so the model can weigh what matters.
  const block = (s: ResearchBundle["sources"][number], n: number) => {
    const signal = s.signal ? ` — ${s.signal}` : "";
    return `## [${n}] ${s.origin}: ${s.title}${signal}\n${s.url}\n\n${s.content}`;
  };

  if (!comparing) {
    return [header, ...bundle.sources.map((s, i) => block(s, i + 1))].join("\n\n---\n\n");
  }

  // Comparison mode: one section per side, numbering continuous across the
  // whole context. Sources arrive grouped by side already; iterating the
  // declared side order keeps the output stable even if that changes.
  const parts: string[] = [header];
  let n = 0;
  for (const entity of comparing) {
    parts.push(`# Side: ${entity}`);
    const sideSources = bundle.sources.filter((s) => s.entity === entity);
    if (!sideSources.length) parts.push(`(no sources found for "${entity}" in the window)`);
    for (const s of sideSources) parts.push(block(s, ++n));
  }
  return parts.join("\n\n---\n\n");
}
