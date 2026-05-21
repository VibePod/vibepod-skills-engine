import { fetchGit } from "./git.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

export async function fetchGithub(parsed: ParsedLocator, ctx: FetchContext): Promise<ResolvedSource> {
  if (parsed.type !== "github") {
    throw new Error(`fetchGithub called with non-github locator: ${parsed.raw}`);
  }
  return fetchGit(parsed, ctx);
}
