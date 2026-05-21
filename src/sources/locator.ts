import type { ParsedLocator, ResolvedSource } from "./types.js";

const GIT_RE = /^([a-z]+):([^#]+?)(?:\/\/([^#]+))?(?:#(.+))?$/;
const NPM_RE = /^npm:(.+?)(?:@([^@/]+))?$/;

function enforceTrustedSources(locator: string): void {
  const allowList = process.env.VIBEPOD_TRUSTED_SOURCES;
  if (!allowList) return;
  const prefixes = allowList.split(",").map((s) => s.trim()).filter(Boolean);
  if (prefixes.length === 0) return;
  if (prefixes.some((prefix) => locator.startsWith(prefix))) return;
  throw new Error(
    `Locator "${locator}" is not in VIBEPOD_TRUSTED_SOURCES allowlist (${prefixes.join(", ")})`,
  );
}

/**
 * Build a per-skill locator from a bundle locator plus the subdir name.
 *
 * Git-based:   github:org/repo//skills          + foo → github:org/repo//skills/foo
 *              github:org/repo//skills#v1.0.0   + foo → github:org/repo//skills/foo#v1.0.0
 *              github:org/repo#v1.0.0           + foo → github:org/repo//foo#v1.0.0
 * Local:       ./bundle                          + foo → ./bundle/foo
 * Generic git: https://host/repo.git//skills#ref + foo → https://host/repo.git//skills/foo#ref
 */
export function expandBundleLocator(bundleLocator: string, subdir: string): string {
  const parsed = parseLocator(bundleLocator);
  if (parsed.type === "npm") {
    throw new Error("Bundle install is not supported for npm sources");
  }
  if (parsed.type === "local") {
    const base = parsed.path ?? bundleLocator;
    return base.endsWith("/") ? `${base}${subdir}` : `${base}/${subdir}`;
  }
  // Git-based: rebuild with extended subpath
  const newSubpath = parsed.subpath ? `${parsed.subpath}/${subdir}` : subdir;
  const ref = parsed.ref ? `#${parsed.ref}` : "";
  if (parsed.type === "git" && parsed.url) {
    return `${parsed.url}//${newSubpath}${ref}`;
  }
  return `${parsed.type}:${parsed.repo}//${newSubpath}${ref}`;
}

/**
 * Return a locator pinned to whatever was actually resolved. Used for the
 * lockfile entry so `sync` re-fetches the exact same content even if the
 * upstream branch/tag has since moved.
 *
 *  - git sources → replace any user-supplied ref with the resolved commit SHA
 *  - npm sources → pin to the resolved package version
 *  - local      → unchanged (paths have no version concept)
 */
export function pinLocatorToResolved(rawLocator: string, resolved: ResolvedSource): string {
  if (resolved.type === "local") return rawLocator;

  if (resolved.type === "npm") {
    if (!resolved.version || !resolved.package) return rawLocator;
    return `npm:${resolved.package}@${resolved.version}`;
  }

  if (resolved.type === "git" && resolved.commit) {
    const hashIdx = rawLocator.indexOf("#");
    const base = hashIdx >= 0 ? rawLocator.slice(0, hashIdx) : rawLocator;
    return `${base}#${resolved.commit}`;
  }

  return rawLocator;
}

export function parseLocator(raw: string): ParsedLocator {
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error("Empty locator");
  }

  enforceTrustedSources(trimmed);

  if (trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.startsWith("/")) {
    return { type: "local", raw: trimmed, path: trimmed };
  }

  if (trimmed.startsWith("npm:")) {
    const match = NPM_RE.exec(trimmed);
    if (!match) throw new Error(`Invalid npm locator: ${raw}`);
    const [, pkg, version] = match;
    return { type: "npm", raw: trimmed, package: pkg, version };
  }

  if (trimmed.startsWith("github:") || trimmed.startsWith("gitlab:")) {
    const match = GIT_RE.exec(trimmed);
    if (!match) throw new Error(`Invalid git locator: ${raw}`);
    const [, scheme, repo, subpath, ref] = match;
    return {
      type: scheme === "github" ? "github" : "gitlab",
      raw: trimmed,
      repo,
      subpath,
      ref,
    };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("git@")) {
    const hashIdx = trimmed.indexOf("#");
    const ref = hashIdx >= 0 ? trimmed.slice(hashIdx + 1) : undefined;
    const noRef = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
    const sub = noRef.indexOf("//");
    let url = noRef;
    let subpath: string | undefined;
    if (sub > 0 && noRef.indexOf("://") !== sub - 1) {
      url = noRef.slice(0, sub);
      subpath = noRef.slice(sub + 2);
    }
    return { type: "git", raw: trimmed, url, subpath, ref };
  }

  throw new Error(
    `Unrecognized locator: ${raw}. Expected ./path, /abs/path, npm:..., github:..., gitlab:..., or https://...`,
  );
}
