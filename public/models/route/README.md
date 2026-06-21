# Rota Estrategica Babylon asset contract

Production GLB files for the Babylon renderer should live in this folder.

Expected future files:

- `board.glb` - full physical board base, frame, trim, rivets and tabletop detail.
- `tile.glb` - reusable dark stone tile plate.
- `wall.glb` - raised wall/block obstacle.
- `player.glb` - teal/cyan friendly pawn.
- `guardian.glb` - amber hooded guardian figure.
- `portal.glb` - green portal/exit arch.
- `light.glb` - golden collectible light.
- `trap.glb` - red crystal/rune trap.
- `shield.glb` - blue shield/emblem collectible.
- `danger-ring.glb` - projected amber danger preview ring.

Current pilot status:

- The production game does not request these files yet, so missing assets do not
  create 404s or console noise.
- `src/games/escape-maze/routeBabylonScene.ts` uses procedural Babylon meshes as
  placeholders.
- Each placeholder is intentionally grouped by semantic renderer function
  (`renderBase`, `renderTiles`, `renderWalls`, `renderPlayer`, etc.) so it can be
  replaced by a corresponding GLB without changing `useEscapeMaze` or the React
  game flow.
