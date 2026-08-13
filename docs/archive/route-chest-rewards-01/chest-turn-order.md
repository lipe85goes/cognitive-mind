# Ordem do turno com o Baú

O contrato de §12, escrito como o runtime o executa.

Antes desta missão existia exatamente **uma** ação do Explorer: mover. O Baú
introduz a primeira pausa e a Picareta a primeira ação que não é um passo.

---

## 1. Turno normal (sem Baú, sem Picareta)

```
tryMovePlayer(delta)
 1. status === "playing"?                      não → nada acontece
 2. rewardChoicePending?                       sim → nada acontece   (§12.5)
 3. janela anti-duplo-disparo (150 ms)
 4. destino fora do tabuleiro ou parede?       sim → bloqueio, NÃO consome turno
 5. destino é um defensor?                     sim → captura  (ver §3 abaixo)
 6. turns += 1; Explorer move; luz coletada; armadilha armada
 7. portal + todas as luzes?                   sim → vitória, turno acaba
 8. FASE DOS DEFENSORES
      8a. Caçador decide (paredes atuais + armadilhas armadas neste turno)
      8b. Caçador alcançou o Explorer?          sim → captura
      8c. Sentinela decide, sobre o estado que o Caçador já produziu
      8d. Sentinela colidiu com o Caçador?      sim → Sentinela fica parado
      8e. Sentinela alcançou o Explorer?        sim → captura
 9. mensagem
```

O passo 8 é uma função única — `runDefenderPhase` — usada pelos **três** pontos
onde um turno pode terminar. Não existe uma segunda cópia da resposta dos
defensores.

---

## 2. Turno em que o Baú abre

```
tryMovePlayer(delta) até o passo 6 …
 7. célula é o Baú e o Baú está fechado?
      chestOpened = true
      mensagem: "Baú encontrado. Escolha a sua ferramenta."
      ==== O TURNO PARA AQUI ====
      A fase dos defensores NÃO roda.
```

Enquanto `rewardChoicePending`:

* `tryMovePlayer` retorna imediatamente;
* `breakWall` retorna imediatamente;
* o teclado e o D-pad passam pelos mesmos guardas;
* nenhum defensor decide nada.

Depois:

```
chooseReward(reward)
 1. rewardChoicePending?                       não → nada acontece
 2. rewardSelected = reward
 3. FASE DOS DEFENSORES  ← o MESMO turno continua, do ponto em que parou
      Caçador; captura; Sentinela; captura
```

`turns` **não** incrementa em `chooseReward`. O turno é o mesmo — ele foi
suspenso, não dividido.

Consequências, que são o motivo do desenho:

| Não existe | Porque |
|---|---|
| corrida entre UI e runtime | a fase dos defensores é chamada **pela** escolha, não em paralelo |
| defensor andando com o modal aberto | a fase simplesmente não foi chamada ainda |
| turno escondido | `turns` incrementa uma vez, no passo 6, e nunca em `chooseReward` |

Verificado em `chest-controlled-tests.json` → teste **C (CHOICE_PAUSE)**:
posições dos defensores idênticas às do passo anterior enquanto a escolha está
aberta, `turns` idêntico antes e depois de escolher, e — para que "ninguém se
moveu" não seja verdade por vacuidade — pelo menos um defensor observado se
movendo imediatamente após a escolha.

---

## 3. Captura, com e sem Segunda Chance

Há quatro momentos em que duas peças disputam uma célula:

| # | Quem entrou | Quando |
|---|---|---|
| C1 | Explorer → Caçador | passo 5 |
| C2 | Explorer → Sentinela | passo 5 |
| C3 | Caçador → Explorer | passo 8b |
| C4 | Sentinela → Explorer | passo 8e |

**Sem carga:** `endGame(false)`. Em C1/C2 o passo é commitado antes, para que o
jogador veja onde aconteceu.

**Com Segunda Chance disponível:** o movimento que causou a sobreposição é
desfeito e o turno **acaba ali**.

```
C1 / C2 → o passo do Explorer não é aplicado: nada de posição, nada de luz,
          nada de armadilha. Os defensores não chegaram a se mover.
C3 / C4 → os DOIS defensores permanecem nas casas em que começaram o turno.
          O Explorer mantém o passo que já havia dado.
```

Em todos os casos: `turns` incrementa, `rewardSpent = true`, e a fase dos
defensores não continua.

Ver `second-chance-design.md` para por que a resolução é esta e não outra.

---

## 4. Turno da Picareta

```
breakWall(wall)
 1. status playing, sem escolha pendente, Picareta disponível
 2. wall é uma parede interna real, ainda de pé, ortogonalmente adjacente
 3. brokenWall = wall;  rewardSpent = true;  turns += 1
 4. o Explorer NÃO se move
 5. FASE DOS DEFENSORES com o tabuleiro JÁ ABERTO
```

> **Revisão pós-playtest.** O passo 2 dizia "parede CERTIFICADA". A Picareta agora
> abre qualquer parede interna adjacente — os guards continuam sendo exatamente
> os mesmos três (existe, está de pé, está ao lado), apenas sem a consulta a um
> conjunto marcado. A ordem do turno não mudou em nada.

O passo 5 recebe o conjunto de paredes sem a célula quebrada. Não é uma cópia
"para o jogador": é o mesmo conjunto que o Explorer, o Caçador e o Sentinela
consultam. A zona do Sentinela é recomputada sobre esse tabuleiro no mesmo
turno.

Não é possível quebrar **e** atravessar no mesmo input: o passo 4 é explícito.

Verificado em `pickaxe-controlled-tests.json` → **K (BREAK_TURN)** e
**L (SAME_TURN_TOPOLOGY)**.

---

## 5. Por que a fase dos defensores recebe tudo por parâmetro

`runDefenderPhase` não lê `useState`. Ela recebe posição do Explorer, paredes,
zona, armadilhas armadas, número do turno e o estado do Baú.

Motivo: dos três pontos que a chamam, **dois** precisam responder a um estado que
o React ainda não commitou —

* no passo normal, a armadilha acaba de ser armada e o `setState` chegaria um
  turno atrasado;
* na quebra, a parede acabou de abrir e o `useMemo` das paredes só recomputa no
  próximo render.

Passar explicitamente é o que garante que os defensores respondam ao tabuleiro
**deste** turno, e não ao do anterior.
