# Circuit Presentation Final 01 review

Material de aceitação visual da missão `CIRCUIT-PRESENTATION-FINAL-01`.
Nada desta pasta é carregado em runtime.

Todas as capturas `presentation-*.png` e `route-reference-desktop.png` são
**runtime real** (dev server + Chromium via Playwright), não composições.

## O que a missão fechou

- **Assinatura visual própria**: `MemoryCircuitWorldMark` (SVG inline leve) —
  anel de bronze, quatro gemas de sinal nas posições congeladas e o
  cristal-core teal. Sem asset em `public/`, texto sempre em React.
- **Lockup de título**: emblema + "Circuito de Memória" (serif) + assinatura
  "Memória em quatro sinais", como placa física de pedra/bronze.
- **HUD como placas do mundo**: lockup · placa de estado (com ícone calmo por
  variante: repouso/observar/acerto/outra tentativa) · marcador de etapa com as
  quatro gemas. Sem labels uppercase de dashboard, sem métricas repetidas.
- **Dock "Apoio do Explorador"**: alça compacta central (não mais uma barra),
  Escape fecha com foco de volta na alça; `aria-expanded`/`hidden`/44 px
  preservados; cores nomeadas (não dependem só de cor).
- **CTA no pé do palco**: o convite "Ativar circuito" repousa na base do
  palco — o core e os pads ficam livres (antes flutuava sobre o board).
- **Microcopy**: "Observe os sinais do circuito e repita no seu ritmo",
  "Outras formas de jogar", "Ao seu ritmo", footnote curta — tom do
  Experience Book, sem termos técnicos.
- **Mobile 390**: hierarquia própria (lockup compacto + etapa · estado em
  tablet único · board grande · CTA full-width · alça inferior), sem overflow,
  alvos mínimos de 44 px.

## CIRCUIT-PRESENTATION-FINAL-01-FIX — continuidade real

O gate "Home e jogo mostram o mesmo artefato" tinha falhado no runtime gravado:
Home e introdução mostravam o Circuito V1 claro/cinza enquanto o jogo mostrava
o V2. Causa: a cena mestre lia uma **cópia derivada** em
`public/illustrations/worlds/master-scenes/circuit/` cujas URLs existiam desde
a era V1 — o arquivo no disco já era V2, mas o otimizador de imagens do Next
continuou servindo a variante V1 gravada em `.next/cache/images`.

Correção: `CIRCUIT_MASTER_ASSETS` passou a apontar direto para
`public/assets/memory-circuit/v2/` (fonte única, sem cópia), a pasta derivada
foi removida, o passo de derivação saiu do script de review, e o cache do
otimizador foi limpo. Também caíram dois defeitos perceptuais: o `sizes`
pequeno fazia o Next servir um board de 320px (detalhe destruído) e os quatro
overlays de pad ficavam permanentemente acesos, velando a pedra.

Capturas da correção (cache HTTP desabilitado, fluxo contínuo):

- `runtime-home-circuit.png` · `runtime-transition-circuit.png` ·
  `runtime-intro-circuit.png` · `runtime-game-circuit.png`
- `runtime-game-observe.png` · `runtime-game-player-turn.png` ·
  `runtime-game-correct.png` · `runtime-game-wrong.png`
- `runtime-game-dock-open.png` · `runtime-game-dock-closed.png`
- `runtime-mobile-home.png` · `runtime-mobile-intro.png` ·
  `runtime-mobile-game.png`
- `runtime-prod-home.png` — build de produção (`next start`), fora do dev.
- `diag-home-circuit.png` / `diag-intro-circuit.png` — **antes** da correção,
  mostrando o artefato V1 que estava sendo servido.

Variantes servidas depois da correção (todas de `/assets/memory-circuit/v2/`):
Home 768px · transição 895px · introdução 832px · jogo 704px · mobile 358px.

## Arquivos

- `presentation-desktop-idle.png` — repouso, desktop 1440.
- `presentation-desktop-observe.png` — sinal aceso durante a observação.
- `presentation-desktop-player-turn.png` — vez do jogador.
- `presentation-desktop-dock-open.png` — bandeja de apoio aberta.
- `presentation-mobile-idle.png` — 390×844 (DPR 2).
- `route-reference-desktop.png` — Rota Estratégica real, só referência.
- `title-lockup-review.png` — lockup desktop/mobile + placa de estado.
- `icon-system-review.png` — família de ícones e controles.
- `hud-hierarchy-review.png` — ordem de leitura anotada (board primeiro).
- `route-vs-circuit-presentation.png` — coerência entre os dois mundos
  (qualidade, não igualdade).

## Validações funcionais registradas na captura

- Dock: 4 botões de cor alternativos, fecha por Escape, foco devolvido à alça,
  `aria-expanded` sincronizado.
- Mobile: overflow horizontal 0, menor alvo de toque 44 px.
- Entrada com `prefers-reduced-motion: reduce` chega ao repouso normalmente.

## Regeneração

As capturas exigem o dev server ativo e Chromium do Playwright. O fluxo usado:
Home → focar Circuito → entrar → "Preparar circuito" → "Ativar circuito" →
estados → dock. A aprovação final continua sendo revisão humana em vídeo.
