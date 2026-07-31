import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addCommand } from "./add.js";
import { listCommand } from "./list.js";

let tmp: string;
let localSkills: string;
let userSkills: string;
let cache: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vp-add-"));
  localSkills = path.join(tmp, "local");
  userSkills = path.join(tmp, "user");
  cache = path.join(tmp, "cache");
  for (const d of [localSkills, userSkills, cache])
    await fs.mkdir(d, { recursive: true });
  process.env.VIBEPOD_LOCAL_SKILLS = localSkills;
  process.env.VIBEPOD_USER_SKILLS = userSkills;
  process.env.VIBEPOD_CACHE = cache;
});

afterEach(async () => {
  delete process.env.VIBEPOD_LOCAL_SKILLS;
  delete process.env.VIBEPOD_USER_SKILLS;
  delete process.env.VIBEPOD_CACHE;
  await fs.rm(tmp, { recursive: true, force: true });
});

it("installs a local skill and writes registry + lock", async () => {
  const src = path.join(tmp, "src");
  await fs.mkdir(src, { recursive: true });
  await fs.writeFile(
    path.join(src, "SKILL.md"),
    "---\nname: Researcher\ndescription: Research things.\nversion: 0.1.0\n---\nbody\n",
    "utf-8",
  );

  const rc = await addCommand({ locator: src, scope: "local" });
  expect(rc).toBe(0);

  const installed = path.join(
    localSkills,
    "installed",
    "researcher",
    "SKILL.md",
  );
  await expect(fs.access(installed)).resolves.toBeUndefined();

  const reg = JSON.parse(
    await fs.readFile(path.join(localSkills, "skills.json"), "utf-8"),
  );
  expect(reg.skills.researcher.id).toBe("researcher");
  const lock = JSON.parse(
    await fs.readFile(path.join(localSkills, "skills-lock.json"), "utf-8"),
  );
  expect(lock.skills.researcher.name).toBe("Researcher");

  await listCommand({}); // should not throw
});

it("respects --id override", async () => {
  const src = path.join(tmp, "src2");
  await fs.mkdir(src, { recursive: true });
  await fs.writeFile(
    path.join(src, "SKILL.md"),
    "---\nname: Foo\ndescription: bar\n---\nbody\n",
    "utf-8",
  );
  const rc = await addCommand({ locator: src, scope: "user", id: "custom-id" });
  expect(rc).toBe(0);
  await expect(
    fs.access(path.join(userSkills, "installed", "custom-id", "SKILL.md")),
  ).resolves.toBeUndefined();
});

it("installs a bundle of skills from a directory with no SKILL.md at root", async () => {
  const bundle = path.join(tmp, "bundle");
  await fs.mkdir(path.join(bundle, "alpha"), { recursive: true });
  await fs.mkdir(path.join(bundle, "beta"), { recursive: true });
  await fs.mkdir(path.join(bundle, "docs"), { recursive: true }); // no SKILL.md → skipped
  await fs.writeFile(
    path.join(bundle, "alpha", "SKILL.md"),
    "---\nname: alpha\ndescription: First.\n---\nbody A\n",
    "utf-8",
  );
  await fs.writeFile(
    path.join(bundle, "beta", "SKILL.md"),
    "---\nname: beta\ndescription: Second.\n---\nbody B\n",
    "utf-8",
  );

  const rc = await addCommand({ locator: bundle, scope: "local" });
  expect(rc).toBe(0);

  await expect(
    fs.access(path.join(localSkills, "installed", "alpha", "SKILL.md")),
  ).resolves.toBeUndefined();
  await expect(
    fs.access(path.join(localSkills, "installed", "beta", "SKILL.md")),
  ).resolves.toBeUndefined();
  await expect(
    fs.access(path.join(localSkills, "installed", "docs", "SKILL.md")),
  ).rejects.toBeTruthy();

  const lock = JSON.parse(
    await fs.readFile(path.join(localSkills, "skills-lock.json"), "utf-8"),
  );
  expect(Object.keys(lock.skills).sort()).toEqual(["alpha", "beta"]);
  // per-skill locators should be expanded
  expect(lock.skills.alpha.source.locator).toBe(`${bundle}/alpha`);
  expect(lock.skills.beta.source.locator).toBe(`${bundle}/beta`);
});

it("detects a skills/ subdirectory as a bundle (obra/superpowers shape)", async () => {
  const root = path.join(tmp, "repo");
  await fs.mkdir(path.join(root, "skills", "alpha"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", "beta"), { recursive: true });
  await fs.mkdir(path.join(root, "docs"), { recursive: true });
  await fs.mkdir(path.join(root, "tests"), { recursive: true });
  await fs.writeFile(
    path.join(root, "skills", "alpha", "SKILL.md"),
    "---\nname: alpha\ndescription: First.\n---\nbody\n",
    "utf-8",
  );
  await fs.writeFile(
    path.join(root, "skills", "beta", "SKILL.md"),
    "---\nname: beta\ndescription: Second.\n---\nbody\n",
    "utf-8",
  );

  const rc = await addCommand({ locator: root, scope: "local" });
  expect(rc).toBe(0);

  await expect(
    fs.access(path.join(localSkills, "installed", "alpha", "SKILL.md")),
  ).resolves.toBeUndefined();
  await expect(
    fs.access(path.join(localSkills, "installed", "beta", "SKILL.md")),
  ).resolves.toBeUndefined();

  const lock = JSON.parse(
    await fs.readFile(path.join(localSkills, "skills-lock.json"), "utf-8"),
  );
  expect(lock.skills.alpha.source.locator).toBe(`${root}/skills/alpha`);
});

it("installs a skill from a bare relative path", async () => {
  const src = path.join(tmp, "bare-src");
  await fs.mkdir(src, { recursive: true });
  await fs.writeFile(
    path.join(src, "SKILL.md"),
    "---\nname: Bare\ndescription: Installed from a bare path.\nversion: 0.1.0\n---\nbody\n",
    "utf-8",
  );

  const cwd = vi.spyOn(process, "cwd").mockReturnValue(tmp);
  try {
    const rc = await addCommand({ locator: "bare-src", scope: "local" });
    expect(rc).toBe(0);
  } finally {
    cwd.mockRestore();
  }

  await expect(
    fs.access(path.join(localSkills, "installed", "bare", "SKILL.md")),
  ).resolves.toBeUndefined();

  const lock = JSON.parse(
    await fs.readFile(path.join(localSkills, "skills-lock.json"), "utf-8"),
  );
  expect(lock.skills.bare.source.locator).toBe("bare-src");
});

it("rejects --id when installing a bundle", async () => {
  const bundle = path.join(tmp, "bundle2");
  await fs.mkdir(path.join(bundle, "x"), { recursive: true });
  await fs.writeFile(
    path.join(bundle, "x", "SKILL.md"),
    "---\nname: x\ndescription: y.\n---\nbody\n",
    "utf-8",
  );
  const rc = await addCommand({ locator: bundle, scope: "local", id: "foo" });
  expect(rc).toBe(1);
});
