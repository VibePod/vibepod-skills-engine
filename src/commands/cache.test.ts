import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, expect, it } from "vitest";

import { cacheClearCommand } from "./cache.js";

let cache: string;

beforeEach(async () => {
  cache = await fs.mkdtemp(path.join(os.tmpdir(), "vp-cache-"));
  process.env.VIBEPOD_CACHE = cache;
});

afterEach(async () => {
  delete process.env.VIBEPOD_CACHE;
  await fs.rm(cache, { recursive: true, force: true });
});

it("removes git and npm source caches", async () => {
  await fs.mkdir(path.join(cache, "git", "abc", "skills"), { recursive: true });
  await fs.writeFile(path.join(cache, "git", "abc", "skills", "x"), "x");
  await fs.mkdir(path.join(cache, "npm", "def"), { recursive: true });

  const rc = await cacheClearCommand();
  expect(rc).toBe(0);

  await expect(fs.access(path.join(cache, "git"))).rejects.toThrow();
  await expect(fs.access(path.join(cache, "npm"))).rejects.toThrow();
});

it("keeps entries it does not own", async () => {
  await fs.mkdir(path.join(cache, "git", "abc"), { recursive: true });
  await fs.mkdir(path.join(cache, "empty-local-skills"), { recursive: true });

  await cacheClearCommand();

  await expect(
    fs.access(path.join(cache, "empty-local-skills")),
  ).resolves.toBeUndefined();
});

it("succeeds on an empty cache", async () => {
  expect(await cacheClearCommand()).toBe(0);
});
