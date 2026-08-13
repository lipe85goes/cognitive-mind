# Contrato da escolha de recompensa

Testes: `chest-controlled-tests.json` → D, E, F.

---

## 1. As duas opções da v1

```
REWARD_OPTIONS_V1 = [PICKAXE, SECOND_CHANCE]
```

Exatamente duas. Não há terceira nesta versão, e nenhuma foi inventada para
contornar um problema (§9).

| | Picareta | Segunda Chance |
|---|---|---|
| Frase para o jogador | *"Abra uma parede do labirinto. Só uma."* | *"Sobreviva a uma captura."* |
| A pergunta que faz | "posso mudar a topologia" | "posso assumir um risco maior" |
| Quantidade | 1 uso | 1 carga |
| Conversa com | paredes, acessos, portal, Caçador, Sentinela | Caçador, Sentinela |

O tipo é um slot único:

```ts
export type ChestReward = "pickaxe" | "second-chance";
rewardSelected: ChestReward | null
```

Ter uma é, literalmente, não ter a outra. `NO_DOUBLE_REWARD` não é uma regra
vigiada — é o formato do dado.

---

## 2. Sem RNG (§13, §43)

`chooseReward(reward)` recebe a escolha do jogador. Não há sorteio, peso,
raridade nem sequência. As duas opções são sempre as mesmas e sempre ambas
oferecidas.

Verificável por leitura: não existe `Math.random()` em nenhum caminho entre
abrir o Baú e possuir uma recompensa.

Isso é o que torna a escolha modelável como um **branching OR do Explorer** no
Solver 02:

```
CHEST_OPENED  →  PICKAXE
              |  SECOND_CHANCE
```

Dois sucessores, ambos sob controle do jogador.

---

## 3. Quando a escolha existe

`rewardChoicePending = chestOpened && rewardSelected === null`.

* Só existe depois que o Explorer entra validamente na célula do Baú.
* Enquanto existe, **nenhuma** outra ação é aceita: nem passo, nem quebra, nem
  teclado, nem D-pad, nem toque no tabuleiro.
* Nenhum defensor decide nada.
* Escolher não gasta um turno; o turno pausado retoma (ver `chest-turn-order.md`).

Uma vez escolhida, a outra deixa de existir naquela partida. Não há troca.

---

## 4. A recompensa vale já no turno em que foi escolhida

Se o jogador escolhe **Segunda Chance** e o Caçador o alcança na retomada
daquele mesmo turno, a carga o protege. É a leitura direta de "primeira captura
válida consome a carga" (§21) — a carga existe a partir do instante da escolha,
não a partir do turno seguinte.

Se escolhe **Picareta**, ela fica disponível imediatamente; o que ela ainda exige
é estar ao lado da parede que o jogador decidir abrir, o que custa passos — e a
decisão de *qual* é a mecânica inteira
([`pickaxe-free-wall-choice-contract.md`](pickaxe-free-wall-choice-contract.md)).

---

## 5. UI

Duas cartas, um título e uma linha cada. Ocupam o lugar do D-pad enquanto a
escolha está aberta — que é onde o jogador já está olhando e, ao mesmo tempo,
uma afirmação de que nada mais pode acontecer agora.

Não expõe algoritmo, não lista efeitos, não abre inventário. Depois da escolha,
o estado vive num único token de HUD:

```
No mapa → Escolha → Picareta / 2ª Chance → Picareta usada / 2ª Chance usada
```

---

## 6. Reset

`restart`, derrota/retry, próxima Rota, troca de modo, Home → Rota e nova sessão
devolvem `rewardSelected = null`. Uma recompensa **nunca** atravessa partidas
(§21). Verificado em `chest-controlled-tests.json` → H.
