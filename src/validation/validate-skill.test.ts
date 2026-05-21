import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { validateSkill } from "./validate-skill.js";

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), "vp-skill-"));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(name: string, content: string): Promise<void> {
  await fs.writeFile(path.join(tmp, name), content, "utf-8");
}

describe("validateSkill", () => {
  it("rejects missing SKILL.md", async () => {
    const result = await validateSkill(tmp);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/SKILL\.md not found/);
  });

  it("rejects empty frontmatter", async () => {
    await write("SKILL.md", "Just a body.");
    const result = await validateSkill(tmp);
    expect(result.ok).toBe(false);
  });

  it("rejects missing name/description", async () => {
    await write("SKILL.md", "---\nname: Foo\n---\nbody\n");
    const result = await validateSkill(tmp);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("description"))).toBe(true);
  });

  it("rejects empty body", async () => {
    await write("SKILL.md", "---\nname: Foo\ndescription: bar\n---\n");
    const result = await validateSkill(tmp);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => /body is empty/.test(e))).toBe(true);
  });

  it("accepts a minimal valid skill", async () => {
    await write(
      "SKILL.md",
      "---\nname: Researcher\ndescription: Research things.\nversion: 0.1.0\n---\nbody content\n",
    );
    const result = await validateSkill(tmp);
    expect(result.ok).toBe(true);
    expect(result.frontmatter?.name).toBe("Researcher");
  });
});
