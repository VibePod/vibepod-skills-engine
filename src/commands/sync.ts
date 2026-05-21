import path from "node:path";

import { loadLockfile, saveLockfile } from "../registry/lockfile.js";
import { fetchSource } from "../sources/index.js";
import { copyDir, ensureDir, exists, removeDir, sha256Dir } from "../utils/fs.js";
import { emit, flush, logError, logInfo, logSuccess, logWarn } from "../utils/output.js";
import { cacheRoot, paths, type Scope } from "../utils/paths.js";

export interface SyncOptions {
  scope: Scope;
}

export async function syncCommand(opts: SyncOptions): Promise<number> {
  const { scope } = opts;
  const lock = await loadLockfile(scope);
  const ids = Object.keys(lock.skills);
  if (ids.length === 0) {
    emit({ command: "sync", scope, restored: [], unchanged: [] }, () => `Nothing to sync (${scope})`);
    flush();
    return 0;
  }
  await ensureDir(paths(scope).installed);

  const restored: string[] = [];
  const unchanged: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of ids) {
    const entry = lock.skills[id]!;
    const absInstall = path.join(paths(scope).root, entry.path);

    if (await exists(absInstall)) {
      if (entry.checksum) {
        const current = await sha256Dir(absInstall);
        if (current === entry.checksum) {
          unchanged.push(id);
          continue;
        }
        logWarn(`Checksum mismatch for ${id}, restoring from lock`);
      } else {
        unchanged.push(id);
        continue;
      }
    }

    logInfo(`Restoring ${id} from lock`);
    try {
      const resolved = await fetchSource(entry.source.locator, { cacheDir: cacheRoot() });
      const sourceRoot = resolved.subpath ? path.join(resolved.dir, resolved.subpath) : resolved.dir;
      await removeDir(absInstall);
      await copyDir(sourceRoot, absInstall);
      restored.push(id);
    } catch (err) {
      failed.push({ id, error: (err as Error).message });
      logError(`Failed to restore ${id}: ${(err as Error).message}`);
    }
  }

  if (failed.length > 0) {
    emit({ command: "sync", scope, restored, unchanged, failed }, () =>
      `Synced ${scope}: restored=${restored.length}, unchanged=${unchanged.length}, failed=${failed.length}`,
    );
    flush();
    return 1;
  }

  await saveLockfile(scope, lock); // touch lock (no semantic change), helps readers detect sync
  emit({ command: "sync", scope, restored, unchanged }, () =>
    `Synced ${scope}: restored=${restored.length}, unchanged=${unchanged.length}`,
  );
  flush();
  logSuccess(`Sync complete (${scope})`);
  return 0;
}
