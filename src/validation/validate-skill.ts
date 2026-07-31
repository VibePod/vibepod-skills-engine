import fs from "node:fs/promises";
import path from "node:path";

import matter, { type GrayMatterFile } from "gray-matter";

import {
  type SkillFrontmatter,
  SkillFrontmatterSchema,
} from "./skill-schema.js";

export interface ValidationResult {
  ok: boolean;
  path: string;
  errors: string[];
  frontmatter?: SkillFrontmatter;
  body?: string;
}

export async function validateSkill(
  skillDir: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const skillMd = path.join(skillDir, "SKILL.md");

  let raw: string;
  try {
    raw = await fs.readFile(skillMd, "utf-8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return {
        ok: false,
        path: skillDir,
        errors: [`SKILL.md not found at ${skillMd}`],
      };
    }
    return {
      ok: false,
      path: skillDir,
      errors: [`Failed to read SKILL.md: ${e.message}`],
    };
  }

  let parsed: GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (err) {
    return {
      ok: false,
      path: skillDir,
      errors: [`Invalid YAML frontmatter: ${(err as Error).message}`],
    };
  }

  if (Object.keys(parsed.data).length === 0) {
    errors.push("SKILL.md is missing YAML frontmatter");
  }

  const fmResult = SkillFrontmatterSchema.safeParse(parsed.data);
  if (!fmResult.success) {
    for (const issue of fmResult.error.issues) {
      const where =
        issue.path.length > 0 ? issue.path.join(".") : "frontmatter";
      errors.push(`${where}: ${issue.message}`);
    }
  }

  if (!parsed.content || parsed.content.trim().length === 0) {
    errors.push("SKILL.md body is empty");
  }

  if (errors.length > 0) {
    return { ok: false, path: skillDir, errors };
  }

  return {
    ok: true,
    path: skillDir,
    errors: [],
    frontmatter: fmResult.success ? fmResult.data : undefined,
    body: parsed.content,
  };
}
