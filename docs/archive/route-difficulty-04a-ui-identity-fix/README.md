# ROTA-DIFFICULTY-04A — correção de identidade Route × Difficulty na UI

`ROTA-DIFFICULTY-04-BASELINE` mediu 120 de 270 tentativas resetando a Route em
silêncio. Esta missão encontra a causa, corrige com duas linhas, e prova que as
270 tentativas agora preservam a combinação pedida.

Também investiga **separadamente** o segundo achado do baseline — 0/270
fingerprints iguais entre UI e geração direta — e conclui que ele **não é o mesmo
problema** e **não é defeito**.

---

## Causa raiz

```
changeDifficulty(next):
    setDifficulty(next)
    setRouteNumber(1)                       ← removido
    startNewMaze(next, "setup", 1)          ← agora passa routeNumber
```

### Por que a linha existia

Não é código morto, nem workaround, nem regra de produto atual. É uma
**regressão latente introduzida por um follow-up incompleto**, e a data prova:

| Commit | Data | O que fez |
|---|---|---|
| `0d7e7fa` feat(route-strategy): add playable route progression | 2026-07-09 | criou `routeNumber`, sempre `useState(1)`. O hook **só podia montar na Rota 1**, então "voltar para 1" e "voltar para onde esta sessão começou" eram a mesma frase. `setRouteNumber(1)` estava **correto**. |
| `3bde618` feat(route-strategy): add route completion continuity loop | 2026-07-11 | adicionou `initialRouteNumber`, permitindo montar direto na Rota N. Atualizou o **inicializador** (`useState(normalizedInitialRouteNumber)`) e **não revisitou** `changeDifficulty`. |

A partir de `3bde618` o literal `1` deixou de ser uma constante correta e passou
a ser uma cópia velha de uma premissa que não valia mais.

### O fluxo que o jogador via

1. termina a Rota 1 → resultado → *"Jogar de novo"*;
2. `page.tsx#playAgain` remonta com `initialRouteNumber = 2`;
3. o hook monta em Rota 2, dificuldade `easy` (padrão de sessão);
4. a tela de setup mostra **"Rota 2"** e os três modos;
5. o jogador toca **Equilibrado** ou **Desafiador**;
6. `changeDifficulty` → `setRouteNumber(1)` → o jogador recebe a **Rota 1**.

Por isso as afetadas eram exatamente R2/R3 × medium/hard: a Rota 1 já era 1, e
`easy` já era o padrão (o jogador não precisava tocar em nada).

**4 combinações × 30 seeds = 120.** Confere com o baseline.

---

## Contrato de estado

### ANTES

| Evento | routeNumber | difficulty |
|---|---|---|
| mount (Home → mundo) | 1 | easy |
| mount (Jogar de novo) | N | easy |
| **changeDifficulty(d)** | **1 — sempre** | d |
| startGame / restartGame | inalterado | inalterado |
| continueJourney | N+1 | inalterado |

### DEPOIS

| Evento | routeNumber | difficulty |
|---|---|---|
| mount (Home → mundo) | 1 | easy |
| mount (Jogar de novo) | N | easy |
| **changeDifficulty(d)** | **preservado** | d |
| startGame / restartGame | inalterado | inalterado |
| continueJourney | N+1 | inalterado |

Regras explícitas:

* trocar o modo **não** muda a Rota;
* trocar de Rota **não** muda o modo (`continueJourney` preserva);
* restart preserva Rota e modo;
* remount preserva a Rota que a sessão recebeu;
* a geração recebe exatamente a Rota/modo que a UI apresenta;
* voltar à Rota 1 continua possível e continua **explícito**: é o que entrar no
  mundo pela Home faz (`openActivity` limpa `initialRouteNumber`).

---

## Resultados

`route-difficulty-identity.json` — `ROUTE_DIFFICULTY_IDENTITY_OK`

| Teste | Resultado |
|---|---|
| A — matriz 9 combinações | 9/9 identidade preservada · 9/9 mapa idêntico ao pedido · **0** falsos positivos nas outras 8 |
| B — os 120 casos anteriores | 270/270 preservadas · **0 resets** (baseline: 150 / 120) |
| C — transições | 10/10 |
| D — remount + reset explícito | 9/9 |
| E — geração recebe a combinação | 0 divergências geométricas |
| F — UI vs geração direta | 54/54 reproduzidas · classificação `EXPECTED_RNG_SEQUENCE_DIFFERENCE` |
| G — Rota 1 inalterada | 24/24 bit-idênticas ao baseline |

### Como a identidade é provada

O oráculo decisivo é **igualdade exata de mapa**, nos dois sentidos: replicar a
sequência de geração da UI para a combinação **pedida** reproduz o tabuleiro do
jogador, e replicá-la para qualquer uma das **outras oito** não reproduz.

Isso importa porque a leitura geométrica sozinha **não basta**, e a suíte diz
isso em vez de disfarçar: as etapas 2 e 3 compartilham candidatos de portal e
suas contagens de luz/trap colidem, então

```
S2/medium ≡ S3/easy        S2/hard ≡ S3/medium
```

são indistinguíveis olhando só para o tabuleiro. A verificação geométrica ficou
como conferência auxiliar; quem sustenta a matriz é a igualdade exata.

---

## UI vs geração direta — investigado à parte

**Classificação: `EXPECTED_RNG_SEQUENCE_DIFFERENCE`. Não é defeito.**

O baseline comparava o mapa final da UI contra **uma** chamada
`generateMaze(mode, route)` a partir da seed limpa. Não é o mesmo ponto do fluxo
de RNG — antes de o jogador ver qualquer tabuleiro, a UI já gerou outro(s):

```
easy         mount(easy, route) → Start(easy, route)                    2 chamadas
medium/hard  mount(easy, route) → changeDifficulty(mode, route)
                                → Start(mode, route)                     3 chamadas
geração direta                                                           1 chamada
```

Hipótese testada, não assumida: replicando **essa sequência exata** direto da
mesma seed, o mapa da UI é reproduzido byte a byte.

**54 de 54 reproduzidas. 0 de 54 iguais à chamada única.**

Ou seja: a UI pede a combinação certa; ela apenas desenha seu mapa mais adiante
no mesmo fluxo, porque a tela de setup gera um tabuleiro na montagem e outro na
seleção de modo. Identidade exata só seria exigível se Rota, modo, seed **e a
posição inicial do RNG** fossem equivalentes — e a última não é, por desenho.

Nada de RNG ou geração foi alterado para fazer os fingerprints coincidirem.

---

## Impacto nos mapas

| | |
|---|---|
| Rota 1 (qualquer modo) | **bit-idêntica** ao baseline — na Rota 1 a função antiga e a nova são a mesma chamada (teste G, 24/24) |
| R2/R3 × easy | inalteradas — `changeDifficulty` não era chamado |
| R2/R3 × medium/hard | **mudam, e é o ponto**: antes geravam a Rota 1; agora geram a Rota pedida |

Isso não é rebalanceamento. Nenhum valor de dificuldade, política de Hunter ou
Sentinela, parâmetro de RNG, wall, trap, light, portal, Chest, Pickaxe ou Second
Chance foi tocado.

---

## Regressões

| Suíte | Veredito |
|---|---|
| `chest-controlled-tests` | `CHEST_CONTRACT_OK` |
| `pickaxe-controlled-tests` | `PICKAXE_CONTRACT_OK` |
| `second-chance-controlled-tests` | `SECOND_CHANCE_CONTRACT_OK` |
| `chest-runtime-gameplay` | `RUNTIME_GAMEPLAY_OK` |
| `chest-static-render-audit` | `STATIC_RENDER_AUDIT_OK` |
| `difficulty-baseline-tests` | `DIFFICULTY_BASELINE_TESTS_OK` |

Sentinela 648 estados / 0 divergências · Caçador 648 / 0 · armadilhas intactas ·
portal e luzes intactos · 9 combinações sem crash · **3 Babylon lights**.

### Dois testes precisaram mudar, e por quê

**1. `difficulty-baseline-tests.mjs` fixava o defeito.**
Ele afirmava `routeResetCount === 4` e listava as 4 combinações afetadas — o que
era correto para um baseline registrar, e passa a ser errado assim que a causa é
corrigida. As asserções agora fixam o **contrato**: 0 resets, 0 combinações
afetadas, e todas as amostras preservadas. A asserção
`directIdentityMatches === 0` **permanece**, agora com a explicação de que é
esperada.

**2. `chest-runtime-gameplay` tinha um gate estatisticamente insustentável.**
`defenderUsedTheOpening > 0` era exigido de uma varredura com 7 quebras. Medido:
6 acertos em 81 quebras roteirizadas (~7%), e **um terço das quebras caía em
paredes de grau 1**, onde o evento é impossível — não há "outro lado" para o
Explorer ocupar. A esperança por varredura ficava abaixo de 1: o gate vinha
passando por sorte.

Duas correções, ambas na ferramenta:

* a varredura agora prefere paredes com **dois lados** para o cenário de
  travessia (propriedade física da abertura, não a regra do certificador
  aposentado — a rotação continua percorrendo a lista inteira e
  `wallWasInOldCertifiedSet` continua registrado);
* a sonda parou de oscilar **sobre** a abertura — ela estava colocando o Explorer
  exatamente na célula que esperava ver um defensor ocupar, bloqueando o que
  media.

O número passou a ser reportado e **deixou de ser gate**. A propriedade não ficou
sem prova: quem a garante é `pickaxe-controlled-tests` testes K e L, com busca
dedicada por testemunha (161 execuções, 5 ocupações, além da testemunha de mesmo
turno). Um gate que passa por sorte é pior que nenhum — ensina a re-rodar até
ficar verde.

---

## Achado adicional, não corrigido

**Dificuldade não sobrevive ao remount.**

`page.tsx#playAgain` passa `initialRouteNumber` mas **não** passa a dificuldade,
e o hook inicializa `useState<DifficultyLevel>("easy")`. Quem terminou a Rota 1
no Desafiador e clica *"Jogar de novo"* recebe a Rota 2 com **Aberto**
pré-selecionado.

Não corrigido aqui, deliberadamente:

* o defeito relatado e os 120 casos são sobre **Route**, e a missão pede a menor
  correção de produção correta;
* não existe plumbing de dificuldade em nenhum ponto do produto — adicionar um
  é decisão de produto, não correção de identidade;
* o caminho **dentro** do jogo (`continueJourney`, *"Explorar próxima rota"*)
  **já preserva** a dificuldade. A inconsistência é entre os dois caminhos de
  "próxima rota", não dentro do hook.

```
SESSION_DEFAULT_DIFFICULTY = easy
DIFFICULTY_NOT_PERSISTED_ACROSS_REMOUNT_FOLLOWUP_REQUIRED = true
```

---

## Reproduzir

```bash
node tools/validation/route-difficulty-identity-tests.mjs
```
```bash
node tools/validation/difficulty-baseline-tests.mjs
```
```bash
node tools/validation/chest-runtime-gameplay.mjs
```

O `difficulty-baseline.json` (2,1 MB) do baseline **não foi regravado**: ele é a
evidência do "antes". A suíte nova replica as mesmas seeds e reporta os dois
números lado a lado.
