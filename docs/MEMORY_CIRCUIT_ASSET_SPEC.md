# Memory Circuit Asset Spec (RESET-CIRCUIT-MAX)

A lógica ativa do jogo permanece em `src/games/color-sequence/useColorSequenceGame.ts`. Não altere geração de sequência, timing, limite de tentativas, scoring, progressão, reward ou localStorage ao integrar assets.

## Decisão visual oficial

O caminho de **pads físicos separados foi abandonado** (as peças coladas nunca encaixaram em perspectiva/iluminação). O caminho ativo é:

1. **Board mestre único 2.5D** com os 4 pads, trilhas e núcleo integrados na mesma cena;
2. **Overlays transparentes de estado**, todos com o MESMO enquadramento/resolução do board (alinhamento pixel-perfeito por construção);
3. **Hitboxes reais** (botões acessíveis) posicionados por % sobre os pads;
4. Background e HUD separados (nunca cozidos na arte).

## Pipeline de geração

Todos os PNGs abaixo são gerados por **`tools/blender/create_memory_circuit_board.py`** (Blender headless, mesma câmera ortográfica 2.5D, film transparente, 1500×1200):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_memory_circuit_board.py
```

O script imprime as coordenadas projetadas dos hitboxes (% da imagem) — cole-as em `memoryCircuitLayout.ts`.

## Assets ativos

| Asset | Função |
| --- | --- |
| `public/illustrations/memory-circuit/memory-room-bg.webp` | Fundo atmosférico (preservado). |
| `public/assets/memory-circuit/memory-board-master.png` | Board mestre 2.5D completo (plataforma + 4 pads + trilhas + núcleo). |
| `public/assets/memory-circuit/overlay-flame-active.png` | Estado aceso do pad chama (topo) + trilha até o núcleo. |
| `public/assets/memory-circuit/overlay-wave-active.png` | Estado aceso do pad onda (direita) + trilha. |
| `public/assets/memory-circuit/overlay-leaf-active.png` | Estado aceso do pad folha (esquerda) + trilha. |
| `public/assets/memory-circuit/overlay-sun-active.png` | Estado aceso do pad sol (baixo) + trilha. |
| `public/assets/memory-circuit/overlay-core-pulse.png` | Pulso do núcleo (cristal + halo contido). |

Mapeamento congelado: **flame = topo, wave = direita, leaf = esquerda, sun = baixo.**

## Arquivo visual fora de `public/`

Os assets abaixo são referência histórica/revisão e não comandam mais a tela ativa. Eles foram removidos de `public/` na CLEAN-05 para não serem servidos pelo app:

- `docs/archive/memory-circuit/memory-kit-review.png`
- `docs/archive/memory-circuit/memory-circuit-board-v1.png`
- `docs/archive/memory-circuit/legacy-separated-assets/memory-board-floating.png`
- `docs/archive/memory-circuit/legacy-separated-assets/core-crystal.png`
- `docs/archive/memory-circuit/legacy-separated-assets/pad-flame.png`
- `docs/archive/memory-circuit/legacy-separated-assets/pad-wave.png`
- `docs/archive/memory-circuit/legacy-separated-assets/pad-leaf.png`
- `docs/archive/memory-circuit/legacy-separated-assets/pad-sun.png`

Não use esses arquivos em código novo.

## Regras de integração

1. Não alterar `useColorSequenceGame.ts` por motivo visual.
2. Estado do jogo é a única fonte da verdade: `phase`, `activeColor`, `lastTapped`, `tapFeedback`, `canTap` dirigem overlays e hitboxes (ver `memoryCircuitVisualState.ts`).
3. Hitboxes reais e acessíveis sempre (`MemoryCircuitPadLayer` = só botões; foco visível; `aria-label` com cor + símbolo).
4. Posições de hitbox vivem em `memoryCircuitLayout.ts` (x/y/size em %), nunca hardcoded em componentes.
5. Estados visuais do pad: repouso (board mestre), aceso (`overlay is-on`), toque correto (mesmo overlay, eco curto), engano (`is-wrong` = tinta âmbar suave via CSS, sem vermelho duro).
6. Texto, HUD, pontuação e progresso ficam em React — nunca dentro de imagem.
7. Tudo deve continuar calmo e legível: "Pensar em paz".

