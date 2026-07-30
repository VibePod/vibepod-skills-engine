import path from "node:path";

import { loadLockfile } from "../registry/lockfile.js";
import { exists } from "../utils/fs.js";
import { emit, flush } from "../utils/output.js";
import { bothScopes, paths, type Scope } from "../utils/paths.js";
import type { LockEntry } from "../validation/skill-schema.js";

export interface ResolveOptions {
  scope?: Scope;
}

interface ResolvedSkill {
  id: string;
  name: string;
  version?: string;
  ref?: string;
  commit?: string;
  scope: Scope;
  path: string;
  status: "active" | "shadowed" | "missing";
}

function deriveVersion(entry: LockEntry): string | undefined {
  if (entry.version) return entry.version;
  if (entry.source.ref) return entry.source.ref;
  if (entry.source.commit) return entry.source.commit.slice(0, 7);
  return undefined;
}

export async function resolveCommand(opts: ResolveOptions): Promise<number> {
  const scopes: Scope[] = opts.scope ? [opts.scope] : bothScopes();
  const entries: Array<{ entry: LockEntry; scope: Scope }> = [];

  for (const s of scopes) {
    const lock = await loadLockfile(s);
    for (const entry of Object.values(lock.skills)) {
      entries.push({ entry, scope: s });
    }
  }

  // Merge with local-wins shadowing.
  const winners = new Map<string, ResolvedSkill>();
  const losers: ResolvedSkill[] = [];

  // user first, then local — local overwrites
  const ordered = [...entries].sort(
    (a, b) => (a.scope === "user" ? 0 : 1) - (b.scope === "user" ? 0 : 1),
  );

  for (const { entry, scope } of ordered) {
    const abs = path.join(paths(scope).root, entry.path);
    const present = await exists(abs);
    const item: ResolvedSkill = {
      id: entry.id,
      name: entry.name,
      version: deriveVersion(entry),
      ref: entry.source.ref,
      commit: entry.source.commit,
      scope,
      path: abs,
      status: present ? "active" : "missing",
    };
    const prev = winners.get(entry.id);
    if (prev) {
      losers.push({ ...prev, status: "shadowed" });
    }
    winners.set(entry.id, item);
  }

  const active = [...winners.values()];
  emit(
    {
      command: "resolve",
      scopes,
      active,
      shadowed: losers,
    },
    () => active.map((s) => `${s.id}\t${s.scope}\t${s.path}`).join("\n"),
  );
  flush();
  return 0;
}
