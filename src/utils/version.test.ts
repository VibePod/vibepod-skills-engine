import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { getVersion } from "./version.js";

describe("getVersion", () => {
  it("returns a semver string", () => {
    expect(getVersion()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("matches the package.json version", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };
    expect(getVersion()).toBe(pkg.version);
  });
});
