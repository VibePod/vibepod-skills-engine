import { paths, type Scope } from "../utils/paths.js";
import { readJson, writeJson } from "../utils/fs.js";
import { RegistrySchema, type Registry } from "../validation/skill-schema.js";

const EMPTY: Registry = { version: 1, skills: {} };

export async function loadRegistry(scope: Scope): Promise<Registry> {
  const raw = await readJson<unknown>(paths(scope).registry, EMPTY);
  const parsed = RegistrySchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid skills.json (${scope}): ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

export async function saveRegistry(scope: Scope, registry: Registry): Promise<void> {
  await writeJson(paths(scope).registry, registry);
}

export function upsertRegistryEntry(
  registry: Registry,
  id: string,
  source: string,
  scope: Scope,
  idOverride?: string,
): Registry {
  return {
    ...registry,
    skills: {
      ...registry.skills,
      [id]: { id, scope, source, ...(idOverride ? { idOverride } : {}) },
    },
  };
}

export function removeRegistryEntry(registry: Registry, id: string): Registry {
  const next = { ...registry.skills };
  delete next[id];
  return { ...registry, skills: next };
}
