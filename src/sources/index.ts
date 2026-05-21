import { fetchGit } from "./git.js";
import { fetchGithub } from "./github.js";
import { fetchGitlab } from "./gitlab.js";
import { fetchLocal } from "./local.js";
import { parseLocator } from "./locator.js";
import { fetchNpm } from "./npm.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

export { parseLocator };
export type { FetchContext, ParsedLocator, ResolvedSource };

export async function fetchSource(locator: string, ctx: FetchContext): Promise<ResolvedSource> {
  const parsed = parseLocator(locator);
  switch (parsed.type) {
    case "local":
      return fetchLocal(parsed, ctx);
    case "github":
      return fetchGithub(parsed, ctx);
    case "gitlab":
      return fetchGitlab(parsed, ctx);
    case "git":
      return fetchGit(parsed, ctx);
    case "npm":
      return fetchNpm(parsed, ctx);
  }
}
