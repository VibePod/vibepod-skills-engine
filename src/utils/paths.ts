import path from "node:path";

export type Scope = "local" | "user";

export interface SkillPaths {
  root: string;
  installed: string;
  registry: string;
  lockfile: string;
}

const SCOPE_ROOT_ENV: Record<Scope, string> = {
  local: "VIBEPOD_LOCAL_SKILLS",
  user: "VIBEPOD_USER_SKILLS",
};

const SCOPE_DEFAULT: Record<Scope, string> = {
  local: "/vibepod/local-skills",
  user: "/vibepod/user-skills",
};

export function scopeRoot(scope: Scope): string {
  const fromEnv = process.env[SCOPE_ROOT_ENV[scope]];
  return fromEnv && fromEnv.length > 0 ? fromEnv : SCOPE_DEFAULT[scope];
}

export function cacheRoot(): string {
  return process.env.VIBEPOD_CACHE ?? "/vibepod/cache";
}

export function paths(scope: Scope): SkillPaths {
  const root = scopeRoot(scope);
  return {
    root,
    installed: path.join(root, "installed"),
    registry: path.join(root, "skills.json"),
    lockfile: path.join(root, "skills-lock.json"),
  };
}

export function bothScopes(): Scope[] {
  return ["user", "local"];
}
