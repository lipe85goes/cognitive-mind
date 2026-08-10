# Contrato visual do Sentinela

## O problema de leitura

Dois defensores no mesmo tabuleiro. Se parecerem irmãos, o jogador aprende
"há duas ameaças". Precisa aprender "há duas ameaças **diferentes**".

## A separação escolhida

| | Caçador | Sentinela |
|---|---|---|
| silhueta | figura encapuzada, cônica | coluna octogonal com plinto largo |
| proporção | alto e estreito | baixo e plantado |
| paleta | bronze quente `#5c3a18` / âmbar `#f59e0b` | pedra fria `#2f4858` / teal `#2f9e91` |
| marca no chão | anel de alerta âmbar | anel de território teal |
| leitura | vem até você | pertence a este lugar |

O teal é a linguagem do próprio portal. O Sentinela é do mesmo material que a
região que ele guarda; o Caçador é de outro material e atravessa o mapa.

Nada de neon, nada de texto flutuante, nada de marcador clínico. Pedra, bronze
e energia, como o resto do mundo.

## Compromisso

Quando o Sentinela está segurando uma porta, o anel de território, a coroa e o
núcleo usam `route-sentinel-glow-committed` — o mesmo teal, um pouco mais firme.
Nada além disso.

Deliberadamente **não** existe contador "3, 2, 1" no HUD. A finta se percebe
pelo movimento: o jogador ameaça uma entrada, vê o Sentinela assumir, muda de
entrada e vê que ele não responde. Um contador entregaria a resposta e trocaria
uma descoberta por um número.

## Regra de iluminação

**Nenhuma Babylon Light foi adicionada.** A cena continua com exatamente três —
`route-key-light` (direcional), `route-fill-light` (hemisférica),
`route-rim-light` (point) — e `ROUTE_MAX_LIGHTS = 3`.

Todo o brilho do Sentinela é `emissive` capturado pelo `GlowLayer` existente.
A explosão de luzes que a `ROTA-RUNTIME-STABILITY-01` fechou não foi reaberta.

## Onde vive

`renderSentinel` em `routeBabylonScene.ts`, chamada por `renderDynamicBoard`
junto com o Explorador e o Caçador. Sete meshes primitivos, sem asset novo:
anel de território, plinto, coluna, coroa, núcleo.

`renderDynamicBoard` descarta a raiz anterior inteira a cada atualização, então
não existe mesh fantasma depois de restart, troca de rota ou de modo.

## Camada de decisão

A cena **não** contém estratégia. Não há `commitLeft`, nem `decideSentinelMove`,
nem `SENTINEL_LEASH` em `routeBabylonScene.ts` — verificado por inspeção
estática. Babylon recebe posição e um booleano de compromisso, e representa.

## Tabuleiro de fallback

`RouteBoardScene` (o caminho react-three-fiber) também recebe o Sentinela, com
o mesmo par de cores. Os dois tabuleiros ensinam a mesma coisa.

## O que NÃO foi verificado

**A aparência não foi vista por mim.** O ambiente de automação não compõe
frames (`document.hidden = true`, `requestAnimationFrame` = 0), e o Playwright
não está instalado. Tudo acima é contrato de código, confirmado por inspeção
estática — não é revisão visual.

A aprovação estética e de leitura é sua, em navegador real.
