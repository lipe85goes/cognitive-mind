# Rota Estratégica — Dois Guardiões, runtime 01B

Fechamento **funcional** do Caçador + Sentinela do Portal no runtime real.
Nada aqui é ilustrativo: cada número foi medido, e a ferramenta que o produziu
está em `tools/validation/`.

Este material foi escrito durante a missão, antes do commit. A 01B foi
protegida depois em `4f74f86 feat(route): add territorial sentinel runtime`.

---

## Status

**ROTA-DUAL-GUARDIANS-MAPS-01B_READY_FOR_PLAYTEST** — 17/17 portões funcionais.

| marcador | valor |
|---|---|
| `RUNTIME_VISIBILITY_CHECK` | **PASS** |
| `SENTINEL_FUNCTIONAL_RUNTIME` | **PASS** |
| `SENTINEL_VISUAL_FINAL_APPROVAL` | **PENDING** *(no fechamento da 01B)* |
| `SENTINEL_VISUAL_FOLLOWUP_REQUIRED` | **true** *(no fechamento da 01B)* |
| `TRAP_VISUAL_FOLLOWUP_REQUIRED` | **true** |

### Depois da 01B

O follow-up visual do Sentinela **foi resolvido**, em missão posterior:

| marcador | valor atual |
|---|---|
| `SENTINEL_VISUAL_FOLLOWUP_REQUIRED` | **false — RESOLVED** |
| `SENTINEL_VISUAL_FINAL_APPROVAL` | **APPROVED** |
| resolvido por | `ROTA-SENTINEL-VISUAL-REFINE-01` |
| commit | `11a23ea5e507c6e9557a87a6d28bbab41ac25e91` |
| checagem visual manual | **PASS** |
| `TRAP_VISUAL_FOLLOWUP_REQUIRED` | **true** — continua pendente |

O totem foi substituído pelo modelo do próprio Caçador em paleta fria.
Detalhes em [`../route-sentinel-visual-refine-01/README.md`](../route-sentinel-visual-refine-01/README.md).

As linhas acima registram o estado **no momento da 01B** e ficam como estão: a
01B não nasceu com o visual final, e apagar isso reescreveria a cronologia.

O usuário executou a Rota em navegador real e gravou vídeo do gameplay.
Confirmou-se que as três peças aparecem e são distinguíveis, que o Sentinela
permanece associado à região do portal, que o Caçador percorre o tabuleiro, que
o portal continuou utilizável e que a partida pôde concluir.

No fechamento da 01B, **o visual do Sentinela ainda não era o design final**:
ele era funcional e visível, mas a estética foi rejeitada. O redesenho não
bloqueou o fechamento funcional, e foi entregue depois — ver a tabela acima e
[`visual-followups.md`](visual-followups.md).

---

## Os dois papéis

| | Caçador | Sentinela |
|---|---|---|
| pergunta | "como alcanço o Explorador?" | "qual acesso devo proteger?" |
| alcance | atravessa o tabuleiro | preso à coleira de 4 do portal |
| política | Manhattan-guloso, atual, intocada | territorial c3 `{ patrol: true, commitTurns: 3 }` |

Medido com o Explorador parado longe do portal: o Caçador chega a **7–16**
células de distância do portal enquanto o Sentinela **nunca passa de 1**, sem
ganhar um passo de aproximação em 6 de 6 seeds. `HUNTER_ROLE != SENTINEL_ROLE`
provado.

Nota registrada: o Caçador minimiza distância **Manhattan** e por isso pode
travar atrás de uma parede e até perder terreno em distância de caminho. É a
política aprovada, não defeito, e a distinção de papéis não depende disso.

## Ordem do turno

```
EXPLORADOR → checagens → CAÇADOR → captura → SENTINELA → captura
```

Não foi inventada: é a do `simulateDual` do lab, que a 01A validou em 270 mapas
dinâmicos. Contratos em [`runtime-turn-order.md`](runtime-turn-order.md) e
[`sentinel-runtime-contract.md`](sentinel-runtime-contract.md).

## Portões funcionais

| portão | medido |
|---|---|
| equivalência LAB ↔ RUNTIME | **0 divergências** em 658 estados, 36 mapas |
| `commitTurns = 3` | escada exata `0→3, 3→2, 2→1, 1→0`, então reavalia |
| finta | comprometeu com `3,7`; Explorador mudou para `2,8`; **manteve**; re-mirou só após expirar |
| coleira | 315 estados sob coleira, **0** quebras |
| Sentinela sobre o portal | **0** |
| portal selado pelo Sentinela | **0/6** |
| reset e transições | **0 vazamentos** em 9 cenários |
| gameplay 9 combinações | **0 crashes**; vitória e derrota possíveis; Sentinela se move em todas |
| regressão 01A | A–F 6/6 · 4 seeds 4/4 · validador 135 mapas, 0 throws, 0 erros |
| luzes Babylon | **3**, `ROUTE_MAX_LIGHTS = 3`, nenhuma nova |

## Capturas e colisões

| caso | resultado |
|---|---|
| Caçador entra na célula do Explorador | derrota |
| Sentinela entra na célula do Explorador | derrota |
| Explorador entra na célula do Caçador | derrota (contrato preservado) |
| Explorador entra na célula do Sentinela | derrota |
| Caçador e Sentinela disputam a mesma célula | o Sentinela decide por último, já vendo o Caçador; se o destino coincidir, permanece parado |

Nada depende da ordem de renderização.

## HUD

O aviso de proximidade é calculado a partir da posição do **Caçador**, então
passou a dizer "O Caçador está próximo". A legenda agora lista Caçador e
Sentinela; o rótulo genérico "Guardião" saiu.

Nada explica `commitTurns`, coleira ou seleção de acesso. O comportamento
ensina a mecânica.

## Observação para playtest — não rebalanceada

No gameplay automatizado o **agente Explorador do teste é ingênuo**: vai direto
ao objetivo mais próximo e só evita células ocupadas naquele instante. Com o
Sentinela segurando as portas, ele entra em ciclos, e os timeouts subiram em
algumas combinações — `rota2/hard` 18/20, `rota3/easy` e `rota3/hard` 16/20.

Provavelmente artefato do agente de teste, não medida de dificuldade: a análise
dinâmica da 01A usou `humanV3`, bem mais capaz, e não apresentou esse padrão.
**Registrado, não rebalanceado** — a calibração vem depois de traps e baú.

## Fora de escopo, deliberadamente

- armadilhas continuam **passivas** — comportamento reservado para `ROTA-TRAPS-STRATEGY-01`;
- escudo azul continua no contrato atual — baú e recompensas em `ROTA-CHEST-REWARDS-01`;
- **sem timer** — calibração final depois de Sentinela + traps + baú.

## Índice

| arquivo | conteúdo |
|---|---|
| `runtime-turn-order.md` | fluxo do turno, antes e depois |
| `sentinel-runtime-contract.md` | política c3 portada, constante por constante |
| `sentinel-visual-contract.md` | separação visual e regra de iluminação |
| `visual-followups.md` | follow-ups visuais: Sentinela (resolvido) e armadilhas (pendente) |
| `sentinel-lab-runtime-equivalence.json` | 658 estados, 0 divergências |
| `sentinel-feint-trace.json` | finta, turno a turno |
| `hunter-vs-sentinel-role-test.json` | papéis distintos |
| `sentinel-state-reset-tests.json` | 9 cenários de transição |
| `sentinel-runtime-gameplay.json` | 9 combinações, capturas, portal, escada de commit |
| `sentinel-static-render-audit.json` | 22 checagens de render |
| `route-01b-acceptance.json` | consolidação dos portões |
