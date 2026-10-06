# Trilha Lógica (`number-trail`) — aposentada

GAME03-SKELETON-01 aposentou a Trilha Lógica como jogo ativo: o Estúdio das
Descobertas (`hidden-objects`) ocupa o slot dela na Home (mundo quieto,
`navOrder` 4). Decisão humana registrada em
`docs/GAME03_DISCOVERY_01.md` (`GAME03_REPLACEMENT_DECISION = APPROVED`).

Esta pasta guarda a arte de runtime que a Home usava para a Trilha, exatamente
como era servida em `public/`:

| Arquivo | Antes em |
| --- | --- |
| `home/dioramas-trail/trail-*.webp` (7 passes) | `public/illustrations/home/dioramas/trail/` |
| `home/world-trail.webp` (transição e intro) | `public/illustrations/home/world-trail.webp` |

Nada aqui é runtime: não importe nem sirva estes arquivos.

- **Código do jogo:** removido do produto (`src/games/number-trail/NumberTrailGame.tsx`,
  e `NUMBER_TRAIL_MAX_ERRORS` / `calculateNumberTrailScore` de
  `src/engine/scoring.ts`). Continua no histórico do Git (último commit com o
  jogo ativo: `f9254429feac68fb03329c28dec0d6e97686de14`).
- **Masters:** os renders brutos dos passes continuam em
  `docs/archive/home-worlds-final-01/raw/trail/` (feitos por
  `tools/blender/create_secondary_world_dioramas.py`, convertidos para WebP por
  `tools/assets/create_secondary_world_layers.mjs`); o master SVG de
  `world-trail.webp` continua em `tools/assets/create_home_world_set.mjs`.
  Esses geradores são ferramentas fechadas da missão HOME-WORLDS-FINAL-01 e não
  foram editados: rodá-los de novo recria os arquivos acima em `public/`, onde
  nada os lê.
- **Histórico salvo:** resultados antigos com `gameId: "number-trail"` ficam
  intactos no `localStorage` do aparelho (nada é apagado, migrado nem
  convertido em resultado do Estúdio). Ver "Histórico da Trilha" em
  `docs/ARCHITECTURE.md` e `docs/GAME03_SKELETON_01.md` §6.
