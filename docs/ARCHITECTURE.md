# MindFlow — Arquitetura Atual

Este documento descreve o estado real do projeto após as limpezas CLEAN-02, CLEAN-03, CLEAN-04 e CLEAN-05. Use como referência antes de mexer em Home, Jornada, Rota Estratégica, Circuito de Memória, assets ou jogos legados.

Regra de produto: leia `docs/MINDFLOW_EXPERIENCE_BOOK.md` antes de qualquer missão. A direção central é **Pensar em paz**. Para decisões visuais, use também `docs/MINDFLOW_VISUAL_SYSTEM.md`.

## Continuidade visual dos mundos

A Rota Estrategica e o Circuito de Memoria compartilham um contrato de cena
mestre entre Home, transicao, intro, setup e game shell. A implementacao fica
em `src/components/worlds/master-scene/` e o contrato completo esta em
`docs/MINDFLOW_WORLD_MASTER_SCENES.md`.

Esse sistema e exclusivamente visual. Ele nao altera hooks, regras, mapas,
sequencias, timing, scoring, persistencia ou registry.

## Fluxo principal

O app roda em uma única rota (`src/app/page.tsx`) e alterna entre três estados:

```text
home (HomeStage)
  -> game (GameScreen)
       -> GameHowToPlay
       -> GAME_REGISTRY[gameId].load() -> componente do jogo
            -> onComplete(result)
  -> result (RewardResultModal)
       -> praticar outra vez
       -> continuar jornada
```

- `src/app/page.tsx` controla a visão atual, a estação selecionada, o `gameSession`, o retorno para Home e a persistência via `saveGameResult`.
- Jogos não salvam direto em `localStorage`; eles chamam `onComplete` com `Omit<GameResult, "id" | "playedAt">`.
- `GameScreen` aplica a intro do jogo e remonta a sessão quando necessário.
- O código de cada jogo é carregado sob demanda: o registry não importa nenhum jogo estaticamente, e cada `load()` faz o `import()` do chunk daquele jogo quando o `GameScreen` monta. A Home não carrega código de jogo. A prontidão do jogo só conta a partir do mount do componente (o fallback de 2 frames começa depois dele), e falha no carregamento do chunk vai para `onEntryError` → painel de tentar novamente.
- `RewardResultModal` usa os dados do resultado salvo e a cópia de recompensa em `src/engine/rewards.ts`.

## Fontes de verdade

| Área | Arquivo |
| --- | --- |
| Tipos de jogo e resultado | `src/types/game.ts` |
| Contrato de entrada dos jogos (readiness + watchdog; só metadados) | `src/games/entry-contract.ts` |
| Registro de jogos (contrato de entrada + loader do componente) | `src/games/index.ts` |
| Metadados visuais dos mundos | `src/data/worlds.ts` |
| Lista de atividades e estações | `src/data/activities.ts` |
| Intros dos jogos | `src/data/game-intros.ts` |
| Progresso por estação | `src/engine/stage-progress.ts` |
| Pontuação e limites | `src/engine/scoring.ts` |
| Resultado/recompensa | `src/engine/rewards.ts` |
| Persistência local | `src/engine/storage.ts` |

Use `getWorldMeta(gameId)` para dados derivados de histórico salvo. Ele tem fallback seguro para resultados antigos ou ids desconhecidos.

## Jogos ativos

| GameId | Nome atual | Estado |
| --- | --- | --- |
| `escape-maze` | Rota Estratégica | Jogo principal em foco. Usa Babylon + GLBs. |
| `color-sequence` | Circuito de Memória | Jogo de memória em foco. Usa palco 2.5D com board mestre e overlays. |
| `security-panel` | Central de Comandos | Ativo, mas ainda é jogo legado a recriar futuramente. |
| `number-trail` | Trilha Lógica | Ativo, mas ainda é jogo legado a recriar futuramente. |
| `seed-garden` | Jardim de Sementes | Ativo, mas ainda é jogo legado a recriar futuramente. |

Os jogos legados continuam compilando e aparecem no registry. Não remova `GameLayout`, `GameActions`, `StatusBanner` ou `StatCard` enquanto esses três jogos dependerem deles.

## Home ativa

A Home de produção é a experiência 2.5D leve "O Ateliê dos Mundos" em:

- `src/components/home/HomeStage.tsx`
- `src/components/home/HomeGreeting.tsx`
- `src/components/home/WorldObject.tsx`
- `src/components/home/homeLayout.ts`
- `src/styles/home.css`
- `src/components/WorldEntryTransition.tsx`

Contrato da Home:

- `/` não usa Three, R3F, Canvas, `requestAnimationFrame` ou render loop contínuo.
- O CSS novo da Home fica isolado em `src/styles/home.css` e usa prefixo `.hj-*`.
- `Rota Estratégica` e `Circuito de Memória` são mundos-herói.
- `Central de Comandos`, `Trilha Numérica` e `Jardim de Sementes` continuam acessíveis como mundos secundários.

Assets ativos/permitidos da Home:

- `public/illustrations/home/*`
- `public/illustrations/ui/*.svg`

`public/illustrations/station-*.webp` foi removido em MINDFLOW-CLEANUP-03C: a
Home passou a mostrar maquetes em camadas e nenhum código lia mais esses
arquivos. Os masters ficam em `docs/archive/home-station-masters/`.

`public/illustrations/worlds/*-diorama.webp` continua no disco, mas não é asset
de runtime: `route-diorama.webp` e `memory-diorama.webp` são a FONTE de
`world-route-hero.webp` / `world-circuit-hero.webp` (via
`tools/assets/create_world_cohesion_assets.mjs`), e os outros três são masters
visuais sem consumidor em código.

A Home 3D antiga permanece no disco para referência e laboratório:

- `src/components/three/GameHome3D.tsx`
- `src/components/three/WorldSelectorScene.tsx`
- `src/components/three/WorldStage3D.tsx`
- `src/components/three/worlds/*World3D.tsx`

`/lab/3d-home` continua existindo como rota de laboratório, mas a Home de produção está em `/` com `HomeStage`.

## Rota Estratégica

Arquivos principais:

- `src/games/escape-maze/RouteStrategyGame.tsx`
- `src/games/escape-maze/useEscapeMaze.ts`
- `src/games/escape-maze/RouteBabylonBoard.tsx`
- `src/games/escape-maze/routeBabylonScene.ts`

Runtime visual ativo:

- `public/models/route/board.glb`
- `public/models/route/wall.glb`
- `public/models/route/player.glb`
- `public/models/route/guardian.glb`
- `public/models/route/portal.glb`
- `public/models/route/light.glb`
- `public/models/route/trap.glb`
- `public/models/route/textures/*.png`

Contrato dos assets e regeneração ficam em `public/models/route/README.md`. Previews PNG da Rota não ficam mais em `public/`; foram arquivados em `docs/archive/route-previews/`.

`useEscapeMaze.ts` é regra de jogo. Não altere geração, dificuldade, portal, guardião, scoring ou fluxo sem missão explícita.

## Circuito de Memória

Arquivos principais:

- `src/games/color-sequence/MemoryCircuit3DGame.tsx`
- `src/games/color-sequence/MemoryCircuitStage.tsx`
- `src/games/color-sequence/MemoryCircuitHud.tsx`
- `src/games/color-sequence/MemoryCircuitPadLayer.tsx`
- `src/games/color-sequence/MemoryCircuitAccessibleControls.tsx`
- `src/games/color-sequence/memoryCircuitLayout.ts`
- `src/games/color-sequence/memoryCircuitVisualState.ts`
- `src/games/color-sequence/useColorSequenceGame.ts`

Runtime visual ativo:

- `public/illustrations/memory-circuit/memory-room-bg.webp`
- `public/assets/memory-circuit/v2/memory-board.webp`
- `public/assets/memory-circuit/v2/overlay-flame.webp`
- `public/assets/memory-circuit/v2/overlay-wave.webp`
- `public/assets/memory-circuit/v2/overlay-leaf.webp`
- `public/assets/memory-circuit/v2/overlay-sun.webp`
- `public/assets/memory-circuit/v2/overlay-core.webp`
- `public/assets/memory-circuit/v2/overlay-complete.webp`
- `src/games/color-sequence/memory-circuit-visual.css`
- `src/games/color-sequence/MemoryCircuitWorldMark.tsx` (emblema SVG inline do mundo)

O contrato oficial do asset kit fica em `docs/MEMORY_CIRCUIT_ASSET_SPEC.md`. O caminho ativo é board mestre 2.5D + overlays transparentes + hitboxes reais. Assets antigos separados foram arquivados em `docs/archive/memory-circuit/`; o primeiro kit PNG (V1) está em `docs/archive/memory-circuit/legacy-kit-v1/`.

A cena mestre do Circuito (Home, transição, introdução, preparação) carrega os MESMOS arquivos de `public/assets/memory-circuit/v2/` que o jogo ativo — não há cópia derivada. Ver `docs/MEMORY_CIRCUIT_ASSET_SPEC.md` para a regra de fonte única e o motivo.

`useColorSequenceGame.ts` é regra de jogo. Não altere sequência, timing, tentativas, scoring, progressão, reward ou localStorage por motivo visual.

## Engine e libs compartilhadas

`src/engine/` contém lógica compartilhada e deve permanecer independente de UI:

- `scoring.ts` — fórmulas, limites e pontuação.
- `rewards.ts` — sinais de ativação, sucesso e cópia de recompensa.
- `storage.ts` — persistência em `localStorage`.
- `stage-progress.ts` — ordem e progresso das estações.
- `difficulty.ts` — suporte de dificuldade/IA da Rota.

`src/lib/` contém utilitários de UI/feedback:

- `game-sounds.ts`
- `feedback-motion.ts`
- `confetti.ts`
- `detail-labels.ts`

## Arquivos arquivados

`docs/archive/` guarda material histórico ou de revisão que não deve ser servido como runtime:

- `docs/archive/route-previews/` — previews PNG dos GLBs da Rota.
- `docs/archive/memory-circuit/` — protótipos visuais antigos do Circuito.
- `docs/archive/home-legacy/` — ilustração antiga da Home.

Não importe nada de `docs/archive/` no app. Se um asset voltar a ser runtime, mova para `public/` com uma missão explícita e atualize a documentação.

## Scripts Blender oficiais

Scripts ativos de geração visual:

- `tools/blender/create_memory_circuit_board.py`
- `tools/blender/create_memory_circuit_visual_v2.py`
- `tools/blender/create_route_board_glb.py`
- `tools/blender/create_route_wall_glb.py`
- `tools/blender/create_route_player_glb.py`
- `tools/blender/create_route_guardian_glb.py`
- `tools/blender/create_route_portal_glb.py`
- `tools/blender/create_route_light_glb.py`
- `tools/blender/create_route_trap_glb.py`
- `tools/blender/route_prop_asset_utils.py`
- `tools/assets/generate_route_board_textures.py`

Geradores com `--preview` podem recriar PNGs dentro de `public/`; esses previews não devem ser commitados como runtime sem nova decisão.

## Não apagar sem missão específica

Preserve obrigatoriamente:

- `docs/MINDFLOW_EXPERIENCE_BOOK.md`
- `src/games/escape-maze/useEscapeMaze.ts`
- `src/games/color-sequence/useColorSequenceGame.ts`
- `src/games/index.ts`
- `src/data/worlds.ts`
- `src/data/activities.ts`
- `src/data/game-intros.ts`
- `src/engine/scoring.ts`
- `src/engine/rewards.ts`
- `src/engine/storage.ts`
- GLBs e texturas ativos em `public/models/route/`
- kit ativo do Circuito em `public/assets/memory-circuit/`
- `public/illustrations/memory-circuit/memory-room-bg.webp`
- `GameLayout`, `GameActions`, `StatusBanner`, `StatCard`
- `RewardResultModal` e `WorldEntryTransition`

## Dívidas restantes

- `globals.css` ainda tem CSS legado misturado com CSS ativo. Use `docs/CSS_CLEANUP_MAP.md` antes de qualquer limpeza e remova apenas com busca de referência e validação visual.
- `security-panel`, `number-trail` e `seed-garden` continuam ativos, mas ainda devem ser recriados no padrão visual atual em missões futuras.
- Home/Jornada ainda pode receber refinamento visual, mas sem quebrar o fluxo de entrada dos mundos.
- Rota Estratégica ainda tem dívidas de evolução visual e possíveis expansões futuras como 9x9/armadilha ativa, fora do escopo atual.
- Circuito de Memória ainda precisa de art pass fino, mas a arquitetura atual deve continuar modular e baseada no board mestre.

## Validação padrão

```bash
npm run lint
npx.cmd tsc --noEmit
npm run build
```

Se o build local falhar por ambiente/bundler, use `npx next build --webpack` apenas como fallback de diagnóstico.
