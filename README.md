# vibepod-skills-engine

Container engine that installs, validates, and manages [VibePod](https://vibepod.dev) skills. It is called by `vp skills` in [vibepod-cli](https://github.com/VibePod/vibepod-cli) so users never need Node, npm, pnpm, git, or skill-specific tooling installed locally.

## Image

```
{VP_IMAGE_NAMESPACE}/skills-engine:latest
```

Default namespace: `vibepod`. Override with `VP_IMAGE_NAMESPACE` or pin the whole image with `VP_SKILLS_ENGINE_IMAGE`.

## CLI surface

```
skills-engine add <locator> [--id <id>] --scope local|user [--link] [--json]
skills-engine update [<id>] --scope local|user [--json]
skills-engine delete <id> --scope local|user [--json]
skills-engine list [--scope local|user] [--json]
skills-engine sync --scope local|user [--json]
skills-engine validate <path> [--json]
skills-engine resolve --scope local|user [--json]
```

## Mounts

```
-v <local-skills-dir>:/vibepod/local-skills
-v <user-skills-dir>:/vibepod/user-skills
-v <cache-dir>:/vibepod/cache
```

The project root is **not** mounted — the engine only writes to skill directories and the cache.

## Supported sources

| Priority | Source       | Locator example                                    |
|----------|--------------|----------------------------------------------------|
| 1        | Local folder | `./skills/foo` or `/abs/path`                      |
| 2        | GitHub       | `github:org/repo//skills/foo#v1.0.0`               |
| 3        | npm          | `npm:@acme/vibepod-skill-foo@1.2.0`                |
| 4        | GitLab       | `gitlab:group/repo//skills/foo#main`               |
| 5        | Generic Git  | `https://git.example.com/org/repo.git//skills/foo` |

## Development

```bash
npm install
npm run build
npm test
```

Run against a temp directory:

```bash
mkdir -p /tmp/vp/local-skills /tmp/vp/user-skills /tmp/vp/cache
node dist/cli.js list --json
```

### Build the image locally

```bash
docker build -t vibepod/skills-engine:dev .
```

Point `vp` at it: `export VP_SKILLS_ENGINE_IMAGE=vibepod/skills-engine:dev`.

## License

MIT
