import { fetchGit } from "./git.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

export async function fetchGitlab(
  parsed: ParsedLocator,
  ctx: FetchContext,
): Promise<ResolvedSource> {
  if (parsed.type !== "gitlab") {
    throw new Error(
      `fetchGitlab called with non-gitlab locator: ${parsed.raw}`,
    );
  }
  return fetchGit(parsed, ctx);
}
