import crypto from "node:crypto";
import path from "node:path";

import pacote from "pacote";

import { ensureDir, removeDir } from "../utils/fs.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

export async function fetchNpm(
  parsed: ParsedLocator,
  ctx: FetchContext,
): Promise<ResolvedSource> {
  if (parsed.type !== "npm" || !parsed.package) {
    throw new Error(`fetchNpm called with non-npm locator: ${parsed.raw}`);
  }
  const spec = parsed.version
    ? `${parsed.package}@${parsed.version}`
    : parsed.package;
  const key = crypto.createHash("sha1").update(spec).digest("hex").slice(0, 12);
  const target = path.join(ctx.cacheDir, "npm", key);

  await removeDir(target);
  await ensureDir(target);

  const manifest = await pacote.manifest(spec);
  await pacote.extract(spec, target);

  return {
    type: "npm",
    provider: "npm",
    dir: target,
    version: manifest.version,
    package: parsed.package,
    locator: parsed.raw,
  };
}
