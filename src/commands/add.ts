import fs from "node:fs/promises";
import path from "node:path";

import {
  loadLockfile,
  saveLockfile,
  upsertLockEntry,
} from "../registry/lockfile.js";
import {
  loadRegistry,
  saveRegistry,
  upsertRegistryEntry,
} from "../registry/registry.js";
import { fetchSource } from "../sources/index.js";
import {
  expandBundleLocator,
  pinLocatorToResolved,
} from "../sources/locator.js";
import type { ResolvedSource } from "../sources/types.js";
import {
  copyDir,
  ensureDir,
  exists,
  removeDir,
  sha256Dir,
  symlinkDir,
} from "../utils/fs.js";
import { emit, flush, logError, logInfo, logSuccess } from "../utils/output.js";
import { cacheRoot, paths, type Scope } from "../utils/paths.js";
import { slugify } from "../utils/slug.js";
import type {
  LockEntry,
  Lockfile,
  Registry,
} from "../validation/skill-schema.js";
import { validateSkill } from "../validation/validate-skill.js";

export interface AddOptions {
  locator: string;
  scope: Scope;
  id?: string;
  link?: boolean;
}

interface InstallContext {
  scope: Scope;
  resolved: ResolvedSource;
  link: boolean;
}

interface InstallOutcome {
  id: string;
  installDir: string;
  name: string;
  version?: string;
  perSkillLocator: string;
}

async function bundleSubdirs(root: string): Promise<string[]> {
  const entries = await fs
    .readdir(root, { withFileTypes: true })
    .catch(() => null);
  if (entries === null) return [];
  const found: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (await exists(path.join(root, entry.name, "SKILL.md"))) {
      found.push(entry.name);
    }
  }
  found.sort();
  return found;
}

/**
 * Find a bundle of skills relative to `sourceRoot`.
 *
 * 1. Direct: subdirs of `sourceRoot` containing `SKILL.md`.
 * 2. Fallback: a `skills/` subdirectory whose subdirs contain `SKILL.md`
 *    (the convention used by obra/superpowers and similar bundle repos).
 *
 * Returns the list of skill subpaths *relative to `sourceRoot`*, so the
 * per-skill locator can be built with `expandBundleLocator(locator, subpath)`.
 */
async function findBundleEntries(sourceRoot: string): Promise<string[]> {
  const direct = await bundleSubdirs(sourceRoot);
  if (direct.length > 0) return direct;

  const skillsDir = path.join(sourceRoot, "skills");
  if (await exists(skillsDir)) {
    const nested = await bundleSubdirs(skillsDir);
    if (nested.length > 0) return nested.map((name) => `skills/${name}`);
  }

  return [];
}

async function installOne(
  ctx: InstallContext,
  sourceRoot: string,
  perSkillLocator: string,
  idOverride: string | undefined,
  lock: Lockfile,
  registry: Registry,
): Promise<
  | { lock: Lockfile; registry: Registry; outcome: InstallOutcome }
  | { error: string }
> {
  const validation = await validateSkill(sourceRoot);
  if (!validation.ok || !validation.frontmatter) {
    return { error: `validation failed: ${validation.errors.join("; ")}` };
  }

  const id = idOverride ?? slugify(validation.frontmatter.name);
  const installDir = path.join(paths(ctx.scope).installed, id);

  await removeDir(installDir);
  if (ctx.link && ctx.resolved.type === "local") {
    await symlinkDir(sourceRoot, installDir);
  } else {
    await copyDir(sourceRoot, installDir);
  }
  const checksum = ctx.link ? undefined : await sha256Dir(installDir);

  // Registry keeps the user's intent (e.g. "track default branch"); the
  // lockfile gets the locator pinned to the resolved commit/version so that
  // `sync` is reproducible even after the upstream ref moves.
  const lockLocator = pinLocatorToResolved(perSkillLocator, ctx.resolved);

  const entry: LockEntry = {
    id,
    name: validation.frontmatter.name,
    version: validation.frontmatter.version,
    path: path.relative(paths(ctx.scope).root, installDir),
    source: {
      type: ctx.resolved.type,
      provider: ctx.resolved.provider,
      repo: ctx.resolved.repo,
      package: ctx.resolved.package,
      path: ctx.resolved.subpath,
      ref: ctx.resolved.ref,
      commit: ctx.resolved.commit,
      locator: lockLocator,
    },
    installedAt: new Date().toISOString(),
    checksum,
    ...(ctx.link ? { linked: true } : {}),
  };

  const nextLock = upsertLockEntry(lock, entry);
  const nextRegistry = upsertRegistryEntry(
    registry,
    id,
    perSkillLocator,
    ctx.scope,
    idOverride,
  );

  return {
    lock: nextLock,
    registry: nextRegistry,
    outcome: {
      id,
      installDir,
      name: validation.frontmatter.name,
      version: validation.frontmatter.version,
      perSkillLocator,
    },
  };
}

export async function addCommand(opts: AddOptions): Promise<number> {
  const { locator, scope } = opts;
  logInfo(`Resolving ${locator} (scope=${scope})`);

  await ensureDir(paths(scope).installed);

  let resolved: ResolvedSource;
  try {
    resolved = await fetchSource(locator, { cacheDir: cacheRoot() });
  } catch (err) {
    logError(`Failed to fetch source: ${(err as Error).message}`);
    flush();
    return 1;
  }

  const sourceRoot = resolved.subpath
    ? path.join(resolved.dir, resolved.subpath)
    : resolved.dir;

  const hasSkillMd = await exists(path.join(sourceRoot, "SKILL.md"));
  const ctx: InstallContext = { scope, resolved, link: !!opts.link };

  let lock = await loadLockfile(scope);
  let registry = await loadRegistry(scope);

  // Single-skill install
  if (hasSkillMd) {
    const result = await installOne(
      ctx,
      sourceRoot,
      locator,
      opts.id,
      lock,
      registry,
    );
    if ("error" in result) {
      logError(`SKILL.md validation failed for ${sourceRoot}: ${result.error}`);
      flush();
      return 1;
    }
    await saveLockfile(scope, result.lock);
    await saveRegistry(scope, result.registry);

    emit(
      {
        command: "add",
        id: result.outcome.id,
        scope,
        locator,
        path: result.outcome.installDir,
        name: result.outcome.name,
        version: result.outcome.version,
        commit: resolved.commit,
        linked: !!opts.link,
      },
      () =>
        `Added ${result.outcome.id} (${result.outcome.name}) to ${result.outcome.installDir}`,
    );
    flush();
    logSuccess(`Installed ${result.outcome.id} into ${scope} scope`);
    return 0;
  }

  // Bundle install
  const subpaths = await findBundleEntries(sourceRoot);
  if (subpaths.length === 0) {
    logError(
      `SKILL.md not found at ${sourceRoot} and no bundle of skills detected ` +
        `(looked for immediate subdirs and a skills/ subdirectory containing SKILL.md files)`,
    );
    flush();
    return 1;
  }

  if (opts.id) {
    logError(
      `--id cannot be used with a bundle install (${subpaths.length} skills detected: ${subpaths.join(", ")})`,
    );
    flush();
    return 1;
  }

  logInfo(`Bundle detected: ${subpaths.length} skills under ${sourceRoot}`);

  const installed: InstallOutcome[] = [];
  const failed: Array<{ subpath: string; error: string }> = [];

  for (const subpath of subpaths) {
    const subRoot = path.join(sourceRoot, subpath);
    let perSkillLocator: string;
    try {
      perSkillLocator = expandBundleLocator(locator, subpath);
    } catch (err) {
      failed.push({ subpath, error: (err as Error).message });
      continue;
    }
    const result = await installOne(
      ctx,
      subRoot,
      perSkillLocator,
      undefined,
      lock,
      registry,
    );
    if ("error" in result) {
      failed.push({ subpath, error: result.error });
      continue;
    }
    lock = result.lock;
    registry = result.registry;
    installed.push(result.outcome);
    logInfo(`  + ${result.outcome.id} (${result.outcome.name})`);
  }

  await saveLockfile(scope, lock);
  await saveRegistry(scope, registry);

  if (failed.length > 0) {
    logError(`${failed.length} skill(s) failed`);
  }

  emit(
    {
      command: "add",
      bundle: true,
      scope,
      locator,
      installed: installed.map((o) => ({
        id: o.id,
        name: o.name,
        version: o.version,
        path: o.installDir,
        locator: o.perSkillLocator,
      })),
      failed,
    },
    () =>
      [
        `Bundle ${locator}: installed ${installed.length}, failed ${failed.length}`,
        ...installed.map((o) => `  + ${o.id} (${o.name})`),
        ...failed.map((f) => `  ! ${f.subpath}: ${f.error}`),
      ].join("\n"),
  );
  flush();
  if (failed.length > 0) return 1;
  logSuccess(`Installed ${installed.length} skills into ${scope} scope`);
  return 0;
}
