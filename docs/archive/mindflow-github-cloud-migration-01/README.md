# MINDFLOW-GITHUB-CLOUD-MIGRATION-01

Twenty-eight commits of finished work existed only on one machine. They are now
on GitHub, and a clone taken from GitHub — not from that machine — installs,
validates and builds the project on its own.

## Remote state before the push

```
origin  https://github.com/lipe85goes/cognitive-mind.git
upstream of the working branch  origin/v06-portal-requires-lights
```

Queried from the server rather than the local cache (`git ls-remote`):

| ref | remote |
| --- | --- |
| `v06-portal-requires-lights` | `894b677` |
| `main` | `3047a14` |
| remote default `HEAD` | `refs/heads/v03-route-board-2` |

`894b677` is an ancestor of the local `HEAD`, and `origin/..HEAD` held **0**
commits the local clone did not have. So the push was a plain fast-forward: no
force, no lease, no history rewrite, nothing to reconcile.

## Secret safety gate

1 058 tracked files and all 636 files in the 28-commit delta were scanned for
credential shapes — cloud keys, GitHub/Slack/OpenAI tokens, private key blocks,
JWTs, connection strings carrying a password, assigned secret literals,
Authorization headers — and for credential-shaped filenames.

```
TRACKED / DELTA FINDINGS: none
local-only credential-shaped paths: 0
SECRET_GATE = GREEN
```

The repository has no `.env` of any kind, tracked or untracked, because it does
not need one.

## Local-only inventory

`git ls-files --others --exclude-standard` returned **0**: there was no
uncommitted work at all. `.git/info/exclude` holds only the default comments, and
the local git config is stock — no hooks, filters or custom excludes that a
clone would miss.

Everything ignored on disk, classified:

| path | size | class |
| --- | --- | --- |
| `.next/` | 2 929 MB | **A — regenerable** (`next build`) |
| `node_modules/` | 669 MB | **A — regenerable** (`npm ci`) |
| `tsconfig.tsbuildinfo` | 0.9 MB | **A — regenerable** |
| `tools/blender/__pycache__/` | 0.2 MB | **A — regenerable** |
| `next-env.d.ts` | 0.0 MB | **A — regenerable** (Next writes it on build) |
| `.vercel/` | 0.0 MB | **B — machine-specific** deployment link |
| `.claude/settings.local.json` | 0.0 MB | **B — machine-specific** |

Nothing in class **C** (secret), **D** (should be tracked) or **E** (intentional
local-only). Nothing ignored is needed to build, test, validate or regenerate
assets — the fresh clone proves it.

## Repository health

| | |
| --- | --- |
| tracked files | 1 058 |
| working tree | 242.8 MB, of which `docs/archive` is **232.1 MB** (95%) |
| `.git` | 411.4 MB |
| largest tracked file | 2.6 MB |
| files over GitHub's 50 MB warning | **0** |
| objects pushed | 1 021 across 28 commits |

`docs/archive` is large but is the project's decision record, and no single file
is near any limit. No Git LFS and no history rewrite were needed, and neither was
attempted.

## Push

```
894b677..50de881  v06-portal-requires-lights -> v06-portal-requires-lights
```

Proven against the server afterwards, not taken from the push output:

```
LOCAL  HEAD 50de8813988352470755b22d2d31bf68229f94d5
REMOTE refs/heads/v06-portal-requires-lights 50de8813988352470755b22d2d31bf68229f94d5
LOCAL_HEAD == REMOTE_BRANCH_HEAD : True
ahead 0   behind 0
```

## Fresh clone proof

Cloned from `https://github.com/lipe85goes/cognitive-mind.git` into a directory
that had never held this project. `FRESH_CLONE_HEAD` = `50de881`.

**Zero borrowed state**, checked rather than assumed:

```
node_modules          present: False
.next                 present: False
.vercel               present: False
next-env.d.ts         present: False
tsconfig.tsbuildinfo  present: False
reparse points (junction/symlink) in the clone: 0
```

The last line matters: an earlier mission linked a clone's `node_modules` to the
original tree with a junction to save time. Nothing here is linked — the clone
installed its own.

| step | result |
| --- | --- |
| `npm ci` | exit 0, 424 packages, 477.8 s |
| `npx eslint .` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `npx next build` | exit 0, compiled in 36.6 s |
| CORE battery | 15/15, `VALIDATION_CHECK_IS_READ_ONLY`, `CORE_BATTERY_PASSED` |
| DEEP `final-acceptance` | 1080/1080, 270/270, recovery 9/9, 5 artifacts MATCHES |
| clone `git status` after all of it | 0 entries |

`FRESH_CLONE_CAN_BUILD = YES` · `FRESH_CLONE_CAN_VALIDATE = YES`

Node v24.15.0, npm 11.12.1, `package-lock.json` lockfileVersion 3.

## Environment requirements

**None.** The only `process.env` reads anywhere are tooling knobs —
`ROUTE_VALIDATION_OUT`, `ROUTE_VALIDATION_OUTPUT_DIR`, `PLAYWRIGHT_DIR`,
`PYTHONHASHSEED` — and the application reads none of them. Development, tests,
production build and validation all run with no environment file, which is why
no `.env.example` was created: a template with nothing in it is a thing to
maintain and mislead, not a help.

## Special tooling

| requirement | needed for |
| --- | --- |
| Node + npm | **core** — install, lint, typecheck, build, all validation |
| Blender | 9 scripts under `tools/blender/` — regenerating dioramas and GLBs only |
| Python | 13 scripts under `tools/` — the same asset pipeline |
| `sharp` | 5 scripts under `tools/assets/` — encoding layers |

A machine with only Node can develop the entire application. Blender and Python
are the asset pipeline, and are not on the path of any build or check.

## Codespaces readiness

`CODESPACES_BASELINE_READY`. Clone plus `npm ci` is the whole setup; there are no
required OS packages, no services, no ports beyond Next's own, and no secrets to
inject. A `.devcontainer` would mostly pin the Node version — worth doing when
someone wants it, not needed to work from the cloud today.

## Onboarding debt, recorded not fixed

1. **No `engines` / `packageManager`.** Developed on Node 24 / npm 11; nothing
   enforces it. Pinning changes the project's contract and is not migration work.
2. **`sharp` is not a declared dependency.** Five asset scripts import it; it
   resolves only because Next pulls it in transitively. It worked in the fresh
   clone, but it is working by accident.
3. **`npm audit` reports 10 vulnerabilities** — 1 critical, 6 high, 2 moderate,
   1 low. Untouched here: dependency upgrades were explicitly out of scope, and
   upgrading under a migration is how migrations get blamed for regressions.
4. **The remote's default branch is `v03-route-board-2`**, which is historical.
   Changing it is the owner's call.

## Local copy

`LOCAL_COPY_SAFE_TO_ARCHIVE = YES`
`LOCAL_COPY_SAFE_TO_DELETE = YES`

Everything that is not regenerable is on GitHub, and a clone from GitHub was
shown to install, validate and build without touching the original tree. The two
machine-specific files (`.vercel/`, `.claude/settings.local.json`) are local
configuration, not project content.

**Nothing was deleted by this mission.** That is deliberate: the statement above
is a technical clearance, and the decision to act on it belongs to the operator.
