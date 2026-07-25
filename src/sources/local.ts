import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { exists } from "../utils/fs.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

/** `~` and `~/x` resolve against the current user's home directory. */
function expandTilde(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export async function fetchLocal(parsed: ParsedLocator, _ctx: FetchContext): Promise<ResolvedSource> {
  if (parsed.type !== "local" || !parsed.path) {
    throw new Error(`fetchLocal called with non-local locator: ${parsed.raw}`);
  }
  const abs = path.resolve(expandTilde(parsed.path));
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
