import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";

import { ensureDir } from "./fs.js";

export async function extractTarball(tarballPath: string, destination: string): Promise<void> {
  await ensureDir(destination);
  await pipeline(
    fs.createReadStream(tarballPath),
    tar.extract({ cwd: destination, strip: 1 }),
  );
}

export async function copySubpath(source: string, subpath: string | undefined, dest: string): Promise<string> {
  const from = subpath ? path.join(source, subpath) : source;
  await ensureDir(path.dirname(dest));
  const fsExtra = await import("fs-extra");
  await fsExtra.default.copy(from, dest, { overwrite: true });
  return from;
}
