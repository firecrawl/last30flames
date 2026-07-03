// url.ts
// One URL normaliser shared by gather-side dedupe (index.ts) and
// format-side clustering (format.ts), so the two layers can never drift
// apart on what counts as "the same URL".

const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$|igshid$)/;

// Drops the fragment and trailing slash (never meaningful), and strips
// known tracking params (a tracked and untracked link to the same story
// are the same story). Query strings are otherwise left alone since they
// can be load-bearing (e.g. a doc page keyed by a query param).
export function normalizeUrl(raw: string, opts: { foldOrigin?: boolean } = {}): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.pathname = u.pathname.replace(/\/$/, "");
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.test(key)) u.searchParams.delete(key);
    }
    if (opts.foldOrigin) {
      u.protocol = "https:";
      u.hostname = u.hostname.replace(/^www\./, "");
    }
    return u.toString();
  } catch {
    return raw;
  }
}
