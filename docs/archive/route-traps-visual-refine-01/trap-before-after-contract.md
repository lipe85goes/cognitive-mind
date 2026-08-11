# Armadilhas — antes e depois

## O que o playtest apontou

**Dormente:** lia como uma placa/badge rosa **apoiada sobre** a célula, não
gravada nela. **Ativa:** rosa/branca brilhante o bastante para ser confundida
com coletável ou recompensa — o oposto exato do que significa.

## As duas causas

**1. A placa preenchida.** Havia um hexágono cheio de diâmetro 0,72 sob a runa.
Um disco cheio sobre um tile é a definição de badge, por mais baixo que esteja.

**2. O núcleo.** Uma esfera de 0,12 em `#ff8a92` com emissivo `#ff4d5a` — um
volume claro no centro, que é exatamente a linguagem de item colecionável.

## O que mudou

Só gravação. A placa e a esfera foram **removidas**.

| elemento | Babylon | fallback |
|---|---|---|
| anel externo | toro 0,5 / 0,018 em `+0,014` | anel hexagonal 0,195–0,225 |
| sulcos | 3 barras radiais 0,24 × 0,014 em `+0,012` | 3 planos 0,09 × 0,028 |
| anel interno | toro 0,2 / 0,016 em `+0,016` | anel 0,075–0,095 |

Altura máxima **0,016** (antes 0,05). Nada preenchido, nada volumétrico.

## Paleta

| | antes | agora |
|---|---|---|
| dormente face | `#4a2229` | `#3a1a1f` vinho escuro |
| dormente núcleo | `#5d2b33` | `#4a2229` |
| dormente emissivo | 0,04 | **0,02** |
| ativa face | `#c8323f` + `#e0313f` | `#7e1620` + `#8f1a24` |
| ativa núcleo | **`#ff8a92`** + `#ff4d5a` | `#a51e2a` + `#b3202c` |

Verificado por auditoria: nenhuma cor com luminância média acima de 170, e
nenhum dos tons rosa antigos permanece. `anyNearWhite: false`, `anyPink: false`.

## Estado persistente

O estado ativo não depende de efeito temporário: os dois renderers derivam a cor
de `triggeredTrapKeys` a cada reconstrução do tabuleiro. A runa fica acesa
enquanto a armadilha estiver armada, quantos turnos forem.

O único movimento é a respiração lenta do anel interno no fallback (amplitude
0,05), e só quando armada. Dormente é imóvel.

## Iluminação

**Nenhuma luz adicionada.** Babylon segue com 3 e `ROUTE_MAX_LIGHTS = 3`; o
fallback continua sem `pointLight`. Todo brilho é emissivo pelo `GlowLayer`
existente.

## Escopo

`TRAP_RUNTIME_CHANGED: false` — **`useEscapeMaze.ts` tem zero diff.**
`DYNAMIC_SOLVABILITY_CHANGED: false`. Dois arquivos alterados, ambos de render.

## Não verificado

**Não vi o resultado.** O ambiente não compõe quadros e o Playwright não está
instalado. Tudo acima é contrato de código confirmado por inspeção estática.
