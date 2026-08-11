# Rota Estratégica — Armadilhas como ferramenta

As armadilhas vermelhas deixaram de ser punição passiva. Agora são o
instrumento com que o Explorador **muda o tabuleiro** e obriga Caçador e
Sentinela a reconsiderarem o caminho.

Ele não destrói os defensores. Ele fecha portas.

| marcador | valor |
|---|---|
| `TRAP_FUNCTIONAL_RUNTIME` | **PASS** |
| `TRAP_MANUAL_GAMEPLAY_CHECK` | **PASS** |
| `TRAP_ACTIVATION_IS_PLAYER_ERROR` | **false** |
| `TRAP_ACTIVATION_DAMAGE` | **false** |
| `TRAP_VISUAL_DIRECTION` | **PASS** |
| `TRAP_VISUAL_FINAL_APPROVAL` | **PENDING** *(no fechamento desta missão)* |
| `TRAP_VISUAL_REFINE_REQUIRED` | **true** *(no fechamento desta missão)* |
| `DYNAMIC_SOLVABILITY_REVIEW_REQUIRED` | **true** |

### Depois desta missão

O follow-up visual das armadilhas **foi resolvido**:

| marcador | valor atual |
|---|---|
| `TRAP_VISUAL_REFINE_REQUIRED_NOW` | **false — RESOLVED** |
| `TRAP_VISUAL_FINAL_DIRECTION` | **APPROVED** |
| resolvido por | `ROTA-TRAPS-VISUAL-REFINE-01` |
| commit | `607e3e9e492b5a7811f997c2a6af2bd1f3dca5f9` |
| checagem manual | **PASS_WITH_REMARKS** |
| `ACTIVE_RED_TONE_POLISH_OPTIONAL` | **true** — ressalva não bloqueadora |
| `DYNAMIC_SOLVABILITY_REVIEW_REQUIRED` | **true** — continua pendente |

A placa preenchida e a esfera do núcleo foram removidas; sobrou só gravação, com
altura máxima 0,016 e paleta vinho/vermelho queimado. Detalhes em
[`../route-traps-visual-refine-01/README.md`](../route-traps-visual-refine-01/README.md).

As linhas acima registram o estado **no fechamento desta missão** e ficam como
estão: ela não nasceu com o acabamento final, e apagar isso reescreveria a
cronologia.

## Playtest real

O usuário executou a Rota em navegador real. O comportamento funcional
observado é compatível com o contrato: as armadilhas armam ao serem pisadas e
os defensores passam a contorná-las.

O visual **melhorou** em relação aos cones antigos e a direção foi aprovada,
mas o acabamento **não** é final. Observado:

- a armadilha dormente ainda lê como **placa/badge rosa apoiada** sobre a
  célula, em vez de gravada nela;
- a armadilha ativa fica, em alguns momentos, **rosa/branca brilhante demais**;
- nesse estado ela pode ser confundida com **coletável/recompensa** — o
  contrário do que deveria comunicar.

Direção para o refinamento futuro: runa **escura e integrada ao chão** quando
dormente; **vermelho profundo com emissivo controlado** quando ativa. Nunca
clara, nunca rosada, nunca parecida com prêmio.

Não corrigido aqui — este arquivamento fecha o comportamento. A direção acima
foi executada depois, em `ROTA-TRAPS-VISUAL-REFINE-01` (`607e3e9`), e aprovada
em nova inspeção manual.

---

## O contrato

| | Explorador | Caçador | Sentinela |
|---|---|---|---|
| **dormente** | atravessa | atravessa | atravessa |
| **armada** | **atravessa** | **bloqueado** | **bloqueado** |

Arma quando o Explorador conclui um movimento válido sobre ela. Permanece
armada pelo resto da partida. Um mapa novo começa dormente. Cada armadilha é
independente e armar de novo é idempotente.

Uma armadilha armada **não** é parede global: não bloqueia o Explorador, as
luzes, o objetivo, o portal, nem o caminho lógico do jogador.

Detalhes em [`trap-runtime-contract.md`](trap-runtime-contract.md) e
[`trap-turn-order.md`](trap-turn-order.md).

## Pisar não é erro

O comportamento legado foi removido: sem erro contabilizado, sem shake, sem tom
de erro, sem escudo consumido. A armadilha é ferramenta do jogador, e o jogador
não paga para usar a própria ferramenta.

O escudo azul **não foi redesenhado** aqui — ele apenas deixou de ser gasto em
armadilhas. Sua nova função pertence a `ROTA-CHEST-REWARDS-01`.

Os erros legítimos continuam: pisar no Caçador ainda conta, movimento bloqueado
ainda conta. Ver [`trap-damage-removal-tests.json`](trap-damage-removal-tests.json).

## Provas

| fase | resultado |
|---|---|
| controlados A–K | **11/11** |
| Caçador dormente vs armada | **40/40** entrou · **0/40** entrou |
| Sentinela em 120 estados com trap armada | **0** entradas |
| mesmo turno | **0** travessias |
| múltiplas armadas | **6** simultâneas, 0 violações |
| conjunto vazio reproduz o anterior | 486 estados, **0** divergências (Caçador e Sentinela) |
| trace do Caçador (Fase 11) | dormente → entrou; armada → desviou |
| trace do Sentinela (Fase 12) | 0 entradas, 0 coleira, 0 portal, **0 teleportes** |
| dupla manipulação (Fase 13) | ambos miravam a armadilha; depois desviaram para lados opostos |
| transições com armada (Fase 18) | **0/8** vazamentos |
| gameplay 9 combinações (Fase 16) | **0 crashes**, **0 violações**, **0 ocupações do portal** |
| 01B preservada | equivalência 658 estados / 0 divergências |
| gerador | A–F 6/6 · 4 seeds 4/4 · validador 126 mapas, 0 throws |
| luzes Babylon | **3**, nenhuma adicionada |

## Visual

Cones removidos dos dois renderers; agora é runa gravada no piso, altura máxima
0,05. Dormente é óxido quase apagado; armada acende e respira devagar. A
semântica inverteu — `triggered` significava *gasta*, agora significa **armada**.

> Esta descrição é a **desta missão**. O refinamento posterior removeu a placa
> preenchida e a esfera do núcleo e baixou a altura máxima para 0,016 — ver
> [`../route-traps-visual-refine-01/trap-before-after-contract.md`](../route-traps-visual-refine-01/trap-before-after-contract.md).

O `pointLight` que o fallback criava por armadilha foi removido: com até 6 por
mapa, era o padrão que a `ROTA-RUNTIME-STABILITY-01` fechou.

Ver [`trap-visual-contract.md`](trap-visual-contract.md).

## O problema que NÃO foi resolvido aqui

O playtest humano encontrou algo mais importante que qualquer coisa nesta
missão: **um mapa estruturalmente válido pode ser dinamicamente impraticável.**

Portal com duas entradas; o Explorador ameaça A; o Sentinela fecha A; o
Explorador vai para B; o Sentinela fecha B; repete.

O gameplay automatizado reproduziu a assinatura: **37 partidas suspeitas** nas 9
combinações, 12 registradas com seed, rota, modo, portal, acessos, portas
alternadas, luzes restantes e armadilhas ativas — em
[`trap-runtime-gameplay.json`](trap-runtime-gameplay.json), classificadas como
`POTENTIAL_SENTINEL_OSCILLATION_LOCK`.

**Nada foi corrigido, mascarado ou enfraquecido.** Nenhum mapa mudou, nenhum
limiar mudou, `commitTurns` continua 3. Isso vai para
`ROTA-DYNAMIC-SOLVABILITY-01`, que precisará testar o estado completo —
Explorador, Caçador, estado e compromisso do Sentinela, luzes coletadas,
armadilhas ativas, estado do portal — e provar que existe sequência real de
vitória.

Os timeouts do agente automatizado seguem marcados `AUTOMATED_AGENT_LIMITATION`:
o Explorador scriptado é ingênuo e não mede dificuldade humana.

## Verificação visual

Eu **não** vi o resultado: o ambiente automatizado não compõe quadros e o
Playwright não está instalado. Tudo que este arquivamento afirma sobre render é
contrato de código, confirmado por inspeção estática.

Quem viu foi o usuário, em navegador real — ver "Playtest real" no início. O
comportamento passou. O acabamento visual seguia pendente **naquele momento** e
foi resolvido depois, em `ROTA-TRAPS-VISUAL-REFINE-01`.
