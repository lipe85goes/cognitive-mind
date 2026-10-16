# final-acceptance — where the live baseline lives

*Added by MINDFLOW-VALIDATION-HYGIENE-04.*

The JSON files in **this directory** are the ROTA-DUAL-GUARDIANS-MAPS-01A record
as written at that mission's close. They are history and are not rewritten.

The **`current/`** subdirectory holds the baseline `final-acceptance.mjs` checks
against today. `node tools/validation/final-acceptance.mjs` compares against
`current/`; the historical files are never touched.

## Why the two diverged

`final-acceptance` could not run at all until this mission — it threw
`generator shape changed: isValidMap return` before reaching its first phase. Once
repaired, it passed every phase against current `HEAD`:

| phase | verdict |
| ----- | ------- |
| FASE 1 structural | 1080/1080 certified, 0 throws, 0 audit failures |
| FASE 2 continuous | 270/270 certified, 0 throws |
| FASE 5 recovery | entered 9/9, certified by recovery 9/9, 0 audit problems |

But three of the five archived artifacts disagreed with it, in fields that are
per-map *fingerprints of the generator* rather than verdicts:

| artifact | diverging fields |
| -------- | ---------------- |
| `structural-1080-final.json` | `combinations[].templatesUsed`, `exitsUsed`, `attempts` percentiles |
| `continuous-270-final.json` | `streams[].entries[].attempts`, `randomAttempts` |
| `deterministic-recovery-final.json` | `cases[].seed`, `recoveryAttempts` |

These are deterministic outputs of the generator **as it was then**, and
generation has legitimately moved since that mission closed: ROTA-DIFFICULTY-04C
introduced the `route-random.ts` seam, and ROTA-DIFFICULTY-05 rebalanced the
difficulty profiles. Both change which template a given seed selects. The
contracts those numbers support all still hold — only the distributions moved.

`generation-performance-final.json` and `known-star-dependent-waste.json` matched
and are unchanged.

Rewriting the archived numbers would have replaced a closed mission's record with
today's, so it was not done. The gate now has a current baseline beside it, and
the drift is stated here rather than absorbed.

## ROTA2-DYNAMIC-TRAPS-01 (2026-10-16)

The approved Rota 2.0 mission added one certification gate to `isValidMap`
(`trapLinksLegal`: every map must link one trap to a legal closed wall). A map
with no legal link is rejected and the generator draws again, so a seed that
used to certify on its first candidate can now need another one. In this gate's
1080 seeds that happened once (Route 1 · easy), and in the continuous 270 the
extra draws shift every later map of that same stream (Route 1 · easy, no
reseed between maps). Two `current/` artifacts moved, in fingerprints only:

| artifact | diverging fields |
| -------- | ---------------- |
| `structural-1080-final.json` | Route 1 · easy `templatesUsed` (102/16 → 103/15), `attempts.max` (29 → 30) |
| `continuous-270-final.json` | stream 0 (Route 1 · easy) `entries[9…].attempts`, `randomAttempts` |

Every verdict still holds (1080/1080, 270/270, 0 throws, 0 audit failures,
recovery 9/9). The live tree with exactly the mission's pinned delta reversed
(`tools/validation/rota2-dynamic-traps-edit.json`) reproduces the previous
`current/` byte for byte, so the drift is the mission's and nothing else.
`current/` was refreshed with `--update`; the historical files are untouched.
