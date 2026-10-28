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

⟨SECTIONS-TBD⟩
