import { readFileSync } from "node:fs";

export function getVersion(): string {
  const pkg = JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string };
  return pkg.version;
}
