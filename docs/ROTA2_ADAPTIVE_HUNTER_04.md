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

⟨SECTIONS-TBD⟩
