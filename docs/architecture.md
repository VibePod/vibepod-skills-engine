# Skills Engine Architecture

## Layering

```
┌────────────────────────────────────────────┐
│ vibepod-cli (Python, host)                 │
│   vp skills add/list/delete/sync/update    │
└─────────────────┬──────────────────────────┘
                  │ docker run + mounts
                  ▼
┌────────────────────────────────────────────┐
│ vibepod-skills-engine (Node, container)    │
│   commander CLI → command handlers         │
│   sources/ (local|github|gitlab|git|npm)   │
│   validation/ (gray-matter + zod)          │
│   registry/ (skills.json, skills-lock.json)│
│   utils/ (paths, fs, archive, slug)        │
└─────────────────┬──────────────────────────┘
                  │ writes
                  ▼
   /vibepod/local-skills   /vibepod/user-skills   /vibepod/cache
   (mounted from host)
```

## Mount contract

| Container path             | Host path                                  | Required |
|---------------------------|---------------------------------------------|----------|
| `/vibepod/local-skills`    | `<project>/.vibepod/skills`                | optional |
| `/vibepod/user-skills`     | `platformdirs.user_config_dir("vibepod")/skills` | optional |
| `/vibepod/cache`           | `<user-config-dir>/skills-cache` (or `/tmp`) | required for non-local sources |

The project root is **deliberately not mounted**. Source extraction and validation always happen against the cache directory; only validated skill folders are copied into the skill scope mounts.

## ID assignment

1. If `--id` is passed, use it verbatim.
2. Otherwise slugify `frontmatter.name`.
3. If that fails, fall back to the basename of the source folder.

IDs only live in `skills.json` / `skills-lock.json`. They never appear in locators or on-disk paths beyond `installed/<id>/`.

## Registry vs. lockfile

| File                | Authority       | Hand-editable? |
|---------------------|-----------------|----------------|
| `skills.json`       | User intent     | yes            |
| `skills-lock.json`  | Resolved state  | no             |

`sync` reads only `skills-lock.json` (and never re-resolves refs). `update` re-runs the locator → resolved-commit pipeline and rewrites the lock.

## Shadowing rule

Local always wins over user when the same ID is installed in both. The `resolve` command emits the merged index with `status: active|shadowed|missing` so the host CLI and downstream tooling don't have to re-implement the rule.
