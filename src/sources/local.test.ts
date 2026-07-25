import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseLocator } from "./locator.js";
import { fetchLocal } from "./local.js";
import type { FetchContext } from "./types.js";

let tmp: string;
let originalHome: string | undefined;
const ctx: FetchContext = { cacheDir: "/tmp/unused-cache" };

beforeEach(async () => {
  tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "vp-local-")));
  originalHome = process.env.HOME;
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  await fs.rm(tmp, { recursive: true, force: true });
});

describe("fetchLocal", () => {
  it("resolves a bare relative path against the process cwd", async () => {
    const skill = path.join(tmp, "skills", "foo");
    await fs.mkdir(skill, { recursive: true });
    vi.spyOn(process, "cwd").mockReturnValue(tmp);

    const resolved = await fetchLocal(parseLocator("skills/foo"), ctx);

    expect(resolved.type).toBe("local");
    expect(resolved.dir).toBe(skill);
    expect(resolved.locator).toBe("skills/foo");
  });

  it("expands a leading tilde to the home directory", async () => {
    const skill = path.join(tmp, "skills", "bar");
    await fs.mkdir(skill, { recursive: true });
    process.env.HOME = tmp;

    const resolved = await fetchLocal(parseLocator("~/skills/bar"), ctx);

    expect(resolved.dir).toBe(skill);
  });

  it("expands a bare tilde to the home directory", async () => {
    process.env.HOME = tmp;

    const resolved = await fetchLocal(parseLocator("~"), ctx);

    expect(resolved.dir).toBe(tmp);
  });

  it("reports a missing path clearly", async () => {
    await expect(fetchLocal(parseLocator(path.join(tmp, "nope")), ctx)).rejects.toThrow(
      /Local skill path does not exist/,
    );
  });

  it("reports a non-directory path clearly", async () => {
    const file = path.join(tmp, "SKILL.md");
    await fs.writeFile(file, "x", "utf-8");

    await expect(fetchLocal(parseLocator(file), ctx)).rejects.toThrow(
      /Local skill path is not a directory/,
    );
  });
});
