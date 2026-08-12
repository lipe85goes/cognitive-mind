# Dynamic canonical state contract

The pre-chest solver state is exactly:

```
{ e, h, s, t, c, lights, traps }
```

| Field | Exact domain | Conservative bits |
|---|---:|---:|
| `e` Explorer position | 81 board cells | 7 |
| `h` Hunter position | 81 board cells | 7 |
| `s` Sentinel position | 81 board cells | 7 |
| `t` committed access | `-1..accessCount-1`; observed maximum 5 accesses | 3 |
| `c` commit turns remaining | `0..3` | 2 |
| `lights` collected-light mask | at most 6 lights | 6 |
| `traps` active-trap mask | at most 6 traps | 6 |

The conservative independent-field sum is at most **38 bits** in
the executed campaigns. The implementation uses an exact mixed-radix JavaScript `Number`
key, never 32-bit bitwise packing. The largest observed per-map contract required
**36 bits**, with maximum packed key 43535646719;
every key is below `Number.MAX_SAFE_INTEGER`.

`packState` validates every field. `unpackState(packState(state))` was checked on
36,009 controlled/generated states,
including every board position for each positional field, every commit counter, and every
light/trap mask: 0 mismatches, 0 false merges, 0 false splits.

Static map data stays outside state: walls, portal, accesses, light/trap locations, portal
zone, neighbour tables, distances, and trap-mask path tables. Portal readiness is derived
from `lights`. Score, errors, animations, meshes, and HUD state do not affect transitions.

PRE_CHEST_BASELINE excludes Pickaxe, breakable walls, and Second Chance.
