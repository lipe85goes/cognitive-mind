# Rota Estratégica — Dois Guardiões, runtime 01B

Fechamento **funcional** do Caçador + Sentinela do Portal no runtime real.
Nada aqui é ilustrativo: cada número foi medido, e a ferramenta que o produziu
está em `tools/validation/`.

Nenhum commit foi feito nesta missão. O trabalho vive no working tree.

---

## Status

**ROTA-DUAL-GUARDIANS-MAPS-01B_READY_FOR_PLAYTEST** — 17/17 portões funcionais.

| marcador | valor |
|---|---|
| `RUNTIME_VISIBILITY_CHECK` | **PASS** |
| `SENTINEL_FUNCTIONAL_RUNTIME` | **PASS** |
| `SENTINEL_VISUAL_FINAL_APPROVAL` | **PENDING** |
| `SENTINEL_VISUAL_FOLLOWUP_REQUIRED` | **true** |
| `TRAP_VISUAL_FOLLOWUP_REQUIRED` | **true** |

O usuário executou a Rota em navegador real e gravou vídeo do gameplay.
Confirmou-se que as três peças aparecem e são distinguíveis, que o Sentinela
permanece associado à região do portal, que o Caçador percorre o tabuleiro, que
o portal continuou utilizável e que a partida pôde concluir.

**O visual atual do Sentinela não é o design final aprovado.** Ele é funcional e
visível; a estética foi rejeitada e será refeita. Direção registrada em
[`visual-followups.md`](visual-followups.md). O redesenho **não bloqueia** o
fechamento funcional.

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
| `visual-followups.md` | redesenhos pendentes: Sentinela e armadilhas |
| `sentinel-lab-runtime-equivalence.json` | 658 estados, 0 divergências |
| `sentinel-feint-trace.json` | finta, turno a turno |
| `hunter-vs-sentinel-role-test.json` | papéis distintos |
| `sentinel-state-reset-tests.json` | 9 cenários de transição |
| `sentinel-runtime-gameplay.json` | 9 combinações, capturas, portal, escada de commit |
| `sentinel-static-render-audit.json` | 22 checagens de render |
| `route-01b-acceptance.json` | consolidação dos portões |
