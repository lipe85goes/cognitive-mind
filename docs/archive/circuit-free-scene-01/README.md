# Circuit Free Scene 01 — o artefato solto no espaço

Material de aceitação da missão `CIRCUIT-FREE-SCENE-01`. Nada aqui é
carregado em runtime. Todas as capturas são do runtime real (dev server +
Chromium), não composições.

## Problema raiz

O Circuito parecia preso num painel por **três camadas somadas**:

1. `.mfg-visual-v2 .mfg-stage.mfg-master-stage` — borda dourada, raio,
   `background: #10211f`, sombra externa e `overflow: hidden`.
2. Legado em `globals.css` — `.mfg-illustrated-stage` (borda, raio, fundo
   `#070503`, anel interno, `::before` de vinheta) e `.mfg-stage` /
   `.mfg-master-stage` (raio, recorte, `::before` radial).
3. **A causa mais forte:** o ambiente era pintado duas vezes — wash da shell
   a 50% + a sala nítida *dentro* do painel. O degrau de brilho na borda era o
   retângulo; tirar só a borda trocaria uma moldura por outra.

E havia uma quarta, invisível até medir: `.mfg-frame` legado com
`justify-content: center` fazia a cena inteira caber numa **coluna centrada de
~1002px**. A borda dessa coluna era metade da leitura de "app".

## O que mudou

- Todo o chrome de cartão removido (inclusive o legado, neutralizado no
  arquivo isolado do Circuito — nada foi só escondido por opacidade).
- Ambiente virou **uma camada só, full-bleed**: a sala (`next/image`) foi
  promovida a `position: fixed` cobrindo a viewport, e o wash da shell virou
  gradiente puro — isso também elimina o download duplicado da mesma imagem.
- Cena passou a ocupar a largura toda (`justify-content: stretch`); quem se
  limita agora é o HUD, não o mundo.
- **Sombra de contato** real sob o disco + poça de luz quente: o artefato
  pousa no ambiente em vez de flutuar recortado.
- Composição: board um pouco menor e mais alto, com o convite "Ativar
  circuito" repousando **abaixo** da peça (antes ficava carimbado sobre o
  pad do sol).
- Bandeja de apoio virou **tray lateral direita no desktop** (o painel aberto
  cobria o pad inferior; agora cobre 5% do board e 0% dos pads) e continua
  gaveta inferior no mobile, onde o polegar alcança.

## Parallax passivo

`useCircuitSceneParallax` move **apenas o ambiente** (sala e sombreado), nunca
o board. Medido no runtime: com o ponteiro atravessando a tela, o board e os
hitboxes deslocam **0,00 px** enquanto o ambiente responde. Desligado sob
`prefers-reduced-motion` (verificado) e em ponteiros grosseiros (toque).

## Capturas

- `free-desktop-idle.png` · `free-desktop-observe.png` ·
  `free-desktop-player-turn.png`
- `free-desktop-dock-closed.png` · `free-desktop-dock-open.png`
- `free-desktop-parallax.png` — ponteiro no canto, ambiente deslocado
- `free-mobile-idle.png` · `free-mobile-dock-open.png`

## Medições registradas

| Verificação | Resultado |
| --- | --- |
| Borda/raio/fundo/sombra do palco | `0px none` / `0px` / `rgba(0,0,0,0)` / `none` |
| `overflow` do palco | `visible` |
| Ambiente | `position: fixed`, cobrindo a viewport |
| Sombra de contato | presente (`display: block`) |
| Board/hitbox sob parallax | 0,00 px de deslocamento |
| Dock aberto (desktop) | 5% do board, 0 pads cobertos, dentro da viewport |
| Dock aberto (mobile 390) | 22% do board, 1 pad coberto (ver ressalva) |
| Overflow horizontal em 390px | 0 |
| Toque durante a rodada | registrado (fase avançou) |

**Ressalva honesta:** no mobile, uma gaveta inferior aberta inevitavelmente
cobre a parte de baixo do palco, incluindo o pad do sol. É o comportamento
esperado de uma gaveta que o Explorador abriu de propósito, e ela contém
botões nomeados equivalentes aos quatro pads. Fecha pelo próprio controle ou
por Escape.
