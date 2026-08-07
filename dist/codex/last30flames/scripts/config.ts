// config.ts
// Reads optional credentials from the environment. Bun loads .env automatically.
//
// Note there are NO required keys. The Firecrawl CLI manages its own auth
// (it uses FIRECRAWL_API_KEY if present, otherwise a keyless free tier), and
// synthesis happens in the agent harness - so this skill runs with nothing set.
// Everything here only *raises limits* when present.

export const config = {
  // Optional: only raises GitHub's rate limit. Empty string is fine.
  githubToken: process.env.GITHUB_TOKEN ?? "",
};

// Headers for every GitHub API call. The Authorization header is added only
// when GITHUB_TOKEN is present - a token never unlocks features, it just
// raises the rate limit.
export function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (config.githubToken) headers.Authorization = `Bearer ${config.githubToken}`;
  return headers;
}
