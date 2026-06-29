// github.ts
// Honest engagement signal #2. GitHub's official search API publishes
// stars and last-push dates openly. We look for repos updated inside the
// window, sorted by stars, so the brief can point at active code.

import { config } from "./config";
import type { Source } from "./types";

export async function searchGitHub(topic: string, days: number): Promise<Source[]> {
  try {
    // "pushed:>=YYYY-MM-DD" keeps us to repos that actually moved recently.
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const query = `${topic} pushed:>=${since}`;

    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("per_page", "5");

    // A token is optional - it only raises the rate limit - so we add the
    // Authorization header only when GITHUB_TOKEN is present.
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;

    const res = await fetch(url, { headers });
    const data = (await res.json()) as any;

    return (data.items ?? []).map((repo: any) => ({
      origin: "github" as const,
      title: repo.full_name,
      url: repo.html_url,
      signal: `${repo.stargazers_count} stars, pushed ${repo.pushed_at?.slice(0, 10)}`,
      content: repo.description ?? "",
    }));
  } catch (err) {
    // One source failing must never crash the run; degrade to no GitHub results.
    console.error(`[github] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
