import fs from "node:fs/promises";
import path from "node:path";

import { exists, removeDir } from "../utils/fs.js";
import { emit, flush, logSuccess } from "../utils/output.js";
import { cacheRoot } from "../utils/paths.js";

// Only the source-fetch areas are engine-owned. Other entries under the cache
// root (e.g. the host CLI's `empty-local-skills` mount source) are left alone.
const SOURCE_CACHE_DIRS = ["git", "npm"];

async function countEntries(dir: string): Promise<number> {
  try {
    return (await fs.readdir(dir)).length;
  } catch {
    return 0;
  }
}

export async function cacheClearCommand(): Promise<number> {
  const root = cacheRoot();
  const cleared: Array<{ source: string; path: string; entries: number }> = [];

  for (const name of SOURCE_CACHE_DIRS) {
    const dir = path.join(root, name);
    if (!(await exists(dir))) continue;
    const entries = await countEntries(dir);
    await removeDir(dir);
    cleared.push({ source: name, path: dir, entries });
  }

  const total = cleared.reduce((sum, c) => sum + c.entries, 0);
  emit({ command: "cache clear", path: root, cleared, entries: total }, () =>
    total === 0
      ? `Cache at ${root} is already empty`
      : `Removed ${total} cached source(s) from ${root}`,
  );
  flush();
  logSuccess("Cache cleared");
  return 0;
}
