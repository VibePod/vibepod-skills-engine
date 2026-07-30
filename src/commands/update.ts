import { loadRegistry } from "../registry/registry.js";
import { emit, flush, logError, logInfo, logSuccess } from "../utils/output.js";
import type { Scope } from "../utils/paths.js";
import { addCommand } from "./add.js";

export interface UpdateOptions {
  scope: Scope;
  id?: string;
}

export async function updateCommand(opts: UpdateOptions): Promise<number> {
  const reg = await loadRegistry(opts.scope);
  const ids = opts.id ? [opts.id] : Object.keys(reg.skills);
  if (ids.length === 0) {
    emit(
      { command: "update", scope: opts.scope, updated: [] },
      () => "Nothing to update",
    );
    flush();
    return 0;
  }
  const updated: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];
  for (const id of ids) {
    const entry = reg.skills[id];
    if (!entry) {
      logError(`Unknown skill ${id} in ${opts.scope}`);
      failed.push({ id, error: "not in registry" });
      continue;
    }
    logInfo(`Updating ${id} from ${entry.source}`);
    const rc = await addCommand({
      locator: entry.source,
      scope: opts.scope,
      id: entry.idOverride ?? id,
    });
    if (rc === 0) updated.push(id);
    else failed.push({ id, error: `add returned ${rc}` });
  }
  emit(
    { command: "update", scope: opts.scope, updated, failed },
    () => `Updated ${updated.length}, failed ${failed.length}`,
  );
  flush();
  if (failed.length > 0) return 1;
  logSuccess(`Update complete (${opts.scope})`);
  return 0;
}
