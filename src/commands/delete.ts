import path from "node:path";

import {
  loadLockfile,
  removeLockEntry,
  saveLockfile,
} from "../registry/lockfile.js";
import {
  loadRegistry,
  removeRegistryEntry,
  saveRegistry,
} from "../registry/registry.js";
import { removeDir } from "../utils/fs.js";
import { emit, flush, logError, logSuccess } from "../utils/output.js";
import { paths, type Scope } from "../utils/paths.js";

export interface DeleteOptions {
  id: string;
  scope: Scope;
}

export async function deleteCommand(opts: DeleteOptions): Promise<number> {
  const { id, scope } = opts;
  const reg = await loadRegistry(scope);
  const lock = await loadLockfile(scope);

  const inRegistry = !!reg.skills[id];
  const inLock = !!lock.skills[id];

  if (!inRegistry && !inLock) {
    logError(`Skill "${id}" not found in ${scope} scope`);
    emit(
      { command: "delete", id, scope, removed: false },
      () => `Skill ${id} not found`,
    );
    flush();
    return 1;
  }

  await saveRegistry(scope, removeRegistryEntry(reg, id));
  await saveLockfile(scope, removeLockEntry(lock, id));

  const installPath = path.join(paths(scope).installed, id);
  await removeDir(installPath);

  emit(
    { command: "delete", id, scope, removed: true, path: installPath },
    () => `Removed ${id} from ${scope} scope`,
  );
  flush();
  logSuccess(`Deleted ${id}`);
  return 0;
}
