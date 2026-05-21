import { paths, type Scope } from "../utils/paths.js";
import { readJson, writeJson } from "../utils/fs.js";
import { LockfileSchema, type LockEntry, type Lockfile } from "../validation/skill-schema.js";

const EMPTY: Lockfile = { version: 1, skills: {} };

export async function loadLockfile(scope: Scope): Promise<Lockfile> {
  const raw = await readJson<unknown>(paths(scope).lockfile, EMPTY);
  const parsed = LockfileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Invalid skills-lock.json (${scope}): ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return parsed.data;
}

export async function saveLockfile(scope: Scope, lock: Lockfile): Promise<void> {
  await writeJson(paths(scope).lockfile, lock);
}

export function upsertLockEntry(lock: Lockfile, entry: LockEntry): Lockfile {
  return { ...lock, skills: { ...lock.skills, [entry.id]: entry } };
}

export function removeLockEntry(lock: Lockfile, id: string): Lockfile {
  const next = { ...lock.skills };
  delete next[id];
  return { ...lock, skills: next };
}
