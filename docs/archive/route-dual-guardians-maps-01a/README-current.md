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
