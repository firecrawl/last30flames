import { describe, expect, test } from "bun:test";
import { deriveSides, newSide, splitVersus, type Side } from "./derive-sides";

const side = (name: string, over: Partial<Side> = {}): Side => ({ ...newSide(name), ...over });

describe("splitVersus", () => {
  test("splits vs/versus in any capitalization", () => {
    expect(splitVersus("cursor vs zed")).toEqual(["cursor", "zed"]);
    expect(splitVersus("cursor Vs. zed")).toEqual(["cursor", "zed"]);
    expect(splitVersus("cursor vS zed")).toEqual(["cursor", "zed"]);
    expect(splitVersus("bun VERSUS deno")).toEqual(["bun", "deno"]);
  });

  test("all-caps VS is exempt", () => {
    expect(splitVersus("best VS Code extensions")).toEqual(["best VS Code extensions"]);
    expect(splitVersus("a VS. b")).toEqual(["a VS. b"]);
  });

  test("mixed: VS kept inline, vs still splits", () => {
    expect(splitVersus("VS Code vs zed")).toEqual(["VS Code", "zed"]);
  });

  test("no separator yields the whole topic", () => {
    expect(splitVersus("local llm inference")).toEqual(["local llm inference"]);
  });
});

describe("deriveSides", () => {
  test("plain topic: one side carrying top-level flags", () => {
    const top = side("", { queries: ["q1"], githubUser: "alice" });
    const { sides, warnings } = deriveSides("my topic", [], top);
    expect(warnings).toEqual([]);
    expect(sides).toEqual([side("my topic", { queries: ["q1"], githubUser: "alice" })]);
  });

  test("auto-split comparison drops top-level flags with a warning", () => {
    const { sides, warnings } = deriveSides("cursor vs zed", [], side("", { queries: ["q"] }));
    expect(sides.map((s) => s.name)).toEqual(["cursor", "zed"]);
    expect(warnings).toHaveLength(1);
  });

  test("explicit --compare sides win over the topic", () => {
    const compares = [side("Cursor", { githubRepo: "getcursor/cursor" }), side("Zed")];
    const { sides, warnings } = deriveSides("cursor vs zed", compares, newSide(""));
    expect(sides).toEqual(compares);
    expect(warnings).toEqual([]);
  });

  test("pre---compare flags are dropped with a warning", () => {
    const top = side("", { githubUser: "alice" });
    const { sides, warnings } = deriveSides("t", [side("A"), side("B")], top);
    expect(sides.map((s) => s.name)).toEqual(["A", "B"]);
    expect(warnings).toHaveLength(1);
  });

  test("duplicate --compare names merge into one side, later flags win", () => {
    const compares = [
      side("Cursor", { queries: ["a"], githubUser: "u1" }),
      side("cursor", { queries: ["a", "b"], githubUser: "u2" }),
      side("Zed"),
    ];
    const { sides, warnings } = deriveSides("t", compares, newSide(""));
    expect(sides).toEqual([
      side("Cursor", { queries: ["a", "b"], githubUser: "u2" }),
      side("Zed"),
    ]);
    expect(warnings).toHaveLength(1);
  });

  test('duplicate auto-split sides ("cursor vs cursor") merge', () => {
    const { sides, warnings } = deriveSides("cursor vs cursor", [], newSide(""));
    expect(sides).toEqual([side("cursor")]);
    expect(warnings).toHaveLength(1);
  });

  test("single --compare on a plain topic folds last-wins", () => {
    const top = side("", { queries: ["tq"], githubRepo: "old/repo" });
    const only = side("A", { queries: ["cq"], githubRepo: "new/repo" });
    const { sides, warnings } = deriveSides("my topic", [only], top);
    expect(sides).toEqual([
      side("my topic", { queries: ["tq", "cq"], githubRepo: "new/repo" }),
    ]);
    expect(warnings).toHaveLength(1);
  });

  test("single --compare fold falls back to top-level flags", () => {
    const top = side("", { githubUser: "alice" });
    const { sides } = deriveSides("my topic", [side("A")], top);
    expect(sides[0]!.githubUser).toBe("alice");
  });

  test("single --compare on a vs topic drops its flags and auto-splits", () => {
    const only = side("Cursor", { queries: ["cq"] });
    const { sides, warnings } = deriveSides("cursor vs zed", [only], side("", { queries: ["tq"] }));
    expect(sides).toEqual([side("cursor"), side("zed")]);
    expect(warnings).toHaveLength(2);
  });
});
