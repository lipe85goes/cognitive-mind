# ROTA2-ADAPTIVE-HUNTER-04 — o Caçador reconhece uma direção repetida

Missão Rota 2.0 explicitamente aprovada (classe 4 do §12 de
`docs/GAMEPLAY_PLATFORM_LOCK_V1.md`) — a terceira exceção aprovada ao lock.
Base exata: `ec3e564a47b7fad8421bfae34fcbda32acebe043` (a árvore final da
ROTA2-SENTINEL-SOLVER-FIDELITY-03, cujo `src/` é o da DEPENDENT-OBJECTIVES-02).
Branch: `feat/rota2-adaptive-hunter-04`. Sem merge.

```text
o Explorador repete a direção do passo anterior bem sucedido
→ o Caçador reconhece a direção repetida
→ prevê uma casa à frente (Fácil/Médio: 1; Difícil: até 2)
→ tenta chegar lá antes, por um movimento legal de uma casa
→ o Explorador ainda pode virar.
```

Não é uma IA de aprendizado: uma memória (a última direção), uma regra exata,
um módulo puro. A Rota 1 não muda.

## 1. Contrato

- **Rota 1:** o Caçador da v1 (`chooseGuardianMove`), byte a byte: mesmos
  movimentos legais, mesmos ramos aleatórios e mesmas contagens de sorteio,
  mesma ordem do turno, mesmos mapas, mensagens, desfechos e pontuação
  (provado: §6.1, §6.3).
- **Rotas 2 e 3:** num passo bem sucedido cuja direção é igual à do passo bem
  sucedido anterior, e com o Caçador **não** vizinho do Explorador, o Caçador
  intercepta quando a previsão funciona; senão a perseguição de sempre decide.
- A política reage só ao que já aconteceu; nunca conhece a próxima ação; usa a
  topologia atual (paredes abertas pela armadilha ou pela Picareta, armadilhas
  armadas); nunca teleporta, nunca entra numa casa ilegal.
- Uma interceptação **nunca captura**: com o Caçador vizinho do Explorador a
  perseguição decide como antes, então um movimento de interceptação nunca cai
  na casa do Explorador. Ela posiciona; quem captura é a perseguição (ou o passo
  do próprio Explorador), exatamente como antes.
- Escolha do Baú, Picareta e Segunda Chance não são passos: nesses turnos a
  perseguição responde e a memória fica como está.

## 2. A memória — `lastExplorerDirection`

- Campo novo de `RouteRuntimeState`: `"up" | "right" | "down" | "left" | null`.
- Escrito pela transição C5 **existente** `MOVE_EXPLORER`, derivado da posição
  anterior e da nova (`explorerStepDirection`); um "movimento" que não é um
  passo ortogonal não inventa direção e mantém a anterior.
- `null` em toda sessão nova: início, reinício, troca de modo, próxima Rota
  (`createRouteState`). Passo bloqueado, quebra da Picareta, escolha do Baú e
  Segunda Chance que segura o Explorador não a mudam.
- A comparação usa a direção **anterior**: o hook lê `lastExplorerDirection` do
  estado antes do passo (o despacho do passo ainda não foi aplicado) e a direção
  do passo atual é uma entrada transitória do turno — nenhum segundo campo.
- Nenhuma ação C5 e nenhum evento C6 novos (12 ações, 14 eventos). Nenhuma lista
  de passos, nenhum perfil, nada entre Rotas, nenhum armazenamento.
- O hook expõe o campo como visão só-leitura (`lastExplorerDirection`); nada na
  tela o desenha.

## 3. A política — `src/games/escape-maze/route-hunter-intercept.ts`

Um módulo puro (único import de runtime: o tamanho do tabuleiro em
`route-config.ts`; sem React, Babylon, browser, storage, RNG, relógio; não
muta o que recebe). É a **única** implementação: o hook a chama, e os dois
solvers de referência carregam este mesmo módulo do grafo de produção.

`planHunterInterception(input)` → `null` (a perseguição decide) ou
`{ target, horizon, moves }`:

1. `hunterAdaptsOnRoute(routeNumber)` (Rotas ≥ 2); o turno é um passo e
   `direction === previousDirection`; o Caçador não está a distância ≤ 1 do
   Explorador.
2. Do horizonte do modo (`INTERCEPT_HORIZON`: Fácil 1, Médio 1, Difícil 2) até 1,
   a primeira previsão que funciona:
   - as casas do Explorador até a prevista, na direção, estão no tabuleiro e não
     são parede do labirinto **atual** — um caminho que o Explorador poderia
     andar;
   - a casa prevista é uma em que o Caçador pode ficar: não parede, não portal,
     não armadilha armada, não a Sentinela; e não é a própria casa do Caçador;
   - **Fácil**: o Caçador pisa nela com este movimento;
     **Médio/Difícil**: algum movimento legal encurta o caminho mais curto do
     Caçador até ela — BFS a partir da previsão no labirinto atual, sem
     atravessar parede, portal, armadilha armada, Sentinela **ou o Explorador**
     (chegar antes de alguém é contorná-lo).
3. `moves`: todo movimento legal de uma casa na nova distância mínima, na ordem
   fixa dos vizinhos (cima, baixo, esquerda, direita). Nunca vazio.

O fallback documentado: Difícil tenta 2 casas, depois 1; qualquer modo sem
previsão utilizável → perseguição. A previsão é hipótese, nunca conhecimento.

**Escolha.** `chooseInterceptionMove(moves)` (`route-defenders.ts`): um
movimento só → ele, sem sorteio; empate → `randomItem` do fluxo da Rota (um
sorteio). O módulo nunca sorteia.

## 4. O turno

Passo do Explorador, como antes até os defensores:

```text
direção do passo (transitória) · direção anterior (estado)
→ EXPLORER_STEP_COMMITTED (MOVE_EXPLORER grava a direção nova)
→ LIGHT_COLLECTED / TRAP_ARMED / WALL_OPENED_BY_TRAP / PORTAL_ACTIVATED
→ [vitória?] [Baú?]
→ Caçador: planHunterInterception na topologia do turno (turnWalls) com
  armadilhas armadas + a casa da Sentinela bloqueadas
     ≠ null → chooseInterceptionMove(moves)
     = null → chooseGuardianMove (a perseguição, inalterada)
→ Sentinela (inalterada) → captura / Segunda Chance / DEFENDERS_SETTLED
```

O Caçador continua antes da Sentinela; ninguém lê um tabuleiro meio velho
(`turnWalls` é o mesmo conjunto que a Sentinela e a zona do portal leem).
A Sentinela, inclusive o compromisso mantido com uma porta que virou armadilha
armada, não mudou (H27: 20 000 decisões reavaliadas na base, 0 diferenças).

## 5. Mensagem

"O Caçador tenta cortar seu caminho." — só quando a interceptação deu o
movimento. Prioridade: luz, armadilha, passagem, portal e a chegada ao portal
continuam acima; a interceptação vem antes de "O Caçador está próximo…". Captura
e Segunda Chance têm suas mensagens. Na mesma região `role="status"` de sempre:
nenhuma UI nova, nenhum alarme, cronômetro, tremor de câmera, dano, pontuação.

## 6. Validação

Evidência: `docs/archive/rota2-adaptive-hunter-04/`. Comandos em
`tools/validation/README.md`.

### 6.1 Suíte dedicada (`rota2-adaptive-hunter-tests.mjs`) — 32/32

O hook real (`route-runtime-harness.mjs`) da árvore em teste, os dois solvers
empacotados, o oráculo composto e um **verificador de contrato** escrito a
partir do texto da missão (`rota2-adaptive-hunter-lib.mjs`
`contractInterception`, distâncias pela `findPathLength` da produção), que
nenhum modelo importa (H32). `[preserved]`: deve valer na base e aqui;
`[adaptive]`: deve falhar na base e valer aqui.

| | check | medido |
| --- | --- | --- |
| H01 | Rota 1: suporte do Caçador inalterado (hook, solvers, toda direção lembrada) | 3 179 turnos, 63 580 pares de solver; 0 fora da perseguição, 0 diferenças com os solvers anteriores |
| H02 | Rota 1: sorteios iguais à base, valor e contagem, turno a turno | 36 partidas, 2 746 turnos, 4 484 sorteios; 0 partidas diferentes |
| H03 | a memória começa `null` (montagem, início, toda sessão nova) | 9 sessões |
| H04 | um passo bem sucedido grava a sua direção (as quatro, toda Rota) | 14 974 passos, 0 divergências |
| H05 | passo bloqueado, quebra, escolha do Baú, Segunda Chance no lugar não mudam a memória | 186 casos, 0 sobrescritas |
| H06 | mudar de direção nunca adapta (Rotas 2/3) | 6 624 mudanças + 144 primeiros passos: 0 interceptações, 0 mensagens |
| H07 | direção repetida nas Rotas 2/3 → interceptação do contrato | 949 turnos (R2: 5/230/297, R3: 14/178/225 por Fácil/Médio/Difícil); 198 movimentos que a perseguição não faria; mensagem ↔ interceptação 0 desvios |
| H08 | direção repetida na Rota 1 não muda nada | 1 337 repetições (421 interceptariam na Rota 2): 0 efeitos |
| H09 | Fácil: só uma casa alcançável com este movimento | 50 343 estados, 347 planos, 9 299 previsões distantes deixadas à perseguição |
| H10 | Médio: uma casa à frente, todo movimento que encurta | 7 560 planos (320 vizinhos da previsão, 7 240 mais longe); 0 movimento omitido ou errado |
| H11 | Difícil: duas casas quando ambas livres e a segunda aproximável | 3 090 planos de 2 casas, 323 no hook; 0 errados |
| H12 | Difícil: fallback para 1 casa, nunca forçado | 3 914 previsões de 2 casas inutilizáveis (parede/tabuleiro 3 531, portal 94, armadilha 203, Sentinela 86); 2 133 caíram para 1 casa; 0 forçadas |
| H13 | previsão de 1 casa bloqueada → perseguição (todo modo) | 17 492 repetições; 0 interceptações |
| H14 | previsão atrás de parede nunca é andável (labirinto fechado e aberto) | 10 671 previsões contra parede: 0; 137 pela passagem aberta |
| H15–H17 | o Caçador nunca entra em armadilha armada, na Sentinela, no portal | 13 219 planos; 0 movimentos ou alvos ilegais; 0 posições reais ilegais |
| H18 | no máximo uma casa, legal; captura só por movimento real | 949 escolhas; 37 capturas, 0 por interceptação; 0 estados inválidos |
| H19 | ordem fixa dos movimentos; perguntar não sorteia | 13 219 planos, 2 670 empates; 0 respostas diferentes, 0 sorteios |
| H20 | o hook sorteia só no empate e usa o sorteado | 801 turnos de movimento único (0 sorteios), 148 empates (1 sorteio cada) |
| H21 | o suporte do solver estático contém toda saída da produção | 7 110 turnos (477 de interceptação); 0 fora |
| H22 | o suporte do solver dinâmico contém toda saída; = oráculo | 13 206 turnos, 36 474 pares; 0 fora, 0 discordâncias; 1 137 pares cujo suporte a política mudou |
| H23 | `d` codificado e decodificado exatamente | 5 valores, 400 estados; 0 colisões; inválidos (−1, 5, 1,5) recusados |
| H24 | a direção do próximo estado é a do passo dado | 6 762 sucessores; 723 passos ilegais sem sucessor |
| H25 | Rota 1: mapas e desfechos iguais à base | 36 partidas, 2 818 renders; 0 diferenças |
| H26 | o plano usa o labirinto atual (parede aberta pela armadilha) | 391 interceptações depois da abertura, 86 em que ela muda o plano; 0 no plano velho |
| H27 | Caçador antes da Sentinela; Sentinela idêntica à base | 14 846 turnos; 20 000 decisões reavaliadas na base, 0 diferenças |
| H28 | requisitos do portal inalterados | 15 160 estados, 0 divergências, 0 ativações duplas |
| H29 | reinício, troca de modo e próxima Rota esquecem a direção | 4 sessões (memória não nula antes, `null` depois; 1º passo não adapta) |
| H30 | nenhuma ação/evento novo; só o campo aprovado | 12 ações, 14 eventos, +`lastExplorerDirection` |
| H31 | sem cronômetro, sem pontuação, sem recompensa nova | 0 chamadas de tempo; pontuação e recompensas inalteradas |
| H32 | os solvers chamam o módulo da produção; nenhuma cópia | dinâmico 150/150, estático 55/55 chamadas ao módulo; 0 arquivos de produção importando `tools/` |

### 6.2 Contrafactual e mutantes

- `--rev=ec3e564` (a base exata): os **23** checks `[adaptive]` falham e os
  **9** `[preserved]` valem (`ROTA2_ADAPTIVE_HUNTER_COUNTERFACTUAL_HOLDS`).
  Nenhum passa por vacuidade: H13/H18 exigem que o ramo tenha rodado (o módulo
  respondeu com planos e o hook escolheu entre movimentos de interceptação).
- ⟨MUTANTS-TBD⟩

### 6.3 Censo (`rota2-adaptive-hunter-census.mjs`) — 9/9

1080 mapas (3 Rotas × 3 modos × 120) e as partidas do hook real nas duas
árvores (esta e `ec3e564`), com quatro políticas roteirizadas (reta, que vira,
que vai à armadilha ligada, mista com recompensas).

| | check | medido |
| --- | --- | --- |
| A1 | geração idêntica à base | 1080/1080 mapas e seus sorteios |
| B1 | Rota 1 idêntica à base | **360 partidas**, 20 185 renders, 19 465 turnos, 31 078 sorteios do Caçador: 0 diferenças em render, evento, sorteio, mensagem ou resultado |
| C1 | todo turno real no suporte do oráculo e dos dois solvers; oráculo = solver dinâmico | 240 244 turnos (14 549 de interceptação), 143 375 no estático; 0 fora; 666 955 pares, 0 discordâncias |
| C2 | interceptação do contrato, uma casa legal, nunca captura; mensagem só quando moveu | **15 934** interceptações; 0 capturas, 0 ilegais, 0 mensagens erradas; 2 713 movimentos que a perseguição não faria |
| C3 | toda situação nomeada pela missão observada | 21 categorias (lista abaixo) |
| C4 | reinício, troca de modo e próxima Rota esquecem a direção | 24 sequências; 0 interceptações no 1º passo de uma sessão nova |
| C5 | nenhum estado inválido ou sem solução enquanto se joga | 0 nas duas árvores |
| D1 | o quociente exato da Rota 1 é o grafo da base | 24/24 mapas, estado por estado e rótulo |
| D2 | mapa no limite de recursos continua INCONCLUSIVO | 19 linhas no limite, todas `I` |

Cobertura (C3): direção repetida 83 483 · mudança 170 087 · previsão de 1 casa
11 041 · de 2 casas 4 908 · 2 casas bloqueadas (Difícil) 6 116 · previsão
bloqueada 4 539 · atrás de parede fechada 20 591 · na topologia aberta 1 434 ·
Caçador vizinho da previsão 1 251 · mais longe 14 698 · empates 2 196 · nenhum
movimento de interceptação 26 379 · fallback para a perseguição 51 499 ·
armadilha + parede no mesmo turno 1 657 · repetição no turno em que a parede
abriu 804 · portal ativado 594 · captura 934 · Segunda Chance 37 · sequências
de reinício/continuação 24.

**Quando a interceptação acontece** (passos / repetições / interceptações):

| | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| Rota 1 | 25 057 / 6 269 / **0** | 13 356 / 3 786 / **0** | 22 727 / 5 980 / **0** |
| Rota 2 | 40 160 / 15 137 / 123 | 28 651 / 9 174 / 4 023 | 34 283 / 10 440 / 4 117 (2 281 de 2 casas) |
| Rota 3 | 39 404 / 15 353 / 114 | 20 954 / 6 871 / 3 333 | 32 218 / 10 473 / 4 239 (2 627 de 2 casas) |

No Fácil a interceptação é rara (< 1 % das repetições): ela exige que o Caçador,
sem estar ao lado do Explorador, esteja ao lado da casa prevista. É o contrato
("só quando alcança com um movimento"); se o Fácil deve ser perceptivelmente
adaptativo é pergunta de playtest (§8).

**Sorteios do Caçador por passo** (base → missão): Rota 1 idêntica (2,164 /
1,922 / 1,110); Rota 2 2,261 → 2,258 · 1,983 → 1,725 · 1,195 → 1,061; Rota 3
2,255 → 2,247 · 1,968 → 1,674 · 1,193 → 1,041. Cai porque uma interceptação de
movimento único não sorteia; nenhum sorteio novo aparece fora de um empate
(H20). A geração não sorteia diferente (A1).

**Desfechos das políticas roteirizadas** (não são jogadores; 400 partidas por
célula nas Rotas 2/3, 280 na Rota 1): Rota 1 idêntica. Captura, base → missão:
R2 15,5 → 15,3 % · 36,8 → 41,8 % · 15,5 → 15,5 %; R3 19,3 → 20,8 % · 59,5 →
62,8 % · 16,0 → 20,5 % (Fácil · Médio · Difícil). Vitória: R2 18,8 → 19,0 % ·
8,0 → 6,3 % · 3,8 → 1,5 %; R3 15,0 → 13,8 % · 2,8 → 2,5 % · 2,5 → 1,8 %. O
Médio e o Difícil ficam um pouco mais duros para quem anda em linha reta; o
Fácil quase não muda.

### 6.4 Justiça

- **A interceptação nunca captura** (C2: 0 de 15 934; H18: 0 de 949) e nunca
  tira o último passo seguro: em 14 547/14 547 turnos de interceptação o
  Explorador tinha um passo seguro depois, mesmo contra todo movimento possível
  da perseguição (`withoutASafeStepUnderEveryPursuitMove` 0).
- Depois de uma interceptação, as políticas continuaram reto 10 161 vezes
  (13 077 casos em que continuar era seguro, 1 470 em que não era) e viraram
  4 254 vezes (14 481 casos em que virar era seguro): mudar de direção desfaz a
  previsão (H06: 0 interceptações em 6 624 mudanças).
- **Solucionabilidade exata pré-Baú** (72 mapas, 3 M estados por mapa, sem
  aumentar o limite): Rota 1 idêntica (24/24, inclusive estados explorados).
  Rotas 2/3: nenhum mapa passa a `U`; **R2 Difícil 9222003 P → G** (a
  interceptação de movimento único estreita as respostas do Caçador); 10 P → I
  e 3 G → I por limite de estados — continuam **INCONCLUSIVOS**, sem reclassificar.
  Base {P 46, U 4, G 16, I 6} → missão {P 35, U 4, G 14, I 19}.
- Nenhum estado sem solução durante o jogo (C5), nas duas árvores.

### 6.5 Espaço de estados

- A chave ganha `d` (raiz 5): a cardinalidade de raiz mista do exemplo vai de
  408 146 688 a 2 040 733 440 (×5, ainda `Number`-seguro).
- **Rota 1**: o quociente exato (estados que diferem só em `d` são bissimilares,
  porque o Caçador da Rota 1 não lê `d`) explora **exatamente** o grafo da base
  (D1, 24/24). Sem o quociente seriam 46,7 M estados contra 28,5 M (×1,64) e 8
  mapas bateriam no limite — por isso o quociente.
- **Rotas 2/3**: aqui `d` é lido, então não há quociente e o grafo cresce de
  verdade — tipicamente ×2, até ×5,2 (R3 Difícil 9232001: 61 764 → 322 531).
  A maior parte vem da representação: com `d` carregado e a política desligada
  (12 mapas) são 18,9 M estados contra 12,2 M na base (alguns no limite); a
  política acrescenta sobretudo no Difícil (R3 Difícil 9232000: 0,62 M só com
  `d`, 1,14 M com a política; R2 Fácil 9220000: 2,87 M nos dois). Nos 48 mapas,
  11,7 M transições interceptam, 8,8 M têm o suporte mudado pela política, e o
  módulo é chamado 305 M vezes. Mapas no limite de 3 M estados: base 6 →
  missão 19 (todos `I`; o limite não foi aumentado).

⟨SECTIONS-TBD⟩

## 9. Validadores anteriores que leem o delta aprovado

O que mudou nas ferramentas, e por quê (nenhum contrato enfraquecido):

- `route-module-loader.mjs` `treeBeforeRota2`: a cadeia — os hunks desta
  missão (`rota2-adaptive-hunter-edit.json`) primeiro, depois os da
  DEPENDENT-OBJECTIVES-02, depois os da DYNAMIC-TRAPS-01; os dois módulos
  acrescentados somem da visão. `rota2-dependent-objectives-edit.mjs` e
  `rota2-dynamic-traps-edit.mjs` conferem o próprio manifesto depois de reverter
  as missões mais novas. Os três manifestos revertem exatamente.
- `gameplay-platform-lock-v1.mjs`: a missão em `ROTA2_APPROVED_MISSIONS` (o
  campo `lastExplorerDirection`, o módulo, Rotas que adaptam {1: não, 2 e 3:
  sim}, horizontes {1, 1, 2}); R4/D4 aceitam exatamente esse campo; R6 novo
  (módulo de interceptação puro, plano aprovado, avaliado com os imports reais);
  5 mutantes novos; a âncora do mutante dos objetivos acompanha o campo novo.
- Solvers: `d` na chave empacotada dos dois solvers (raiz 5), no canônico, no
  numérico, no pack/unpack, na validação, nos sucessores e no estado inicial;
  o decodificador compartilhado `decodePackedKey`; o quociente exato de `d` onde
  o Caçador não lê a direção (Rota 1). Contexto com `routeNumber` e `intercept`
  (o módulo da produção; `null` = a perseguição de antes).
- O oráculo composto (`oracleSuccessors`) pergunta ao módulo como o
  `runDefenderPhase` pergunta (paredes do turno, armadilhas armadas + Sentinela
  bloqueadas) e devolve `statesD`.
- `rota2-sentinel-solver-fidelity-tests.mjs`: pares com `d` nas Rotas ≥ 2; o
  solver estático compara na Rota 1; S10c/S11 ("o hook não é desta missão")
  leem a árvore com exatamente os hunks desta missão revertidos (W0); S12 aceita
  o delta aprovado depois (`reverseAdaptive`). O censo da fidelidade faz o
  mesmo e, contra solvers anteriores a esta missão, pula os turnos em que a
  produção interceptou (contados).
- `rota2-dynamic-traps-tests.mjs` / `-census.mjs` e
  `rota2-dependent-objectives-tests.mjs` / `-census.mjs`: contextos com a Rota e
  o módulo; as classes exatas desses censos continuam medidas com o modelo de
  perseguição de cada missão (o que elas mediram); T07 registra também as
  decisões de interceptação; O19 procura uma vitória na Rota 2; O23 passa por
  `reverseAdaptive`.
- `game-continuation-contract-tests.mjs` I1: os imports de runtime do hook e do
  estado incluem `route-hunter-intercept` numa árvore que o tem.
- `route-validation-coupling-gate.mjs`: `rota2-adaptive-hunter-edit.mjs` na
  lista (lê o manifesto, não o código).
