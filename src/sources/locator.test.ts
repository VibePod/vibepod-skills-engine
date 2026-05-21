import { describe, expect, it } from "vitest";

import { expandBundleLocator, parseLocator, pinLocatorToResolved } from "./locator.js";
import type { ResolvedSource } from "./types.js";

describe("parseLocator", () => {
  it("parses local relative paths", () => {
    expect(parseLocator("./skills/foo")).toEqual({
      type: "local",
      raw: "./skills/foo",
      path: "./skills/foo",
    });
  });

  it("parses local absolute paths", () => {
    expect(parseLocator("/abs/path")).toMatchObject({ type: "local", path: "/abs/path" });
  });

  it("parses github with subpath and ref", () => {
    const parsed = parseLocator("github:vibepod/vibepod-skills//skills/researcher#v1.0.0");
    expect(parsed).toMatchObject({
      type: "github",
      repo: "vibepod/vibepod-skills",
      subpath: "skills/researcher",
      ref: "v1.0.0",
    });
  });

  it("parses github without ref", () => {
    expect(parseLocator("github:org/repo")).toMatchObject({
      type: "github",
      repo: "org/repo",
      subpath: undefined,
      ref: undefined,
    });
  });

  it("parses gitlab", () => {
    expect(parseLocator("gitlab:group/repo//skills/bar#main")).toMatchObject({
      type: "gitlab",
      repo: "group/repo",
      subpath: "skills/bar",
      ref: "main",
    });
  });

  it("parses npm package without version", () => {
    expect(parseLocator("npm:@acme/vibepod-skill-researcher")).toMatchObject({
      type: "npm",
      package: "@acme/vibepod-skill-researcher",
      version: undefined,
    });
  });

  it("parses npm package with version", () => {
    expect(parseLocator("npm:@acme/vibepod-skill-researcher@1.2.0")).toMatchObject({
      type: "npm",
      package: "@acme/vibepod-skill-researcher",
      version: "1.2.0",
    });
  });

  it("parses generic https git URL", () => {
    expect(parseLocator("https://git.example.com/org/repo.git//skills/foo#v1.0.0")).toMatchObject({
      type: "git",
      url: "https://git.example.com/org/repo.git",
      subpath: "skills/foo",
      ref: "v1.0.0",
    });
  });

  it("rejects unrecognized schemes", () => {
    expect(() => parseLocator("ftp://example.com/foo")).toThrow();
  });

  it("rejects empty locators", () => {
    expect(() => parseLocator("")).toThrow();
  });
});

describe("expandBundleLocator", () => {
  it("appends subdir to github subpath", () => {
    expect(expandBundleLocator("github:obra/superpowers//skills", "tdd")).toBe(
      "github:obra/superpowers//skills/tdd",
    );
  });

  it("preserves ref when expanding github", () => {
    expect(expandBundleLocator("github:obra/superpowers//skills#v1.0.0", "tdd")).toBe(
      "github:obra/superpowers//skills/tdd#v1.0.0",
    );
  });

  it("creates subpath when bundle locator has none", () => {
    expect(expandBundleLocator("github:org/repo#main", "foo")).toBe(
      "github:org/repo//foo#main",
    );
  });

  it("expands gitlab the same way", () => {
    expect(expandBundleLocator("gitlab:group/repo//skills#main", "foo")).toBe(
      "gitlab:group/repo//skills/foo#main",
    );
  });

  it("expands generic https git URL", () => {
    expect(
      expandBundleLocator("https://git.example.com/org/repo.git//skills#v1", "foo"),
    ).toBe("https://git.example.com/org/repo.git//skills/foo#v1");
  });

  it("appends subdir to local path", () => {
    expect(expandBundleLocator("./bundle", "foo")).toBe("./bundle/foo");
    expect(expandBundleLocator("./bundle/", "foo")).toBe("./bundle/foo");
  });

  it("refuses to expand npm locators", () => {
    expect(() => expandBundleLocator("npm:@acme/pkg", "foo")).toThrow(/npm/);
  });
});

function gitResolved(commit: string): ResolvedSource {
  return {
    type: "git",
    provider: "github",
    dir: "/cache/x",
    commit,
    locator: "github:org/repo",
  };
}

describe("pinLocatorToResolved", () => {
  it("appends commit to a git locator with no ref", () => {
    expect(
      pinLocatorToResolved("github:obra/superpowers//skills/x", gitResolved("abc123")),
    ).toBe("github:obra/superpowers//skills/x#abc123");
  });

  it("replaces an existing ref with the resolved commit", () => {
    expect(
      pinLocatorToResolved("github:obra/superpowers//skills/x#main", gitResolved("abc123")),
    ).toBe("github:obra/superpowers//skills/x#abc123");
    expect(
      pinLocatorToResolved("github:obra/superpowers//skills/x#v1.0.0", gitResolved("abc123")),
    ).toBe("github:obra/superpowers//skills/x#abc123");
  });

  it("pins npm locators to the resolved version", () => {
    const resolved: ResolvedSource = {
      type: "npm",
      provider: "npm",
      dir: "/cache/x",
      version: "1.2.3",
      package: "@acme/vibepod-skill-foo",
      locator: "npm:@acme/vibepod-skill-foo",
    };
    expect(pinLocatorToResolved("npm:@acme/vibepod-skill-foo", resolved)).toBe(
      "npm:@acme/vibepod-skill-foo@1.2.3",
    );
    expect(pinLocatorToResolved("npm:@acme/vibepod-skill-foo@^1.0.0", resolved)).toBe(
      "npm:@acme/vibepod-skill-foo@1.2.3",
    );
  });

  it("leaves local locators unchanged", () => {
    const resolved: ResolvedSource = {
      type: "local",
      provider: "local",
      dir: "/abs/path",
      locator: "./bundle/x",
    };
    expect(pinLocatorToResolved("./bundle/x", resolved)).toBe("./bundle/x");
  });

  it("leaves git locators unchanged when no commit was resolved", () => {
    const resolved: ResolvedSource = {
      type: "git",
      provider: "github",
      dir: "/cache/x",
      locator: "github:org/repo",
    };
    expect(pinLocatorToResolved("github:org/repo//x#main", resolved)).toBe(
      "github:org/repo//x#main",
    );
  });
});
