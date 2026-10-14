# GAME03 V1 LOCK

`GAME03_V1_LOCK = PASS`

Date: 2026-10-14

## Lock anchor

The accepted Game 03 V1 runtime/product tree is:

`66944bc090f696e9fde3e0b012453db54d8fbc63`

That commit is the final `GAME03-FINAL-POLISH-LOCK-06` candidate after the full
Game 03 validation battery. The canonical integration branch
`v06-portal-requires-lights` was fast-forwarded to that accepted tree after
independent review and the final owner smoke test.

This document is a documentation-only follow-up to record the lock decision.
It does not alter Game 03 runtime behavior.

## What V1 includes

Game 03 (`hidden-objects`) is locked with:

- two rooms: Estúdio das Descobertas and Observatório do Explorador;
- one generic room engine;
- seeded target selection and seeded clue variants;
- Difficulty V3;
- environmental interactions with authored states;
- authored seeded room rearrangement for targets, look-alikes and ambient props;
- deterministic restart behavior;
- mobile, keyboard and reduced-motion support;
- accessibility semantics for interactive pieces;
- result/history compatibility with older saved results;
- measured fairness, replayability and browser-probe coverage.

The detailed evidence remains in:

- `docs/GAME03_SKELETON_01.md`
- `docs/GAME03_EXPERIENCE_02.md`
- `docs/GAME03_MULTISCENE_03.md`
- `docs/GAME03_CALIBRATION_02A.md`
- `docs/GAME03_INTERACTIONS_04.md`
- `docs/GAME03_REPLAYABILITY_05.md`
- `docs/GAME03_V1_LOCK_CANDIDATE_06.md`
- `docs/archive/game03-final-polish-lock-06/`

## Acceptance evidence

The accepted candidate reported and archived:

- 381/381 browser checks across the final-lock, replayability, interactions,
  calibration, multiscene and Studio probes;
- all supported scenarios passing independently;
- all seven Game 03 validation generations holding their counterfactuals;
- 135/135 mutants caught;
- placement, round, interaction and replayability fairness gates passing;
- Platform Lock, readiness, watchdog, continuation and diagnostic-boundary
  regressions passing;
- Rota and Circuito regressions passing;
- CORE 15/15 and DEEP 1080/1080 + 270/270 + recovery passing;
- no new runtime dependency;
- Home product files unchanged by the Game 03 closing pass.

The final owner phone smoke test after the station-row and Observatory mouse
placement fixes found no apparent issue, so no known gameplay blocker remained
at lock time.

## Known limitations accepted in V1

These are not V1 blockers:

- some large scene anchors are intentionally fixed;
- some authored placements remain more common than others;
- anti-repeat memory is session-local and short;
- one minor decoy-glasses-case visual imperfection remains;
- portrait phones trade some scene height for readable station controls;
- the art remains script-generated;
- structured target-audience playtesting is future work;
- a third room is not part of V1.

## Change policy after lock

Game 03 V1 is now treated like the other locked gameplay surfaces.

Changes require an explicit reason such as:

1. verified regression or bug;
2. accessibility correction;
3. security/dependency maintenance;
4. measured performance improvement that preserves behavior;
5. data/copy correction that does not expand gameplay;
6. an explicitly approved Game 03 V2 / expansion mission.

Do not add opportunistic features to the locked V1 while working on Home or
Rota 2.0.

## Next product order

After this lock:

1. the separately planned Home change;
2. then Rota 2.0.

Those are separate workstreams and must not reopen Game 03 V1 without one of the
change-policy reasons above.
