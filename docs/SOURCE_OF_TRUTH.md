# Source of truth

`GITHUB_SOURCE_OF_TRUTH = YES`

The authoritative copy of MindFlow is
[`lipe85goes/cognitive-mind`](https://github.com/lipe85goes/cognitive-mind) on
GitHub. No machine holds a privileged copy, including the one the project was
started on.

## What that means in practice

- **Work that matters exists on GitHub.** A commit that lives only in a local
  clone is not finished work — it is work at risk. Push the branch you are on
  before you stop for the day.
- **Local clones are disposable.** Any of them can be deleted and remade. If
  deleting a clone would lose something, that something was in the wrong place.
- **Build from the clone, not from the machine.** `git clone` → `npm ci` →
  `npx next build` has to work on a machine that has never seen this project.
  That is verified, not assumed — see
  `docs/archive/mindflow-github-cloud-migration-01/`.
- **Secrets never enter the repository.** Not in code, not in evidence, not in a
  committed `.env`. The project currently needs **no environment variables at
  all** to install, lint, typecheck or build, so there is nothing to leak.
- **Regenerable artifacts are not authority.** `node_modules/`, `.next/`,
  `tsconfig.tsbuildinfo`, `next-env.d.ts` and `__pycache__/` are ignored and
  rebuilt. Evidence under `docs/archive/` *is* tracked, because it is the record
  of what was decided, not a build output.
- **Prove recovery before destroying anything.** Before a local copy is deleted,
  a fresh clone from GitHub must install, validate and build.


## Cloud / Codespaces workflow

`v06-portal-requires-lights` is the **canonical integration branch** for the
current MindFlow line. The GitHub default branch is still historical, so never
use the repository default as an implicit base.

From this checkpoint forward:

1. **Cloud-first development.** Normal implementation work happens in GitHub
   Codespaces / remote Codex environments. The old local checkout is frozen for
   reference only and must not become a second source of truth.
2. **One isolated branch per task.** Start every non-trivial change from the
   latest `v06-portal-requires-lights` and create a short-lived remote task
   branch. Do not develop directly on the canonical integration branch.
3. **Validate before integration.** Run the checks appropriate to the change on
   the task branch. For repository-wide or behavior-sensitive work this means
   lint, typecheck, production build and the relevant CORE/DEEP validators.
4. **Review before merge.** Push the task branch, inspect the diff, then merge it
   back into `v06-portal-requires-lights` only after the change is accepted.
   Do not use force-push to rewrite accepted history.
5. **Local is disposable.** Local clones may be used for emergency inspection,
   but they are not an implementation lane. If a local clone diverges from
   GitHub, GitHub wins.
6. **No hidden machine state.** A task is not complete if its correctness
   depends on local-only files, local caches, untracked assets, or machine-local
   configuration that a fresh Codespace cannot reproduce.

For a new task, the safe baseline is:

```bash
git fetch origin
git checkout v06-portal-requires-lights
git pull --ff-only
git switch -c <task-branch>
```

Then develop, validate, commit, push the task branch, review, and integrate.

## Reproducing the project

```bash
git clone https://github.com/lipe85goes/cognitive-mind.git
cd cognitive-mind
git checkout v06-portal-requires-lights
npm ci
npx next build
node tools/validation/validation-hygiene-tests.mjs
```

No environment file, no credential, no manual step in between.

`npm ci` installs exactly what `package-lock.json` (lockfileVersion 3) records.
Do not run `npm install` to set up a clone — it can move the lockfile.

## Requirements

**Core development** — everything above needs only Node and npm. The repository
declares Node `>=20.9.0`, matching the minimum supported by the current Next.js
runtime, and records `npm@11.12.1` as the package manager. The GitHub migration
was independently validated on Node 24.15.0 / npm 11.12.1.

**Asset pipeline** — the Blender and Python generators under `tools/blender/`
and `tools/assets/` need Blender and Python installed. The Node-based asset
scripts use `sharp`, which is now an explicit devDependency instead of relying
on Next.js to provide it transitively. These tools regenerate art and are not
part of the normal application build.

## Branches

The remote's default branch is `v03-route-board-2`, which is historical and not
where work happens. Current work is on `v06-portal-requires-lights`. Changing the
default branch is a decision for the owner, not a side effect of a migration.
