import fs from "node:fs/promises";
import path from "node:path";

import { exists } from "../utils/fs.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

export async function fetchLocal(parsed: ParsedLocator, _ctx: FetchContext): Promise<ResolvedSource> {
  if (parsed.type !== "local" || !parsed.path) {
    throw new Error(`fetchLocal called with non-local locator: ${parsed.raw}`);
  }
  const abs = path.resolve(parsed.path);
  if (!(await exists(abs))) {
    throw new Error(`Local skill path does not exist: ${abs}`);
  }
  const stat = await fs.stat(abs);
  if (!stat.isDirectory()) {
    throw new Error(`Local skill path is not a directory: ${abs}`);
  }
  return {
    type: "local",
    provider: "local",
    dir: abs,
    locator: parsed.raw,
  };
}
