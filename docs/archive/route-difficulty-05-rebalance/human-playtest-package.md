# ROTA-DIFFICULTY-05 human playtest package

Open `/lab/route-launcher` and play the seven presets in the listed order. The
launcher runs the real game and keeps Route, Difficulty and Seed deterministic.
Automated policy outcomes are diagnostics only; this package is the required
human judgement of perceived difficulty and fairness.

| Order | Preset | Route | Difficulty | Seed | Recorded change | Observe while playing |
| ---: | --- | ---: | --- | ---: | --- | --- |
| 1 | BASE-1 | 2 | easy | 12420031 | Intentionally unchanged. Hash and all measured geometry equal BEFORE. | Confirm that the entry experience still leaves room to recover from a poor route choice. |
| 2 | BASE-2 | 3 | easy | 12430048 | Intentionally unchanged. The Chest detour remains 10 moves. | Confirm that Route 3 remains readable and that the Chest detour is optional rather than compulsory. |
| 3 | BASE-3 | 2 | medium | 12421027 | Intentionally unchanged. The best Pickaxe improvement remains 10 moves. | Confirm that Medium is clearly above Easy but does not feel like Hard. Evaluate whether the Pickaxe choice is understandable. |
| 4 | HARD-1 | 1 | hard | 12412046 | Walls 21 -> 23, objective route 22 -> 27, forced streak 2 -> 3. | Look for pressure from the start, meaningful route commitment and whether mistakes still feel attributable to player decisions. |
| 5 | HARD-2 | 2 | hard | 12422073 | Walls 23 -> 26, objective route 31 -> 33, forced streak 2 -> 3. | Evaluate choke points, Hunter reading, Sentinel territory and whether there is still a viable recovery line. |
| 6 | OUT-1 | 3 | hard | 12432116 | The old 10-step forced outlier was replaced: walls 25 -> 27, route 33 -> 32, forced streak 10 -> 2. | Confirm that the board is harder through strategic pressure, not through a long section that plays itself. |
| 7 | OUT-2 | 3 | hard | 12432045 | The old 43-move outlier was replaced: walls 26 -> 27, route 43 -> 34, decision ratio 0.5581 -> 0.7059. | Confirm that it is demanding without becoming a pure endurance outlier; note whether each defeat suggests a better decision for the retry. |

For every game, record only four short judgements:

1. `perceived difficulty`: low / medium / high / very high;
2. `fairness`: fair / unclear / arbitrary;
3. `decision pressure`: where a route, Hunter, Sentinel, Chest or reward choice mattered;
4. `retry insight`: what the player would do differently on the next attempt.

Acceptance requires a visible Easy < Medium < Hard progression, a materially
harder Hard on all three Routes, and no impossible, arbitrary or unreadable
state. Route termination is deliberately outside this package.
