// format.ts
// Turns the raw research bundle into one clean markdown "research context".
// This tool does NOT call an LLM itself - it runs inside an agent harness
// (OpenClaw, opencode, Claude Code, ...) and the harness's own model reads
// this output and writes the final brief. That keeps the tool key-light:
// no Anthropic key, no per-user LLM cost, just web data + honest signals.

import type { ResearchBundle } from "./types";

export function formatBundle(bundle: ResearchBundle): string {
  const header = `# Research context: "${bundle.topic}" (last ${bundle.days} days)\n\n` +
    `${bundle.sources.length} sources gathered from the web, Hacker News, Lobste.rs, Bluesky, and GitHub.\n` +
    `Each source is numbered so the brief can cite it inline like [1], [3].\n`;

  // Number every source and carry its engagement "signal" (HN points,
  // GitHub stars) alongside the content so the model can weigh what matters.
  const blocks = bundle.sources.map((s, i) => {
    const signal = s.signal ? ` — ${s.signal}` : "";
    return `## [${i + 1}] ${s.origin}: ${s.title}${signal}\n${s.url}\n\n${s.content}`;
  });

  return [header, ...blocks].join("\n\n---\n\n");
}
