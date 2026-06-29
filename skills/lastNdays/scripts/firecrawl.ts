// firecrawl.ts
// The star of the demo: one search call that returns FULL PAGE CONTENT,
// not just a title + 150-char snippet. The magic is `--scrape`: Firecrawl
// reads each result page and hands back clean markdown in the same call.
//
// We shell out to the Firecrawl CLI instead of the SDK on purpose. The CLI
// has an auth ladder - it uses FIRECRAWL_API_KEY if set (full credits), and
// otherwise falls back to a keyless free tier - so this skill runs with no
// key at all. No SDK dependency, no required credential.

import type { Source } from "./types";

// Prefer a globally installed `firecrawl`; otherwise let bun fetch the CLI
// package on demand. Either way the user installs nothing by hand.
function firecrawlArgv(): string[] {
  return Bun.which("firecrawl") ? ["firecrawl"] : ["bunx", "firecrawl-cli"];
}

// Firecrawl's time filter is Google's "tbs" param. We turn the user's
// "last N days" into a custom date range so ANY window works (7, 30, 365),
// not just Google's fixed day/week/month/year buckets.
export function tbsForDays(days: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
  const max = new Date();
  const min = new Date();
  min.setDate(min.getDate() - days);
  return `cdr:1,cd_min:${fmt(min)},cd_max:${fmt(max)}`;
}

// Run the topic through Firecrawl Search, asking each hit to be scraped
// into markdown. We only keep the last N days so the brief is genuinely recent.
export async function searchWeb(topic: string, days: number, limit = 5): Promise<Source[]> {
  try {
    const proc = Bun.spawn(
      [
        ...firecrawlArgv(),
        "search",
        topic,
        "--limit", String(limit), // a handful of strong pages reads better on camera than 50
        "--tbs", tbsForDays(days), // <-- the recency window
        "--scrape", // <-- the one flag that turns snippets into full pages
        "--scrape-formats", "markdown",
        "--only-main-content", // drop nav/footer chrome so the markdown is clean
        "--json", // machine-readable so we can shape it below
      ],
      { stderr: "inherit" },
    );

    // The CLI prints { success, data: { web: [...] } } on success, but plain
    // text like "No results found." when empty - so parse defensively.
    const text = await new Response(proc.stdout).text();
    let out: any = {};
    try {
      out = JSON.parse(text);
    } catch {
      return []; // no JSON => no usable web results; the brief will note thin evidence
    }
    // Each web hit carries url/title/description, plus `markdown` when --scrape succeeded.
    const hits = out?.data?.web ?? [];

    return hits.map((hit: any) => ({
      origin: "web" as const,
      title: hit.title ?? hit.url,
      url: hit.url,
      // Full page markdown when scraping succeeded; fall back to the snippet.
      content: hit.markdown ?? hit.description ?? "",
    }));
  } catch (err) {
    // One source failing must never crash the run; degrade to no web results.
    console.error(`[web] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
