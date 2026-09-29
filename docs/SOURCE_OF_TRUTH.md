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
does not declare an `engines` range; it is developed on Node 24 / npm 11, and
that is recorded here rather than enforced, because pinning it is a change to
the project's contract and not a migration task.

**Asset pipeline** — the Blender and Python generators under `tools/blender/`
and `tools/assets/` need Blender and Python installed. They regenerate art and
are not part of install, lint, typecheck, build or validation. A machine without
Blender can develop the whole application; it just cannot re-render a diorama.

## Branches

The remote's default branch is `v03-route-board-2`, which is historical and not
where work happens. Current work is on `v06-portal-requires-lights`. Changing the
default branch is a decision for the owner, not a side effect of a migration.
