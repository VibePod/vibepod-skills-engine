# Threat Model & Security Notes

## Trust boundaries

```
[ user → CLI ] → [ engine container ] → [ skills disk ]
       ┃                  ┃
       ┃                  ┃ writes only to mounted skill dirs
       ┃                  ┗ no execution of skill-side install scripts
       ┃
       ┗ user provides locator → fully resolved to commit/version in lock
```

## What the engine **does not** do

- Run skill-side install scripts (`postinstall`, etc.). `pacote` extracts tarballs without invoking lifecycle scripts.
- Mount the project root. Only `/.vibepod/skills`, the user skills dir, and the cache are reachable from inside the container.
- Follow symlinks out of the source folder during copy.
- Persist credentials. Auth (SSH keys, tokens) is passed in via env or mounts on each invocation and never written to the cache.

## Phase 5 hardening (planned + initial wiring)

| Capability                       | Status                                       |
|----------------------------------|----------------------------------------------|
| Checksums in lockfile (`sha256`) | Implemented (per skill, computed at install) |
| `--verify-signature`             | CLI flag stub — verifies detached signatures next to source archives when present (not enabled by default) |
| `--trusted` source allowlist     | Env-driven (`VIBEPOD_TRUSTED_SOURCES`) — enforced at locator parse time when set |
| SBOM generation                  | Wired into `publish.yml` via `anchore/sbom-action` |
| Vulnerability scan               | Wired into `publish.yml` via Trivy           |
| Offline install from cache       | Implemented in `sync` (uses cached source first when checksum matches) |

## Known limitations

- Branch installs (`#main`) are not reproducible by definition. The lockfile stores the resolved commit so `sync` still produces a stable tree.
- Generic Git over SSH requires the host to forward an SSH agent into the container. The current driver does not do this automatically — users hitting private repos must use HTTPS + tokens for now.
- Local symlink installs (`--link`) skip checksums; `sync` won't detect drift in those skills.
