# HOME-WORLD-VISUAL-UNIFICATION-01 — evidence

Base: `v06-portal-requires-lights` @ `720b404` (the mission's base). Branch:
`feat/home-world-visual-unification-01`. Home-only presentation mission: no
game rule, input, scoring, progression, storage, unlock, route generation,
hidden-objects or memory-circuit gameplay changed (`home-atelier-kit-tests.mjs`
K10 proves no file under `src/games`, `src/engine`, `src/data`, `src/types`,
`src/app` or `src/lib` moved since the base).

## What changed, in one picture

- `comparison-board.webp` — desktop 1440×900, every world selected, before | after.
- `comparison-phone.webp` — 390×844, every world selected, before | after.
- `kit/lineup.webp` — the five maquettes as a family (Rota, Circuito, Central,
  Estúdio — the reference, unchanged — Jardim).
- `kit/<world>.webp`, `kit/<world>-passes.webp` — each kit world composited on
  the Home's backdrop, and its seven passes.

## Folders

| Folder | What |
| --- | --- |
| `before/` | the base's Home: `desktop-<world>.webp` (1440×900), `phone-390-<world>.webp` (390×844) — captured on `next dev` (the round "N" badge is Next's dev indicator, not the product) |
| `after/` | the same after the mission, on the production build (`next start`), plus `laptop-*` (1366×768), `small-*` (1280×720), `tablet-*` (820×1180), `phone360-*` (360×740) |
| `focus/` | `keyboard-focus.webp` — a world reached with Tab: focus ring drawn, the world selected |
| `entry/` | `<world>-threshold.webp`, `<world>-intro.webp` — the entry from the Home: the kit worlds keep their maquette into the threshold and the intro; the Estúdio enters with its room picture (Game 03's own) |
| `kit/` | the kit's review sheets (written by `tools/assets/create_home_atelier_dioramas.mjs`) |
| `probe/` | `home-world-browser-probe.json` — the Home probe's run on the production build |
| `perf/` | `home-payload-before.json`, `home-payload-after.json` — what the browser fetched to show the Home, cold cache |

## The system

The Estúdio das Descobertas' Home maquette is the quality reference. The other
four worlds are now built with the same technology — SVG passes painted and
encoded with `sharp` — on a shared contract
(`tools/assets/home-atelier-kit.mjs`): one 1040×780 canvas, the Estúdio's
pedestal (same ellipse, height, rim and ring structure; only the inlay changes),
one floor camera, one key light laid on the matter, one pass vocabulary
(contact-shadow, base, back, main, detail, energy, front), one encoding.
`worldDioramaLayout.ts` describes every world with that one vocabulary and a
kit prefix; the Home draws every world with `WorldDiorama` at one size.
Rota, Circuito, Central and Jardim enter through the same maquette (master
scene); the Home has no crop or ground of its own any more.

## Validation (on the final tree)

| Check | Result |
| --- | --- |
| `npx eslint` (repo) | 0 errors (warnings: the pre-existing four in `hidden-objects-skeleton-tests.mjs`) |
| `npx tsc --noEmit` | clean |
| `npx next build` | ok (`/`, `/lab/3d-home`, `/lab/route-launcher`, manifest) |
| `home-atelier-kit-tests.mjs --deep --counterfactuals` | 10/10 + CF: K01, K04, K07, K08 all fail on the base |
| `home-world-browser-probe.mjs` (production build) | 28/28 |
| `gameplay-platform-lock-v1.mjs` | PASS (A3: Home graph still without game code) |
| Game 03 suites (skeleton, experience, multiscene, calibration, interactions, replayability, final-lock) | all green; counterfactuals hold |
| Gameplay regressions through the Home | see the mission report (continuation journey, hidden-objects probe, CORE) |

## Payload (production build, cold cache)

| | before (720b404) | after |
| --- | --- | --- |
| Home initial JS (bundle audit) | 10 files · 755.5 KB raw · 237.1 KB gzip | 10 files · 756.1 KB raw · 237.1 KB gzip |
| JS / CSS fetched | 9 · 202.9 KB / 7 · 46.4 KB | 9 · 203.0 KB / 7 · 46.2 KB |
| Images, desktop 1440×900 | 40 requests · 460.3 KB | 36 requests · 468.6 KB |
| Images, phone 390×844 (DPR 3) | 26 requests · 473.5 KB | 22 requests · 435.5 KB |
| All five maquettes on disk | 393 KB (5 kits) | 439 KB (4 kit worlds + shared shadow + the Estúdio) |

`world-glow.webp` (34 KB, the same teal glow for every world) left the Home: the
halo is CSS in each world's accent. The contact shadow is one file for the four
kit worlds; soft passes ship at half resolution.
