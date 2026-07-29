# Memory Circuit Asset Spec (RESET-CIRCUIT-MAX)

A lógica ativa do jogo permanece em `src/games/color-sequence/useColorSequenceGame.ts`. Não altere geração de sequência, timing, limite de tentativas, scoring, progressão, reward ou localStorage ao integrar assets.

## Decisão visual oficial

O caminho de **pads físicos separados foi abandonado** (as peças coladas nunca encaixaram em perspectiva/iluminação). O caminho ativo é:

1. **Board mestre único 2.5D** com os 4 pads, trilhas e núcleo integrados na mesma cena;
2. **Overlays transparentes de estado**, todos com o MESMO enquadramento/resolução do board (alinhamento pixel-perfeito por construção);
3. **Hitboxes reais** (botões acessíveis) posicionados por % sobre os pads;
4. Background e HUD separados (nunca cozidos na arte).

## Pipeline de geração

O kit ativo V2 é gerado por
**`tools/blender/create_memory_circuit_visual_v2.py`** (Blender headless,
mesma câmera ortográfica 2.5D, film transparente, WebP RGBA 1280×1024):

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_memory_circuit_visual_v2.py
```

O script imprime as coordenadas projetadas dos hitboxes (% da imagem) — cole-as em `memoryCircuitLayout.ts`.

## Assets ativos

| Asset | Função |
| --- | --- |
| `public/illustrations/memory-circuit/memory-room-bg.webp` | Fundo atmosférico (preservado). |
| `public/assets/memory-circuit/v2/memory-board.webp` | Artefato circular completo em pedra azul-esverdeada, bronze envelhecido, quatro pads e núcleo. |
| `public/assets/memory-circuit/v2/overlay-flame.webp` | Energia da chama + trilha até o núcleo, sem substituir o esmalte. |
| `public/assets/memory-circuit/v2/overlay-wave.webp` | Energia da onda + trilha, preservando o azul e o símbolo. |
| `public/assets/memory-circuit/v2/overlay-leaf.webp` | Energia da folha + trilha. |
| `public/assets/memory-circuit/v2/overlay-sun.webp` | Energia do sol + trilha. |
| `public/assets/memory-circuit/v2/overlay-core.webp` | Pulso contido do cristal central. |
| `public/assets/memory-circuit/v2/overlay-complete.webp` | Estado de circuito completo com as quatro rotas ativas. |

O kit V2 soma aproximadamente 444 KB e permanece abaixo do orçamento de
700 KB para o runtime do Circuito.

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

Os PNGs do primeiro board mestre foram arquivados em
`docs/archive/memory-circuit/legacy-kit-v1/` (CIRCUIT-MASTER-FINAL-01) — eles
não tinham mais nenhuma referência de código e pesavam ~4 MB em `public/`.
Não os reintegre sem uma missão explícita.

## Fonte visual única (Home, transição, introdução, jogo)

Home, transição, introdução, preparação e jogo ativo carregam **os mesmos
arquivos**: `public/assets/memory-circuit/v2/*`. Não existe cópia derivada.

`CIRCUIT_MASTER_ASSETS` (em
`src/components/worlds/master-scene/worldMasterSceneConfig.ts`) aponta
diretamente para esse kit. Só mudam escala, crop e energia por contexto —
nunca o objeto.

**Por que não derivar (CIRCUIT-PRESENTATION-FINAL-01-FIX):** existia uma cópia
em `public/illustrations/worlds/master-scenes/circuit/` com os mesmos nomes de
arquivo de antes. Quando o kit foi atualizado, o arquivo no disco virou V2, mas
o otimizador de imagens do Next continuou servindo a variante V1 já gravada em
`.next/cache/images` para aquelas URLs — Home e introdução mostraram o artefato
antigo enquanto o jogo mostrava o novo. Uma segunda cópia é o vetor do
problema; a regra agora é uma fonte só.

Se o kit V2 for re-renderizado e o navegador insistir na arte antiga em dev,
apague `.next/cache/images` e reinicie o servidor.

### Como validar de verdade

`fetch(url)` **não** prova nada: ele lê o arquivo estático e ignora o
otimizador. A verificação válida é ler `img.currentSrc` e `naturalWidth` do
`<img>` renderizado, com o cache do navegador desabilitado — foi assim que a
divergência apareceu.

## Regras de integração

1. Não alterar `useColorSequenceGame.ts` por motivo visual.
2. Estado do jogo é a única fonte da verdade: `phase`, `activeColor`, `lastTapped`, `tapFeedback`, `canTap` dirigem overlays e hitboxes (ver `memoryCircuitVisualState.ts`).
3. Hitboxes reais e acessíveis sempre (`MemoryCircuitPadLayer` = só botões; foco visível; `aria-label` com cor + símbolo).
4. Posições de hitbox vivem em `memoryCircuitLayout.ts` (x/y/size em %), nunca hardcoded em componentes.
5. Estados visuais do pad: repouso (board mestre), aceso (`overlay is-on`), toque correto (mesmo overlay, eco curto), engano (`is-wrong` = tinta âmbar suave via CSS, sem vermelho duro).
6. Texto, HUD, pontuação e progresso ficam em React — nunca dentro de imagem.
7. Tudo deve continuar calmo e legível: "Pensar em paz".

As pranchas de aceitação ficam em
`docs/archive/circuit-visual-01/` e são regeneradas por
`tools/assets/create_circuit_visual_review.mjs`.

