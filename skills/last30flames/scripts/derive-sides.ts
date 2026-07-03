// derive-sides.ts
// Pure derivation of research sides from the parsed CLI input: explicit
// --compare sides win, otherwise a topic containing "vs"/"versus" auto-splits,
// otherwise the whole topic is one side. No I/O - warnings are returned, not
// printed - so the whole decision table is unit-testable.

export type Side = { name: string; queries: string[]; githubUser: string; githubRepo: string };

export const newSide = (name: string): Side => ({ name, queries: [], githubUser: "", githubRepo: "" });

// Split "X vs Y" on any capitalization of "vs"/"vs."/"versus", except
// all-caps "VS"/"VS." which stays part of the segment so product names like
// "best VS Code extensions" don't trigger a bogus comparison.
export function splitVersus(topic: string): string[] {
  const parts = topic.split(/\s+(vs\.?|versus)\s+/i);
  const segments: string[] = [parts[0] ?? ""];
  for (let i = 1; i < parts.length; i += 2) {
    const sep = parts[i]!;
    const next = parts[i + 1] ?? "";
    if (/^VS\.?$/.test(sep)) {
      segments[segments.length - 1] += ` ${sep} ${next}`;
    } else {
      segments.push(next);
    }
  }
  return segments.map((s) => s.trim()).filter(Boolean);
}

export function deriveSides(
  topic: string,
  compares: Side[],
  topLevel: Side,
): { sides: Side[]; warnings: string[] } {
  const warnings: string[] = [];
  const hasTopFlags = topLevel.queries.length > 0 || !!topLevel.githubUser || !!topLevel.githubRepo;
  const topFlagsDropped =
    'Ignoring --query/--github-* flags not scoped to a side; ' +
    'place them after the --compare side they belong to.';

  // Merge duplicate side names ("cursor vs cursor", repeated --compare "X")
  // into one side, otherwise format.ts prints every source twice with two
  // citation numbers. Later flags win within the merge.
  const dedupe = (raw: Side[]): Side[] => {
    const byName = new Map<string, Side>();
    for (const s of raw) {
      const key = s.name.toLowerCase();
      const prev = byName.get(key);
      if (!prev) {
        byName.set(key, { ...s, queries: [...s.queries] });
        continue;
      }
      warnings.push(`Duplicate side "${s.name}"; merging into one side.`);
      prev.queries.push(...s.queries.filter((q) => !prev.queries.includes(q)));
      if (s.githubUser) prev.githubUser = s.githubUser;
      if (s.githubRepo) prev.githubRepo = s.githubRepo;
    }
    return [...byName.values()];
  };

  if (compares.length >= 2) {
    if (hasTopFlags) warnings.push(topFlagsDropped);
    return { sides: dedupe(compares), warnings };
  }

  const split = splitVersus(topic);

  if (compares.length === 1) {
    const only = compares[0]!;
    if (split.length >= 2) {
      // The topic auto-splits into sides, so a lone --compare has no side to
      // scope to; its flags (and any top-level ones) are dropped outright.
      warnings.push(
        `A single --compare "${only.name}" cannot scope a side of an auto-split ` +
          'comparison; dropping it and its flags. Pass --compare once per side.',
      );
      if (hasTopFlags) warnings.push(topFlagsDropped);
      return { sides: dedupe(split.map(newSide)), warnings };
    }
    warnings.push("--compare needs at least two sides; folding it into a normal run.");
    // Last-wins fold: the --compare side's flags were given later on the
    // command line, so they override any pre---compare top-level ones.
    return {
      sides: [
        {
          name: topic,
          queries: [...topLevel.queries, ...only.queries],
          githubUser: only.githubUser || topLevel.githubUser,
          githubRepo: only.githubRepo || topLevel.githubRepo,
        },
      ],
      warnings,
    };
  }

  if (split.length >= 2) {
    // Auto-split comparison. Top-level scoping flags are ambiguous here
    // (which side would they belong to?), so they are dropped with a pointer
    // to the explicit form rather than silently applied to every side.
    if (hasTopFlags) warnings.push(topFlagsDropped);
    return { sides: dedupe(split.map(newSide)), warnings };
  }

  return { sides: [{ ...topLevel, name: topic, queries: [...topLevel.queries] }], warnings };
}
