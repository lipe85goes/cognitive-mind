# Contrato de runtime da Picareta

Fonte: `useEscapeMaze.ts` → `breakWall`.
Testes: `pickaxe-controlled-tests.json` (A–N, BAD_CHOICE, DEFENDER_BENEFIT).

> **Revisão pós-playtest.** A versão original deste documento dizia
> `PICKAXE_BREAKS_ONLY_CERTIFIED_WALLS = true`. Isso deixou de valer: a Picareta
> abre **qualquer parede interna** adjacente. A decisão, a cronologia e o
> raciocínio estão em
> [`pickaxe-free-wall-choice-contract.md`](pickaxe-free-wall-choice-contract.md);
> as seções abaixo descrevem o comportamento **vigente**.

---

## 1. O que ela pode abrir

```
PICKAXE_USES   = 1
PICKAXE_TARGET = ANY_INTERNAL_MAZE_WALL
```

`breakWall(wall)` só age quando **todas** valem:

| Guarda | Motivo |
|---|---|
| `status === "playing"` | |
| `!rewardChoicePending` | §12 — nada acontece com o Baú aberto |
| `pickaxeAvailable` | recompensa escolhida e ainda não gasta |
| dentro de `0..8 × 0..8` | não existe parede fora da grade lógica |
| `walls.has(wall)` | é parede real do labirinto, ainda de pé |
| `manhattanDistance(wall, player) === 1` | §16 — o Explorer está encostado nela |

Todos os guards são **físicos**. Não existe nenhum que pergunte se abrir aquela
parede é uma boa ideia — nem `rewardEligibility(wall)`, nem checagem de rota, nem
consulta ao certificador aposentado. Escolher mal é permitido.

Qualquer guard que falhe → **nada acontece**: sem turno, sem consumo, sem
mensagem de erro. Uma tentativa inválida não é um evento de jogo.

Portanto não quebra: parede remota, borda/frame do tabuleiro, portal, baú,
armadilha, luz, nenhuma das três peças, nem parede já aberta. Todas essas
exclusões são consequência de `walls.has(wall)` — portal, baú, armadilha, luz e
peças vivem em células **andáveis**, e o frame não pertence à grade 9×9.

---

## 2. Não é consumida por acidente (§10/§18)

Andar contra uma parede — qualquer parede — é um movimento bloqueado comum:
conta em `blockedMoves`, treme, toca o tom de erro, **não** gasta a Picareta e
**não** consome turno.

A única concessão é a mensagem, que aponta para a ação sem recomendá-la:

> *"Parede no caminho. A Picareta pode abri-la."*

Quebrar exige a ação contextual explícita.

---

## 3. A ação

```
breakWall(wall):
  brokenWall  = wall
  rewardSpent = true
  turns      += 1
  Explorer NÃO se move
  som curto de pedra
  → fase dos defensores, com o tabuleiro JÁ ABERTO
```

Cinco propriedades, cada uma testada:

1. **custa um turno** — `turns + 1` (J)
2. **o Explorer permanece na célula** — posição idêntica (J)
3. **a parede abre antes da resposta dos defensores** — a fase recebe o conjunto
   já sem a célula (K)
4. **um uso** — `rewardSpent = true`; uma segunda chamada em **qualquer** parede
   ainda de pé não faz nada (C)
5. **quebrar e atravessar são dois inputs** — atravessar custa o turno seguinte (J)

---

## 4. A abertura é física (§15)

```
BROKEN_WALL_WALKABLE_BY_ALL = true
```

`walls` é o único conjunto que responde "isto é andável?" — para
`tryMovePlayer`, para `chooseGuardianMove`, para `decideSentinelMove`, para a
zona do portal, para a pré-visualização de movimento e para o render. Remover a
chave dele abre a célula para todos, ao mesmo tempo, pela mesma linha de código.

Não existe um caminho "só do jogador". Isso é o trade-off, e ele é desejado: a
Picareta pode abrir uma fuga para o Explorer e, na mesma jogada, uma entrada para
os defensores.

**Prova (teste K).** Os tabuleiros fechado e aberto diferem em exatamente uma
célula. Um defensor **parado sobre a célula quebrada** ao fim do turno da quebra é
portanto um passo que o tabuleiro fechado não poderia ter produzido. A campanha
observa esse caso.

E o teste `DEFENDER_BENEFIT` (§29) confirma o outro lado: aberturas que encurtam
o caminho do Caçador até o Explorer são permitidas e não são silenciosamente
bloqueadas. Não existe proteção invisível.

O Sentinela recalcula a zona do portal sobre o novo tabuleiro **no mesmo turno**,
sem perder o contrato territorial: `commitTurns = 3`, leash, e nunca sobre o
portal (`chest-runtime-gameplay.json` → REG-SENTINEL).

O Caçador continua com a política de sempre; ele só passa a ter uma célula legal
a mais (§38, REG-HUNTER: 648 estados, 0 divergências).

---

## 5. O tabuleiro inteiro, uma quebra (§11, §15, §27 I)

Todas as paredes internas são alvos. A Picareta abre **uma**.

Isso é a decisão inteira: não *se* quebro, mas *qual* — entre todas as paredes
do labirinto, ao longo de toda a rota. Depois da primeira,
`pickaxeAvailable = false` e nenhuma outra pode ser aberta, ainda que existam
dezenas.

Interação:

* **Desktop** — `Enter` quando existe exatamente **uma** parede ao alcance. Com
  duas ou mais a escolha é real e pertence aos botões, que são focáveis por
  `Tab`; o teclado nunca adivinha qual o jogador quis dizer.
* **Mobile e desktop** — um botão por parede adjacente, **sempre** nomeado pela
  direção (`acima`, `abaixo`, `à esquerda`, `à direita`). Aparece só enquanto a
  ação existe; some quando a Picareta é gasta.
* **Mira** — apontar para um botão acende aquela parede no tabuleiro com um anel
  mais forte. Informação de controle (*qual vai abrir*), nunca estratégica
  (*qual convém abrir*) — §16.

Sem painel, sem inventário (§17/§18).

---

## 6. Reset (§19)

Broken walls valem para **aquela partida**. `startNewMaze` devolve
`brokenWall = null`, e restart / derrota / próxima Rota / troca de modo /
Home → Rota / nova sessão passam por ele.

A definição do mapa nunca é escrita: `breakWall` grava apenas `brokenWall`.
Verificado remontando a mesma seed depois de uma quebra — o gerador produz o
mesmo conjunto de paredes (teste N).
