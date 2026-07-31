import path from "node:path";

import { loadLockfile } from "../registry/lockfile.js";
import { exists } from "../utils/fs.js";
import { emit, flush } from "../utils/output.js";
import { bothScopes, paths, type Scope } from "../utils/paths.js";
import type { LockEntry } from "../validation/skill-schema.js";

export interface ListOptions {
  scope?: Scope;
}

interface ListRow {
  id: string;
  name: string;
  version: string;
  ref?: string;
  commit?: string;
  scope: Scope;
  status: "active" | "shadowed" | "missing";
  path: string;
  shadowedBy?: Scope;
  shadows?: Scope[];
  locator: string;
}

/**
 * Display version: frontmatter `version` if set, else the user-requested git
 * ref (branch/tag/commit), else a short resolved commit, else `-`.
 */
function deriveVersion(entry: LockEntry): string {
  if (entry.version) return entry.version;
  if (entry.source.ref) return entry.source.ref;
  if (entry.source.commit) return entry.source.commit.slice(0, 7);
  return "-";
}

async function rowsForScope(
  scope: Scope,
): Promise<Array<{ entry: LockEntry; scope: Scope; present: boolean }>> {
  const lock = await loadLockfile(scope);
  const result = [];
  for (const entry of Object.values(lock.skills)) {
    const abs = path.join(paths(scope).root, entry.path);
    result.push({ entry, scope, present: await exists(abs) });
  }
  return result;
}

export async function listCommand(opts: ListOptions): Promise<number> {
  const scopes: Scope[] = opts.scope ? [opts.scope] : bothScopes();
  const all: Array<{ entry: LockEntry; scope: Scope; present: boolean }> = [];
  for (const s of scopes) {
    all.push(...(await rowsForScope(s)));
  }

  // Shadowing: local wins; userEntry with same id as a local entry → shadowed.
  const localIds = new Set(
    all.filter((r) => r.scope === "local").map((r) => r.entry.id),
  );
  const userIds = new Set(
    all.filter((r) => r.scope === "user").map((r) => r.entry.id),
  );

  const rows: ListRow[] = all.map((r) => {
    let status: ListRow["status"] = r.present ? "active" : "missing";
    let shadowedBy: Scope | undefined;
    let shadows: Scope[] | undefined;

    if (r.scope === "user" && localIds.has(r.entry.id)) {
      status = "shadowed";
      shadowedBy = "local";
    } else if (r.scope === "local" && userIds.has(r.entry.id)) {
      shadows = ["user"];
    }

    return {
      id: r.entry.id,
      name: r.entry.name,
      version: deriveVersion(r.entry),
      ref: r.entry.source.ref,
      commit: r.entry.source.commit,
      scope: r.scope,
      status,
      path: path.join(paths(r.scope).root, r.entry.path),
      shadowedBy,
      shadows,
      locator: r.entry.source.locator,
    };
  });

  rows.sort((a, b) =>
    a.id === b.id ? a.scope.localeCompare(b.scope) : a.id.localeCompare(b.id),
  );

  emit({ command: "list", scopes, skills: rows }, () => renderTable(rows));
  flush();
  return 0;
}

function renderTable(rows: ListRow[]): string {
  if (rows.length === 0) return "No skills installed.";
  const headers = ["ID", "NAME", "VERSION", "SCOPE", "STATUS"];
  const widths = [
    Math.max(headers[0]!.length, ...rows.map((r) => r.id.length)),
    Math.max(headers[1]!.length, ...rows.map((r) => r.name.length)),
    Math.max(headers[2]!.length, ...rows.map((r) => r.version.length)),
    Math.max(headers[3]!.length, ...rows.map((r) => r.scope.length)),
    Math.max(headers[4]!.length, ...rows.map((r) => statusLabel(r).length)),
  ];
  const pad = (s: string, w: number): string => s.padEnd(w, " ");
  const lines = [
    headers.map((h, i) => pad(h, widths[i]!)).join("  "),
    rows
      .map((r) =>
        [
          pad(r.id, widths[0]!),
          pad(r.name, widths[1]!),
          pad(r.version, widths[2]!),
          pad(r.scope, widths[3]!),
          pad(statusLabel(r), widths[4]!),
        ].join("  "),
      )
      .join("\n"),
  ];
  return lines.join("\n");
}

function statusLabel(r: ListRow): string {
  if (r.status === "shadowed" && r.shadowedBy)
    return `shadowed by ${r.shadowedBy}`;
  return r.status;
}
