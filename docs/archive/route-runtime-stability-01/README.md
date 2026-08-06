# Route Runtime Stability 01 - luzes, ciclo de vida e viewport

Material de aceitacao da `ROTA-RUNTIME-STABILITY-01`. Nada nesta pasta e
carregado em runtime. As medicoes vem de sessoes reais da Rota, em `next dev`
e em `next build` + `next start`, com Chromium sobre o mesmo backend grafico do
navegador da maquina (ANGLE / D3D11, GeForce GTX 1060) e tambem em SwiftShader.

## 1. O que a cena tinha

Contagem real, medida em producao com a Rota 1 em jogo (9x9, 4 luzes no mapa):

| categoria | luzes | contribuicao |
| --- | --- | --- |
| `route-key-light` (direcional, sombra) | 1 | sim |
| `route-fill-light` (hemisferica) | 1 | sim |
| `route-rim-light` (point) | 1 | sim |
| `route-brass-glint`, `route-table-lamp` | 2 | nenhuma - criadas ja com `setEnabled(false)` |
| `route-light-glow` (uma por luz nao coletada) | 3 a 5 | nenhuma |
| `route-player-light`, `route-guardian-light`, `route-portal-light`, `route-shield-light` | 4 | nenhuma |
| **total** | **12 a 13** (10 a 11 habilitadas) | **3 uteis** |

## 2. Por que as sete point lights nao apareciam

Todo material visivel da Rota e limitado a `maxSimultaneousLights = 3`, e o
Babylon liga as **primeiras** `cap` entradas de `mesh.lightSources`, que seguem a
ordem de criacao na cena. As tres estaticas sao criadas primeiro, entao as
demais nunca chegavam a uma superficie.

Medido, nao deduzido: desligar as sete point lights decorativas com a Rota em
jogo mudou **1 pixel em 646.816** (0,000%), delta maximo de canal 6 em um unico
pixel. `lights-11-on.png` e `lights-3-only.png` sao esse par.

Os estados que essas luzes pareciam servir ja eram feitos por material
emissivo mais a `GlowLayer`: `applyPortalActivationVisual` troca emissivo e alfa
do portal entre travado e liberado, e `tunePropMaterial` cuida do orbe, do
escudo, do cristal da armadilha e dos olhos do guardiao.

## 3. O acoplamento com o carregador glTF

`@babylonjs/loaders/glTF/2.0/glTFLoader.js` termina cada importacao com:

```js
// Making sure we enable enough lights to have all lights together
for (const material of this._babylonScene.materials) {
  mat.maxSimultaneousLights = Math.max(mat.maxSimultaneousLights, this._babylonScene.lights.length);
}
```

Nao e so nos materiais importados: e em **todos** os materiais da cena, a cada
um dos oito GLBs da Rota. Com 12 luzes, materiais que o projeto tinha fixado em
3 voltavam para 12, e `maxSimultaneousLights` e um `expandToProperty` - cada
atribuicao chama `_markAllSubMeshesAsLightsDirty()`. Resultado: shaders
compilados para 12 luzes, recompilados para 3, oito vezes.

Com 3 luzes na cena e o padrao 4 do Babylon, `Math.max(4, 3)` e `Math.max(3, 3)`
sao no-ops. A linha continua la e deixou de ter efeito. Essa e a correcao
estrutural: **manter `scene.lights.length` menor ou igual a 4 desarma o
carregador de forma permanente**, inclusive para GLBs futuros.

Duas defesas adicionais no mesmo arquivo:

- `capMaterialLights` so escreve quando o valor difere. Os tuners rodam dentro de
  `configureVisualClone`, que roda a cada `renderDynamicBoard()` - ou seja, a
  cada passo do Explorador. Escrever sem comparar sujava algumas centenas de
  submeshes por turno;
- `capSceneMaterialLights()` roda uma vez depois das cargas e alcanca o que os
  tuners nao veem: os materiais de sombra assada (pulados por
  `isBakedShadowNode`) e o `route-ground`, feito a mao.

## 4. Vazamento de materiais do portal

`applyPortalActivationVisual` clonava um material por mesh **por render**. O
portal e reconstruido a cada `renderDynamicBoard()`, e a raiz anterior sai com
`dispose(false, false)` - materiais sobrevivem de proposito, porque os
prototipos os compartilham. Os clones nao pertenciam a prototipo nenhum, entao
nada os liberava.

Medido antes: 173 materiais ao entrar, 186 ao iniciar a rota, **303 depois de
dez passos**, subindo. Agora os dois estados sao construidos uma vez e
reutilizados, com descarte no `dispose()` da cena.

## 5. Numeros antes e depois

Producao, desktop 1440x900, Rota 1 em jogo:

| medida | antes | depois |
| --- | --- | --- |
| luzes na cena | 12 (10 habilitadas) | 3 (3 habilitadas) |
| materiais ao entrar | 173 | 88 |
| materiais apos 10 passos | 303 | 88 |
| programas de shader compilados | 13, indo a 24 ao reentrar | 11, estaveis |
| scroll vertical do documento | 75 px | 0 |
| erros de console | 0 | 0 |

## 6. Ciclo de vida

Sessao unica em producao: entrar, jogar a Rota 1 **ate a vitoria**, seguir para a
proxima rota, jogar a Rota 2 ate a vitoria, abrir e fechar os detalhes, trocar de
modo, redimensionar tres vezes, voltar para a Home e reentrar duas vezes.

Em **todos** os pontos: `engines: 1`, `scenes: 1`, `lights: 3`, `materials: 88`,
`programs: 11`, `scrollY: 0`, `overflowX: 0`. Na Home, `canvas.route-babylon-board`
some (0), e volta a 1 ao reentrar. Zero erro de console, zero resposta >= 400.

Teste de crescimento dedicado: cinco ciclos de abrir/fechar detalhes mais seis
regeneracoes de mapa com 72 passos. Delta final: `meshes 0, materials 0,
programs 0, lights 0, shadowCasters 0`.

Painel de detalhes: abre (`aria-expanded=true`), fecha pelo botao e por `Escape`
de dentro do painel, devolvendo o foco ao acionador. O tabuleiro nao se move nem
muda de tamanho em nenhum dos quatro estados (`top 240`, `altura 639`).

## 7. Os 75 px de scroll

`.rsg-board-panel` tinha `width: min(100%, calc(133.333svh - 17rem))`: o
tabuleiro era dimensionado pela largura e `aspect-ratio: 4/3` derivava a altura,
entao aquele `17rem` precisava representar todo o cromo acima e abaixo - topbar,
assinatura, objetivo, gaps e o proprio padding do frame.

A conta real em 1440x900:

- cromo acima do tabuleiro: 258 px; abaixo: 21,6 px; total **279,6 px**;
- a formula reservava 272 px de largura, que a 4/3 cobre 204 px de altura;
- tabuleiro resultante: 928 x 696; altura disponivel: 620,4 px;
- **696 - 620,4 = 75,6 px** - exatamente o scroll relatado.

Nenhuma constante e adivinhada agora. O frame preenche o shell e para ali
(`flex: 1 1 auto; min-height: 0`), a linha do layout recebe a altura restante, e
o tabuleiro e essa linha. O numero que era fixo passou a ser medido pelo proprio
layout: o cromo pode crescer ou encolher e a pagina continua sem rolar.

A proporcao 4/3 foi mantida - e a composicao aprovada -, mas agora deriva da
altura concedida em vez de ditar a altura. Deixar o canvas ocupar a coluna
inteira renderizaria o mesmo tabuleiro numa caixa bem mais larga: o tamanho do
tabuleiro na tela segue **so** a altura do canvas, porque o eixo vertical e o que
prende o ajuste da camera em qualquer proporcao >= 1. A largura extra seria pixel
transparente sobre a sala, pago todo frame.

Nada de `overflow: hidden` global como maquiagem: as unicas regras novas estao em
`@media (min-width: 901px)`, no shell da Rota. Abaixo de 900 px o tabuleiro
empilha acima dos controles, ja era livre de scroll, e ficou intocado.

## 8. Compensacao da camera

Fechar o scroll devolveu ao tabuleiro a altura verdadeira da linha, que no
desktop e 75 px menor do que a formula alegava - o tabuleiro sairia cerca de 11%
menor que o enquadramento aprovado. A margem de seguranca absorveu isso: passou
de 0,8 para 0,45 unidade, sobre um tabuleiro que a camera 3/4 ja achata na
vertical.

Medido com `data-cell-centers`, que o proprio canvas publica (nao e
instrumentacao adicionada), mais meia celula da projecao real:

| viewport | canvas | tabuleiro | esq | dir | topo | base |
| --- | --- | --- | --- | --- | --- | --- |
| desktop 1440x900 | 827x621 | 758x401 | 29 | 41 | 152 | 68 |
| tablet 820x1180 | 796x597 | 729x385 | 28 | 39 | 146 | 66 |
| mobile 390x844 | 372x279 | 332x190 | 17 | 23 | 64 | 25 |

Todas as margens positivas nos quatro lados: nada cortado. O tabuleiro ficou em
cerca de 95% do tamanho aprovado, em vez dos 89% que a correcao de layout
sozinha produziria.

## 9. Responsividade em producao

| viewport | scroll vertical | overflow horizontal | menor alvo do D-pad | erros | 404 |
| --- | --- | --- | --- | --- | --- |
| desktop 1440x900 | 0 | 0 | 49 px | 0 | 0 |
| tablet 820x1180 | 0 | 0 | 55 px | 0 | 0 |
| mobile 390x844 | 0 | 0 | 47 px | 0 | 0 |

## 10. Validacao 9x9 repetida

`node tools/validation/validate-route-9x9.mjs`

- 2.160 mapas gerados, 360 execucoes de template forcado;
- **0 mapas de fallback**, **0 erros de validacao**, lista de erros vazia;
- 4 templates unicos, 2.261 candidatos rejeitados pelos criterios de qualidade.

Smoke adicional em volume dobrado (`--seeds 400 --template-seeds 40`): 4.320
mapas, 720 execucoes forcadas, **0 fallback**, **0 erros**.

## 11. Sobre o erro de compilacao

Nao consegui reproduzir a mensagem literal do Babylon nesta maquina. Tentei em
dev frio, dev aquecido e producao; em ANGLE/D3D11 sobre a GTX 1060 (o mesmo
backend do navegador daqui) e em SwiftShader; com a cena em 10, 11 e 12 luzes;
antes e depois de iniciar a rota. O console ficou limpo em todas as passagens -
so avisos de performance `GPU stall due to ReadPixels`, que nao vem de shader.

O que esta corrigido nao e um palpite: o acoplamento entre contagem de luzes e
recompilacao de material esta comprovado no codigo do carregador, e o efeito
esta medido (13 a 24 programas caindo para 11 estaveis; 303 materiais caindo
para 88 fixos). A condicao que produzia o problema - dezenas de materiais
compilando para 12 luzes e sendo remarcados a cada importacao e a cada turno -
deixou de existir. Se a mensagem reaparecer, vale capturar o texto completo e o
bloco de `Defines`, porque ai o gatilho e outro.

## 12. Evidencias

- `lights-11-on.png` / `lights-3-only.png` - o par que prova a irrelevancia das
  sete point lights;
- `route-desktop.png`, `route-tablet.png`, `route-mobile.png`;
- `route-details-open.png` - bandeja aberta sem mover o tabuleiro;
- `route-completed.png` - rota concluida de verdade pelo fluxo normal.

## 13. Preservado

Cena full-bleed, ausencia de vitrine, ausencia de sombra oval pintada, portal
vertical teal, HUD reduzido e assinatura da Rota, grid 9x9, quatro templates,
ancoras derivadas, camera responsiva, readiness e watchdog proprios da Rota,
D-pad e teclado. Gameplay intocado: `useEscapeMaze.ts` nao tem uma linha de
diferenca nesta missao.

## 14. Backlog (nao alterado aqui, por instrucao da missao)

1. troca de modo retornando a Rota 1;
2. pressao do guardiao e intervalo decisorio de 32;
3. variedade de templates - quatro se repetem rapido em 9x9;
4. numero de luzes do objetivo e armadilhas ativas;
5. balanceamento 9x9 ainda nao validado em jogo real;
6. legibilidade das casas no mobile (canvas de 372x279 para nove colunas);
7. o ajuste da camera reserva a meia-extensao completa no eixo vertical, embora a
   camera 3/4 achate o tabuleiro nesse eixo - da para ganhar tamanho de tabuleiro
   com um modelo de enquadramento que considere o encurtamento, mas isso muda o
   enquadramento aprovado e merece missao propria.
