// resolve.ts
// Pre-research resolution pass. Before the main gather, an ambiguous topic
// ("Apple", a common personal name, a product nickname) can be resolved into
// the right entities: a cheap Firecrawl search (titles + descriptions only,
// no page scraping) plus GitHub user/repo candidate lookups. The output is a
// compact "resolution context" the agent reads to derive 2-4 refined
// subqueries and, when the topic is a person or project, the matching GitHub
// login or repo. No LLM runs here - the agent harness does the deciding.
//
// Sources honour the project's hard rule: only the Firecrawl CLI and the
// official GitHub API. No social platform lookups.

import { githubHeaders } from "./config";
import { firecrawlArgv } from "./firecrawl";

type WebCandidate = { title: string; url: string; description: string };
type RepoCandidate = { fullName: string; url: string; stars: number; description: string };
type UserCandidate = { login: string; url: string };

// A quick, snippet-only Firecrawl search. Deliberately NOT scraped and NOT
// time-windowed: disambiguation wants the canonical identity of the topic,
// which recent-only results can miss.
async function resolveWeb(topic: string): Promise<WebCandidate[]> {
  try {
    const proc = Bun.spawn(
      [...firecrawlArgv(), "search", topic, "--limit", "5", "--json"],
      { stderr: "inherit" },
    );
    const text = await new Response(proc.stdout).text();
    let out: any = {};
    try {
      out = JSON.parse(text);
    } catch {
      return [];
    }
    return (out?.data?.web ?? []).map((hit: any) => ({
      title: hit.title ?? hit.url,
      url: hit.url,
      description: hit.description ?? "",
    }));
  } catch (err) {
    console.error(`[resolve/web] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

async function resolveRepos(topic: string): Promise<RepoCandidate[]> {
  try {
    const url = new URL("https://api.github.com/search/repositories");
    url.searchParams.set("q", topic);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("per_page", "3");
    const res = await fetch(url, { headers: githubHeaders() });
    const data = (await res.json()) as any;
    return (data.items ?? []).map((repo: any) => ({
      fullName: repo.full_name,
      url: repo.html_url,
      stars: repo.stargazers_count ?? 0,
      description: repo.description ?? "",
    }));
  } catch (err) {
    console.error(`[resolve/repos] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

async function resolveUsers(topic: string): Promise<UserCandidate[]> {
  try {
    const url = new URL("https://api.github.com/search/users");
    url.searchParams.set("q", topic);
    url.searchParams.set("per_page", "3");
    const res = await fetch(url, { headers: githubHeaders() });
    const data = (await res.json()) as any;
    return (data.items ?? []).map((user: any) => ({
      login: user.login,
      url: user.html_url,
    }));
  } catch (err) {
    console.error(`[resolve/users] skipped: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// Gather all three candidate lists in parallel and print one compact
// markdown context. The agent reads this and picks subqueries; nothing here
// decides anything.
export async function resolveTopic(topic: string): Promise<string> {
  const [web, repos, users] = await Promise.all([
    resolveWeb(topic).then((r) => (console.error("✓ Resolved against the web"), r)),
    resolveRepos(topic).then((r) => (console.error("✓ Resolved against GitHub repos"), r)),
    resolveUsers(topic).then((r) => (console.error("✓ Resolved against GitHub users"), r)),
  ]);

  const lines: string[] = [
    `# Resolution context: "${topic}"`,
    "",
    "Candidate identities for the topic, gathered cheaply (no page scraping).",
    "Use these to derive 2-4 refined subqueries for the main run, and - when the",
    "topic is a person or project - the matching GitHub login or repo.",
    "",
    "## Web candidates",
    ...(web.length
      ? web.map((w) => `- ${w.title}\n  ${w.url}\n  ${w.description}`.trimEnd())
      : ["(none found)"]),
    "",
    "## GitHub repo candidates",
    ...(repos.length
      ? repos.map((r) => `- ${r.fullName} (${r.stars} stars) ${r.url}\n  ${r.description}`.trimEnd())
      : ["(none found)"]),
    "",
    "## GitHub user candidates",
    ...(users.length
      ? users.map((u) => `- ${u.login} ${u.url}`)
      : ["(none found)"]),
  ];
  return lines.join("\n");
}
