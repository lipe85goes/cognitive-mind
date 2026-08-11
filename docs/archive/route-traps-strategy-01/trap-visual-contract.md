# Contrato visual das armadilhas

## O que saiu

Os pinos/cones vermelhos. No Babylon eram um prop GLB vertical mais um cone de
5 lados; no fallback, um cone de 3 lados **mais um `pointLight`**. Liam como
objetos apoiados sobre o tabuleiro.

## O que entrou

Uma **runa gravada no piso**, quase nivelada ao tile:

| elemento | Babylon | fallback |
|---|---|---|
| placa | hexágono, diâmetro 0,72, altura 0,035 | círculo de 6 lados, raio 0,24 |
| anel | toro, raio 0,5, espessura 0,022 | anel 0,13–0,17 |
| sulcos | 3 barras radiais gravadas | — |
| núcleo | esfera 0,12 | disco 0,06 |

A peça mais alta tem 0,05 de altura. Não há nada vertical.

## Os dois estados

| | dormente | armada |
|---|---|---|
| face | `#4a2229` óxido | `#c8323f` |
| núcleo | `#5d2b33` | `#ff8a92` |
| emissivo | quase nulo (0,04) | aceso |
| movimento | imóvel | respiração lenta, amplitude 0,05 |

O jogador deve ler *"há algo nesta célula"* quando dormente, e *"isto está
acordado"* quando armada — perceptível vários turnos depois, não só no instante.

**A semântica inverteu.** Antes, `triggered` significava *gasta* e escurecia.
Agora significa **armada** e acende. Os dois renderers foram trocados juntos.

## Iluminação

**Nenhuma Babylon Light foi adicionada** — a cena continua com 3 e
`ROUTE_MAX_LIGHTS = 3`. E o `pointLight` que existia no fallback foi
**removido**: uma luz por armadilha, com até 6 armadilhas por mapa, era
exatamente o padrão que a `ROTA-RUNTIME-STABILITY-01` fechou.

Todo o brilho é emissivo, capturado pelo `GlowLayer` existente.

## Feedback

Uma linha calma na ativação: *"Armadilha ativada. Os defensores precisam
contornar."* Sem tutorial, sem contador, sem coordenadas, sem pathfinding
exposto. Depois disso, a runa acesa ensina sozinha.

## Não verificado

**Não vi o resultado.** O ambiente não compõe quadros e o Playwright não está
instalado. O que está acima é contrato de código.
