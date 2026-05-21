import { z } from "zod";

export const SkillFrontmatterSchema = z.object({
  name: z.string().min(1, "frontmatter.name is required"),
  description: z.string().min(1, "frontmatter.description is required"),
  version: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  requires: z
    .object({
      tools: z.array(z.string()).optional(),
    })
    .partial()
    .optional(),
  permissions: z.array(z.string()).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export const RegistrySchema = z.object({
  version: z.literal(1),
  skills: z.record(
    z.string(),
    z.object({
      id: z.string(),
      scope: z.enum(["local", "user"]),
      source: z.string(),
      idOverride: z.string().optional(),
    }),
  ),
});

export type Registry = z.infer<typeof RegistrySchema>;

export const LockEntrySchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  name: z.string(),
  path: z.string(),
  source: z.object({
    type: z.enum(["git", "npm", "local"]),
    provider: z.enum(["github", "gitlab", "git", "npm", "local"]),
    repo: z.string().optional(),
    package: z.string().optional(),
    path: z.string().optional(),
    ref: z.string().optional(),
    commit: z.string().optional(),
    locator: z.string(),
  }),
  installedAt: z.string(),
  checksum: z.string().optional(),
  linked: z.boolean().optional(),
});

export type LockEntry = z.infer<typeof LockEntrySchema>;

export const LockfileSchema = z.object({
  version: z.literal(1),
  skills: z.record(z.string(), LockEntrySchema),
});

export type Lockfile = z.infer<typeof LockfileSchema>;
