# Sentinela — antes e depois

## O que estava errado

A primeira versão era um totem: plinto octogonal, coluna, coroa e núcleo. Foi
escolhida para maximizar contraste de silhueta contra o Caçador — e o contraste
saiu forte demais. O jogador via **cenário**, não um defensor. Uma coluna não
persegue nem guarda; ela simplesmente está ali.

O erro foi meu, e foi de premissa: eu tratei "distinguível" como o objetivo,
quando o objetivo real era **"mesma família, funções diferentes"**.

## O que existe agora

O Sentinela veste o **modelo do próprio Caçador**, em paleta fria.

| | Caçador | Sentinela |
|---|---|---|
| modelo | `guardian.glb` | **o mesmo** `guardian.glb` |
| escala | `1.42` uniforme | `1.08 × 0.92 × 1.08` de `1.42` — mais largo, mais baixo |
| manto | `#221308` marrom escuro | `#0d1f26` ardósia fria |
| capuz | `#2c1c10` | `#13303a` |
| vazio do rosto | `#070302` | `#04090c`, emissivo `#062028` |
| base | `#2d2117` | `#17323a` |
| debrum | `#d98b2c` âmbar metálico | `#3fb3a6` teal metálico |
| olhos | `#ffc740` âmbar quente, intensidade 6,2 | `#7ff2e4` teal, intensidade 4,6 |
| brilho | `#f9a417` | `#2f9e91` |
| marca no chão | anel de alerta âmbar | anel de território teal, raio 0,78, espessura 0,028 |

Olhos mais frios e menos intensos por decisão de leitura: o Caçador **vem até
você**, o Sentinela **espera por você**.

## A parte que mais importa no código

Os materiais do modelo são compartilhados com o Caçador. Tingi-los no lugar
deixaria o Caçador teal também — e os dois renderizam na mesma passagem, então
quem "vencesse" dependeria de ordem. Por isso `tuneSentinelMaterial`
**clona** cada material antes de tocá-lo, e guarda o clone num cache por nome.

O cache não é otimização: `renderDynamicBoard` reconstrói o tabuleiro a cada
turno, e clonar por rebuild faria a contagem de materiais crescer sem limite —
exatamente o problema que a `ROTA-RUNTIME-STABILITY-01` fechou. Cada clone
recebe `capMaterialLights`.

## Fallback

`RouteToken3D` já usava a silhueta do Caçador com acento teal para
`kind="sentinel"`. Faltava a postura: agora o grupo recebe escala
`[1.08, 0.92, 1.08]`, igual ao tratamento do Babylon. Os dois tabuleiros
ensinam a mesma identidade.

## Iluminação

**Nenhuma Babylon Light foi adicionada.** A cena continua com 3 —
`route-key-light`, `route-fill-light`, `route-rim-light` — e
`ROUTE_MAX_LIGHTS = 3`. Todo o brilho é emissivo capturado pelo `GlowLayer`
existente.

## Compromisso

Durante `commitTurns`, o anel de território e os olhos usam
`route-sentinel-glow-committed` — o mesmo teal, um pouco mais firme. Sem
contador textual: a finta continua sendo aprendida pelo movimento.

## Escopo

`SENTINEL_RUNTIME_CHANGED: false` — **`useEscapeMaze.ts` tem zero diff.**
`TRAPS_CHANGED: false` — os pinos vermelhos seguem intactos, para
`ROTA-TRAPS-STRATEGY-01`.

Dois arquivos alterados: `routeBabylonScene.ts` e `RouteToken3D.tsx`.

## O que não foi verificado

**Não vi o resultado.** O ambiente não compõe quadros e o Playwright não está
instalado. Tudo acima é contrato de código confirmado por inspeção estática.

A aprovação estética é sua.
