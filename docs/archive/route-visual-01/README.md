# Route Visual 01 - Rota como territorio livre

Material de aceitacao da `ROTA-VISUAL-01` (passes 1, 2 e 3). Nada nesta pasta
e carregado em runtime. As capturas registram sessoes reais da Rota, sem flags
de produto nem estados simulados.

## Passe 1 - palco livre e objetos legiveis

O painel retangular que enquadrava o canvas foi removido por CSS isolado em
`src/games/escape-maze/route-visual.css`. O ambiente passou a ocupar o palco,
sem borda, preenchimento ou sombra de card ao redor do tabuleiro.

A elipse pintada sob o tabuleiro (`route-shadow-pool`) tambem foi removida. O
portal foi reconstruido como um arco vertical teal, com profundidade no vao e
limiar luminoso. O mesmo `portal.glb` atende jogo e ilha da Home. O escudo foi
reposicionado em pe para manter o brasao legivel na camera 3/4.

## Passe 2 - territorio, camera e readiness

O tabuleiro recebeu um territorio irregular de pedra fora da grade jogavel:
base rochosa, afloramentos e degraus nao clicaveis, todos com sombras reais.
Nenhuma coordenada, colisao, mapa ou hitbox foi alterada.

O enquadramento da camera passou a considerar a proporcao real do canvas. Isso
evita corte inferior em canvases largos e baixos e preserva a escala em telas
altas. O redimensionamento tambem reexecuta o enquadramento.

O teste de readiness revelou que o instrumento anterior clicava no CTA antes
da cobertura da transicao desmontar. Com o fluxo correto, a Rota carregou nos
tres viewports. Em Chromium sem GPU, o pior caso passou de 12 segundos; por
isso somente a Rota recebeu watchdog de 28 segundos. Os demais mundos
continuam com 12 segundos.

## Passe 3 - fechamento do HUD e assinatura

O HUD permanente foi reduzido aos tres dados essenciais durante a jogada:
`Luzes`, `Portal` e `Escudo`. Rota, modo, tentativas, caminhos fechados,
obstaculos, registro, instrucoes, legenda e reinicio foram agrupados em
`Detalhes da rota`, fechado por padrao.

O painel de detalhes ocupa a mesma coluna dos controles: nunca cobre nem move o
tabuleiro. Ele fecha pelo botao ou por `Escape`, devolvendo o foco ao acionador.
Em telas pequenas, o proprio painel tem rolagem interna quando necessario.

A Rota ganhou uma assinatura propria na placa principal: um emblema de caminho,
luzes e portal, acompanhado pela frase `Observe o caminho. Escolha o proximo
passo.` A mensagem de estado foi incorporada ao objetivo atual, evitando uma
segunda placa concorrente.

## Estados reais do portal

Os tres estados foram alcançados jogando a Rota 1 pelo fluxo normal:

- `route-portal-locked.png`: portal fechado com 0/2 luzes;
- `route-portal-ready.png`: portal disponivel apos coletar 2/2 luzes;
- `route-portal-complete.png`: conclusao real ao entrar no portal, com modal de
  resultado e registro da sessao.

As imagens sao distintas e nao usam instrumentacao persistente. A instrumentacao
temporaria usada apenas para localizar celulas no teste foi removida; tanto
`RouteBabylonBoard.tsx` quanto `useEscapeMaze.ts` permanecem sem diff.

## Validacao responsiva do Passe 3

| viewport | documento | tabuleiro | painel/controles | sobreposicao |
| --- | --- | --- | --- | --- |
| desktop 1440x900 | 1440x900 | completo, ate y=876 | coluna lateral | 0 |
| tablet 820x1180 | 820x1180 | 796x597 | abaixo do board | 0 |
| mobile 390x844 | 390x844 | 372x279 | abaixo do board | 0 |
| mobile + detalhes | 390x844 | todos os itens visiveis | rolagem interna | 0 |

No mobile, a camada de introducao ja escondida continuava participando do grid
e ampliava o documento para mais de 1000 px. Uma regra local da Rota remove essa
camada do fluxo somente depois de ela receber `aria-hidden=true`. A transicao e
os demais mundos nao foram alterados.

## Evidencias principais

- `route-before-after.png`
- `route-hud-before-after.png`
- `route-hud-hierarchy.png`
- `route-free-scene-desktop.png`
- `route-idle-desktop.png`
- `route-moving-desktop.png`
- `route-board-material-review.png`
- `route-explorer-orientation.png`
- `route-guardian-orientation.png`
- `route-items-review.png`
- `route-light-collected.png`
- `route-portal-locked.png`
- `route-portal-ready.png`
- `route-portal-complete.png`
- `route-territory-review.png`
- `route-tablet.png`
- `route-mobile.png`
- `route-mobile-details-open.png`
- `home-route-island-final.png`
- `home-to-route-continuity.png`

## Pendencias honestas

1. O carregamento inicial da Rota ainda deve ser medido em tablet e celular
   fisicos; os numeros atuais incluem Chromium por software, um caso severo.
2. Os personagens e props continuam limitados pelos GLBs atuais. O passe melhora
   palco, leitura e orientacao, mas nao substitui um futuro art pass de modelos.
3. `route-pass3-before.png` e `route-route-complete.png` permanecem como material
   auxiliar de comparacao; nao sao assets de runtime.

## ROTA-BOARD-FOCUS-01 — o tabuleiro de volta ao protagonismo

O territorio do passe 2 tinha ido longe demais: uma prateleira de pedra
circundava o tabuleiro, dez afloramentos ficavam na borda (alguns encostando no
proprio quadro) e dois degraus entravam pela frente. O olho era puxado para
fora, e o board — que e o jogo — virava mais um elemento da cena.

Removido da cena:

- `route-territory-shelf` (prateleira circular sob a borda do board);
- os dez `route-outcrop-*` da borda;
- os dois `route-territory-step-*`;
- o helper `addTerritoryRock`, `territoryRoot` e os materiais so deles.

Mantido como apoio discreto: uma unica massa baixa e escura (`route-ground`,
9 lados, y = -1,02), bem abaixo do board. Ela ancora a cena e recebe sombra,
sem aparecer ao lado do tabuleiro. Nao e elipse pintada nem plinto.

O board cresceu por dois caminhos somados:

- camera: com a borda limpa, o enquadramento so precisa conter o tabuleiro e
  sua moldura, entao a meia-extensao caiu de 4,75 para 4,3 (4,0 no estreito) e
  a margem de seguranca de 2% saiu. O piso fixo de raio foi substituido por
  `MIN_CAMERA_RADIUS`, deixando o ajuste por proporcao mandar;
- layout: `.rsg-board-panel` passou de `133.333svh - 22rem` para
  `- 17rem`, e a coluna de controles cedeu 1,5rem.

Medido em producao (`next build` + `next start`), zero erro de console e zero
404 nos tres viewports:

| viewport | canvas antes | canvas depois | overflowX |
| --- | --- | --- | --- |
| desktop 1440x900 | 952x714 | 928x696 (board maior no frame) | 0 |
| tablet 820x1180 | 771x578 | 796x597 | 0 |
| mobile 390x844 | 369x277 | 372x279 | 0 |

Evidencia: `route-board-focus-before-after.png`, `board-focus-desktop.png`,
`board-focus-tablet.png`, `board-focus-mobile.png`.

Preservado: portal teal, ambiente full-bleed, ausencia de vitrine e de elipse
pintada, HUD e assinatura do passe 3, readiness e watchdog da Rota.
