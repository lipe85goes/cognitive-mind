# Sentinela — refinamento visual 01

Redesenho do Sentinela do Portal. **Somente visual**: o comportamento aprovado
na 01B não mudou uma linha.

| marcador | valor |
|---|---|
| `SENTINEL_VISUAL_DIRECTION` | **same-family-as-hunter** |
| `SENTINEL_RUNTIME_CHANGED` | **false** |
| `TRAPS_CHANGED` | **false** |
| `SENTINEL_VISUAL_FINAL_APPROVAL` | **PENDING** |

## O problema

A primeira versão era um totem — plinto, coluna, coroa. Lia como cenário, não
como defensor. O erro foi de premissa: tratei "distinguível" como objetivo,
quando o objetivo era **"mesma família, funções diferentes"**.

## A correção

O Sentinela agora veste o **modelo do próprio Caçador**, com escala
`1.08 × 0.92 × 1.08` (mais largo, mais baixo — mesma espécie, postura mais
pesada) e todos os materiais clonados para uma paleta fria: manto ardósia,
debrum teal metálico, olhos teal calmos contra o âmbar quente do Caçador.

Detalhe completo em [`sentinel-before-after-contract.md`](sentinel-before-after-contract.md).

## Escopo

Dois arquivos: `routeBabylonScene.ts` e `RouteToken3D.tsx`.
**`useEscapeMaze.ts` tem zero diff** — a preferência declarada pela missão.

## Regressão funcional

| portão | medido |
|---|---|
| LAB ↔ RUNTIME | **0 divergências** em 658 estados, 36 mapas |
| `commitTurns = 3` | escada exata |
| finta | mantida durante o compromisso, re-mira só após expirar |
| coleira | **0** quebras |
| Sentinela sobre o portal | **0** |
| portal selado | **0/6** |
| reset e transições | **0 vazamentos** em 9 cenários |
| gameplay 9 combinações | **0 crashes** |
| luzes Babylon | **3**, nenhuma nova |

## Auditoria estática — 22 checagens

Silhueta antiga removida (plinto, coluna, coroa, núcleo); modelo do Caçador
reusado; postura plantada; capuz e olhos no fallback; anel de território
discreto; materiais **clonados antes de mutados** e cacheados por nome; paleta
do Caçador intocada; `capMaterialLights` aplicado; posição vinda do runtime;
dispose correto; **nenhuma lógica estratégica na camada visual**; fallback
alinhado.

## Não verificado

**Não vi o resultado.** O ambiente não compõe quadros (`document.hidden = true`,
`requestAnimationFrame` = 0) e o Playwright não está instalado.

Para a sua checagem manual:

1. parece da mesma família do Caçador?
2. continua claramente diferente?
3. o teal funciona?
4. o tamanho está bom?
5. parece personagem e não objeto?
6. o anel territorial está discreto?
7. o tabuleiro continua calmo?

## Índice

| arquivo | conteúdo |
|---|---|
| `sentinel-before-after-contract.md` | antes/depois, material por material |
| `sentinel-static-visual-audit.json` | 22 checagens de render |
| `sentinel-functional-regression.json` | prova de que o comportamento não mudou |
