import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import fsExtra from "fs-extra";

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(p: string): Promise<void> {
  await fsExtra.ensureDir(p);
}

export async function copyDir(src: string, dest: string): Promise<void> {
  await fsExtra.copy(src, dest, { overwrite: true, errorOnExist: false });
}

export async function symlinkDir(src: string, dest: string): Promise<void> {
  await fsExtra.remove(dest);
  await fs.symlink(path.resolve(src), dest, "dir");
}

export async function removeDir(p: string): Promise<void> {
  await fsExtra.remove(p);
}

export async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(p, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return fallback;
    throw err;
  }
}

export async function writeJson(p: string, value: unknown): Promise<void> {
  await fsExtra.ensureDir(path.dirname(p));
  await fs.writeFile(p, JSON.stringify(value, null, 2) + "\n", "utf-8");
}

export async function sha256Dir(dir: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  const entries: string[] = [];
  await collect(dir, dir, entries);
  entries.sort();
  for (const rel of entries) {
    const abs = path.join(dir, rel);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) continue;
    const content = await fs.readFile(abs);
    hash.update(rel);
    hash.update("\0");
    hash.update(content);
  }
  return hash.digest("hex");
}

async function collect(
  dir: string,
  root: string,
  out: string[],
): Promise<void> {
  const items = await fs.readdir(dir, { withFileTypes: true });
  for (const item of items) {
    const abs = path.join(dir, item.name);
    if (item.isDirectory()) {
      await collect(abs, root, out);
    } else if (item.isFile() || item.isSymbolicLink()) {
      out.push(path.relative(root, abs));
    }
  }
}
