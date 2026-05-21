export type SourceType = "local" | "github" | "gitlab" | "git" | "npm";

export interface ParsedLocator {
  type: SourceType;
  raw: string;
  repo?: string;
  url?: string;
  subpath?: string;
  ref?: string;
  package?: string;
  version?: string;
  path?: string;
}

export interface ResolvedSource {
  type: "git" | "npm" | "local";
  provider: SourceType;
  /** Filesystem dir holding the (possibly extracted) source root */
  dir: string;
  /** Subpath within `dir` that points at the actual skill folder */
  subpath?: string;
  /** Git ref/version that was requested */
  ref?: string;
  /** Resolved commit hash or npm version */
  commit?: string;
  version?: string;
  repo?: string;
  package?: string;
  /** Original normalized locator */
  locator: string;
}

export interface FetchContext {
  cacheDir: string;
}

export interface Source {
  matches(locator: string): boolean;
  parse(locator: string): ParsedLocator;
  fetch(parsed: ParsedLocator, ctx: FetchContext): Promise<ResolvedSource>;
}
