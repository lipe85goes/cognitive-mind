# Armadilhas — refinamento visual 01

Refino de acabamento. **Somente visual**: a mecânica aprovada em `62ad414` não
mudou uma linha.

| marcador | valor |
|---|---|
| `TRAP_VISUAL_MANUAL_CHECK` | **PASS_WITH_REMARKS** |
| `TRAP_VISUAL_FINAL_DIRECTION` | **APPROVED** |
| `TRAP_RUNTIME_CHANGED` | **false** |
| `TRAP_VISUAL_DIRECTION` | **floor-integrated-rune** |
| `DORMANT_LANGUAGE` | **dark-engraved-rune** |
| `ACTIVE_LANGUAGE` | **deep-red-sealed-rune** |
| `ACTIVE_RED_TONE_POLISH_OPTIONAL` | **true** |
| `DYNAMIC_SOLVABILITY_CHANGED` | **false** |
| `DYNAMIC_SOLVABILITY_REVIEW_REQUIRED` | **true** |

## Inspeção manual

O usuário inspecionou em navegador real. **Aprovado para seguir.**

**Dormente:** deixou de parecer badge/pickup; a leitura integrada ao piso
melhorou; a geometria é baixa; os sulcos são o elemento principal; discreta, não
domina o tabuleiro.

**Ativa:** a mudança de estado é clara; permanece legível depois da ativação;
não depende de efeito transitório; continua integrada ao chão; sem núcleo branco
de coletável; sem peça preenchida dominante.

**Ressalva não bloqueadora:** em alguns ângulos a armadilha ativa ainda puxa
levemente para magenta/rosa. Não compromete a leitura funcional e não exige
missão própria — fica como `ACTIVE_RED_TONE_POLISH_OPTIONAL` para o polimento
visual final da Rota. **Nenhum refinamento adicional foi feito aqui.**

A prioridade seguinte é `ROTA-DYNAMIC-SOLVABILITY-01`.

## O que estava errado

Dormente lia como badge rosa apoiada na célula; ativa ficava clara a ponto de
parecer coletável. As causas eram duas peças **preenchidas**: um hexágono cheio
sob a runa e uma esfera clara no centro.

## O que mudou

As duas foram removidas. Sobrou só gravação — anel externo, três sulcos
radiais, anel interno — com altura máxima **0,016** (antes 0,05) e paleta vinho
escuro / vermelho queimado.

Auditado: **nenhuma** cor com luminância média acima de 170 e **nenhum** tom
rosa remanescente. Detalhes em
[`trap-before-after-contract.md`](trap-before-after-contract.md).

## Regressão funcional

Contrato A–K **11/11** · conjunto vazio **486 estados, 0 divergências** ·
Sentinela LAB↔RUNTIME **658 estados / 0 divergências** · `commitTurns` exato ·
finta · 0 quebras de coleira · 0 ocupações do portal · 0 vazamentos em 8
transições · 0 crashes nas 9 combinações · **3 luzes Babylon**.

## Verificação visual

Eu **não** vi o resultado: o ambiente não compõe quadros e o Playwright não está
instalado. Tudo que este arquivamento afirma sobre render é contrato de código,
confirmado por inspeção estática.

Quem viu foi o usuário, em navegador real — ver "Inspeção manual" acima.

## Fora de escopo

O achado de solvabilidade dinâmica das 12 seeds `POTENTIAL_SENTINEL_OSCILLATION_LOCK`
segue intacto e continua endereçado a `ROTA-DYNAMIC-SOLVABILITY-01`.
