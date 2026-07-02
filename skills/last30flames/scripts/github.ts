// github.ts
// Honest engagement signal #2. GitHub's official search API publishes
// stars and last-push dates openly. We look for repos updated inside the
// window, sorted by stars, so the brief can point at active code.

import { config } from "./config";
import type { Source } from "./types";

// Optional scoping from the pre-research resolution pass: a known GitHub
// login and/or a known owner/name repo for the topic.
export type GitHubScope = { user?: string; repo?: string };

function repoToSource(repo: any): Source {
  return {
    origin: "github" as const,
    title: repo.full_name,
    url: repo.html_url,
    signal: `${repo.stargazers_count} stars, pushed ${repo.pushed_at?.slice(0, 10)}`,
    content: repo.description ?? "",
  };
}

export async function searchGitHub(topic: string, days: number, scope: GitHubScope = {}): Promise<Source[]> {
  try {
    // "pushed:>=YYYY-MM-DD" keeps us to repos that actually moved recently.
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    // When resolution pinned a login, scope to that user's repos instead of
    // keyword-matching the topic. The topic is deliberately dropped, not
    // conjoined: in person mode the topic is the person's name, which rarely
    // appears in their repos' metadata, so `user:login <name>` would return
    // almost nothing. Unfiltered user-scoping answers "what has this person
    // been building lately"; a specific project is pinned via scope.repo.
    const query = scope.user
      ? `user:${scope.user} pushed:>=${since}`
      : `${topic} pushed:>=${since}`;

    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", query);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("per_page", "5");

    // A token is optional - it only raises the rate limit - so we add the
    // Authorization header only when GITHUB_TOKEN is present.
    const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
    if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;

    // A resolution-pinned repo is fetched directly so it always appears,
    // even when it wouldn't rank in the search results.
    const pinned: Source[] = [];
    if (scope.repo) {
      const repoRes = await fetch(`https://api.github.com/repos/${scope.repo}`, { headers });
      if (repoRes.ok) pinned.push(repoToSource(await repoRes.json()));
      else console.error(`[github] pinned repo ${scope.repo} not found (HTTP ${repoRes.status})`);
    }

    const res = await fetch(url, { headers });
    const data = (await res.json()) as any;

    const searched: Source[] = (data.items ?? []).map(repoToSource);
    return [...pinned, ...searched.filter((s) => !pinned.some((p) => p.url === s.url))];
  } catch (err) {
    // One source failing must never crash the run; degrade to no GitHub results.
    console.error(`[github] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}
