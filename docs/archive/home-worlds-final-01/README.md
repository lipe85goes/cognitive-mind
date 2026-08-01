# Home Worlds Final 01 — O Ateliê dos Mundos

Material de aceitação da missão `HOME-WORLDS-FINAL-01`. Nada aqui é carregado
em runtime. As capturas principais são do runtime real (dev server +
Chromium), não composições de asset.

## O que a missão fechou

1. **Bug de seleção por hover — corrigido na raiz.** `onPointerEnter` saía de
   `WorldObject`: como a composição se desloca ao selecionar, o ponteiro
   parado caía sobre o vizinho e trocava o mundo sozinho. Medido antes:
   selecionar Rota e depois só *pousar* o ponteiro sobre o Circuito acabava
   selecionando **Central de Comandos** (dois mundos adiante). Depois:
   `STABLE`. Hover agora só eleva e acende a peça; quem escolhe é clique,
   toque, teclado ou os controles da galeria.
2. **Mundos secundários deixaram de ser sprites chapados.** Central de
   Comandos, Trilha Lógica e Jardim de Sementes viraram maquetes 2.5D reais,
   com 7 passes independentes cada (sombra de contato, base, fundo, peça
   principal, detalhes, energia, frente), na **mesma câmera ortográfica, mesmo
   canvas 1040×780 e mesma luz** dos mundos-herói.
3. **Emblemas próprios** para os cinco mundos (`WorldEmblem`), SVG inline: anel
   de bronze + a gramática de cada mundo. Reconhecíveis pela forma, não só pela
   cor. Zero asset, texto sempre em React.
4. **Placas do mundo** com emblema, nome, frase e CTA único — pedra escura,
   borda de bronze, sem cara de etiqueta de app. As placas dos mundos mais
   distantes somem: etiqueta cortada na borda lê como card recortado.
5. **Composição do Ateliê**: peça em foco grande (todos os mundos ganham
   presença de herói quando focados), vizinhos recuando por escala, brilho e
   saturação sobre a mesma mesa, sugerindo que a bancada continua.
6. **Microcopy** revisada: "Que bom te ver." / "Escolha um mundo para
   explorar." e uma frase de intenção por mundo.
7. **Lazy-load dos mundos distantes.** Só a maquete em foco carrega adiantado.
   Antes, 21 camadas novas subiam de uma vez e chegaram a estourar o watchdog
   de prontidão na entrada da Rota em dev frio.

## Pesos

| Mundo | Runtime |
| --- | --- |
| Central de Comandos | 64 KB (7 camadas) |
| Trilha Lógica | 76 KB (7 camadas) |
| Jardim de Sementes | 76 KB (7 camadas) |
| **Total dos dioramas da Home** | **608 KB** |
| **Payload de imagens da Home (medido no runtime)** | **~236 KB** |

Muito abaixo do orçamento (2 MB inicial; 300 KB por mundo secundário).

## Pipeline

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_secondary_world_dioramas.py
node tools/assets/create_secondary_world_layers.mjs
```

O script Blender escreve passes PNG transparentes em `raw/<mundo>/`; o script
node os encoda para `public/illustrations/home/dioramas/<mundo>/` e gera as
pranchas de camadas.

## Arquivos

Runtime real:

- `home-desktop-route-focus.png` · `home-desktop-circuit-focus.png` ·
  `home-desktop-secondary-focus.png`
- `home-tablet-route-focus.png` · `home-tablet-circuit-focus.png`
- `home-mobile-route-focus.png` · `home-mobile-circuit-focus.png`
- `desktop-{route,circuit,panel,trail,garden}.png` — cada mundo em foco
- `before/` — estado anterior, para comparação honesta

Pranchas:

- `all-worlds-lineup.png` — os cinco mundos, capturas reais
- `world-emblems-review.png` · `world-plates-review.png`
- `focus-vs-neighbors-review.png`
- `home-to-route-continuity.png` · `home-to-circuit-continuity.png`
- `secondary-worlds-lineup.png` · `world-{panel,trail,garden}-layers.png`
- `asset-weights.json`

## Pendências honestas

- **Mobile 390** funciona (um mundo em foco, placa com CTA, sem overflow), mas
  ainda sobra faixa vazia embaixo; a composição pode ser mais compacta.
- **Tablet** herda a composição desktop com o mundo em foco a 480 px; merece
  um passe próprio se a revisão achar tímido.
- Os três mundos secundários são maquetes honestas de primitivas — legíveis e
  da mesma família, mas com menos densidade de detalhe que Rota e Circuito.
  Isso é intencional nesta fase (os jogos internos ainda serão refeitos).
- Em **dev frio**, a primeira entrada na Rota pode demorar o bastante para o
  watchdog de prontidão mostrar o painel de "mais um instante". O lazy-load
  reduziu muito; em produção o compile não existe.
- `public/illustrations/home/world-{panel,trail,garden}.webp` (sprites antigos)
  continuam no disco, agora sem uso no caminho ativo. A remoção fica para a
  missão de limpeza, com busca de referências.
