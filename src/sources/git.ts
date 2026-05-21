import crypto from "node:crypto";
import path from "node:path";

import { simpleGit } from "simple-git";

import { ensureDir, removeDir } from "../utils/fs.js";
import type { FetchContext, ParsedLocator, ResolvedSource } from "./types.js";

function repoUrl(parsed: ParsedLocator): string {
  if (parsed.type === "github" && parsed.repo) {
    return `https://github.com/${parsed.repo}.git`;
  }
  if (parsed.type === "gitlab" && parsed.repo) {
    return `https://gitlab.com/${parsed.repo}.git`;
  }
  if (parsed.type === "git" && parsed.url) {
    return parsed.url;
  }
  throw new Error(`Cannot derive git URL from locator: ${parsed.raw}`);
}

function cacheKey(url: string, ref: string | undefined): string {
  const h = crypto.createHash("sha1").update(`${url}@${ref ?? "HEAD"}`).digest("hex");
  return h.slice(0, 12);
}

function looksLikeCommit(ref: string): boolean {
  return /^[a-f0-9]{4,40}$/i.test(ref);
}

export async function fetchGit(parsed: ParsedLocator, ctx: FetchContext): Promise<ResolvedSource> {
  const url = repoUrl(parsed);
  const ref = parsed.ref;
  const key = cacheKey(url, ref);
  const target = path.join(ctx.cacheDir, "git", key);

  await removeDir(target);
  await ensureDir(target);

  if (ref) {
    // `git clone --depth=1 --branch <ref>` works for branches AND tags. If it
    // fails, either the ref doesn't exist (most common) or the ref is a commit
    // SHA, which `--branch` doesn't accept.
    try {
      await simpleGit().clone(url, target, ["--depth=1", "--branch", ref]);
    } catch (shallowErr) {
      await removeDir(target);
      await ensureDir(target);

      if (!looksLikeCommit(ref)) {
        throw new Error(
          `Could not resolve git ref "${ref}" on ${url}. ` +
            `Verify it's a valid branch, tag, or commit SHA — e.g. \`git ls-remote ${url}\`.`,
        );
      }

      try {
        await simpleGit().clone(url, target);
        await simpleGit(target).checkout(ref);
      } catch (commitErr) {
        await removeDir(target);
        const detail = (commitErr as Error).message.split("\n")[0];
        throw new Error(`Could not resolve git commit "${ref}" on ${url}: ${detail}`);
      }
    }
  } else {
    try {
      await simpleGit().clone(url, target, ["--depth=1"]);
    } catch (err) {
      await removeDir(target);
      throw new Error(`Failed to clone ${url}: ${(err as Error).message.split("\n")[0]}`);
    }
  }

  const commit = (await simpleGit(target).revparse(["HEAD"])).trim();

  return {
    type: "git",
    provider: parsed.type === "github" || parsed.type === "gitlab" ? parsed.type : "git",
    dir: target,
    subpath: parsed.subpath,
    ref,
    commit,
    repo: parsed.repo,
    locator: parsed.raw,
  };
}
