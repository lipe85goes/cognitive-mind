# Contrato de runtime da Segunda Chance

Desenho e justificativa: `second-chance-design.md`.
Testes: `second-chance-controlled-tests.json` (P–T).

---

## 1. Contrato mínimo (§21)

```
SECOND_CHANCE_CHARGES = 1
```

* uma carga;
* funciona contra o Caçador;
* funciona contra o Sentinela;
* a primeira captura válida consome a carga;
* o Explorer não perde a partida naquela captura;
* a segunda captura derrota normalmente;
* restart restaura a escolha do Baú — a carga nunca atravessa partidas.

Não funciona contra movimento bloqueado, contra armadilha, nem contra qualquer
coisa que não seja captura.

Nomenclatura: `SECOND_CHANCE`. O escudo não volta em estado, HUD nem texto (§22).

---

## 2. Resolução

> A peça que entrou na célula da outra **desfaz o seu movimento deste turno**;
> quando quem invadiu foi um defensor, **os dois defensores** voltam às casas em
> que começaram o turno. A carga é consumida e o turno termina ali.

```
C1  Explorer → Caçador     ┐  o passo do Explorer não é aplicado
C2  Explorer → Sentinela   ┘  (posição, luz e armadilha ficam como estavam)

C3  Caçador → Explorer     ┐  os dois defensores ficam nas casas de início de turno
C4  Sentinela → Explorer   ┘  o Explorer mantém o passo que já deu
```

Em todos os casos: `turns += 1`, `rewardSpent = true`, e a fase dos defensores
não continua.

Implementação: `runDefenderPhase` simplesmente **não commita** os movimentos que
calculou. Não há código de rollback, porque não há o que desfazer — o estado
nunca foi escrito.

---

## 3. Mensagens

| Situação | Texto |
|---|---|
| C1 / C2 | *"Segunda Chance: você resistiu e não avançou."* |
| C3 / C4 | *"Segunda Chance: você resistiu e os defensores recuaram."* |

Duas frases distintas porque as duas situações são visivelmente diferentes no
tabuleiro. O HUD passa de `2ª Chance` para `2ª Chance usada` no mesmo instante,
de modo que "acabou" é legível sem ler a mensagem (§48).

---

## 4. Cobertura medida

`second-chance-controlled-tests.json`, 3 combinações × várias seeds:

| Teste | Resultado |
|---|---|
| P — HUNTER_CAPTURE | 13 capturas; todas sobreviveram, carga consumida, turno contado |
| Q — SENTINEL_CAPTURE | 6 capturas; mesmo contrato |
| R — SECOND_CAPTURE | segunda captura derrota, `won = false`, um `onComplete` |
| S — NO_OVERLAP | 19 ativações; 0 sobreposições introduzidas pela resolução |
| T — DETERMINISTIC_RESOLUTION | mesma seed e mesmo roteiro → estado final byte a byte idêntico |

Ambas as direções são provocadas de propósito: 12 capturas em que o Explorer
entrou no defensor, 7 em que o defensor entrou no Explorer.

---

## 5. A condição pré-existente que este contrato **não** resolve

Caçador e Sentinela podem compartilhar célula. Causa:
`chooseGuardianMove` exclui o portal e as armadilhas armadas das células legais
do Caçador, nunca a do Sentinela — enquanto `decideSentinelMove` tem a proteção
no sentido inverso (`sentinelBlocked`).

Medido em jogo comum, sem Baú, sem recompensa e sem parede quebrada:
**23 de 1.466 turnos (~1,6%)**.

* Não é introduzida por esta missão.
* A resolução da Segunda Chance não a cria nem a agrava: cada peça volta para a
  casa que já ocupava.
* §38 proíbe alterar a política do Caçador nesta missão, então fica **registrada,
  não corrigida**.

O teste S mede as duas coisas separadamente: sobreposição do Explorer com
qualquer defensor (0) e sobreposições **novas** criadas pela resolução (0).

Encaminhamento sugerido para depois da aprovação humana: tratar como item próprio,
junto de `MAP REPAIR / FINAL MAP AUDIT`, já que mexer nas células legais do
Caçador muda a política dele e exige a sua própria regressão.

---

## 6. Modelagem para o Solver 02

Um bit (`rewardSpent`, quando `rewardSelected === "second-chance"`).

A transição é a mesma função sucessora de sempre, com uma guarda: se o sucessor
colocaria duas peças na mesma célula e a carga existe, o sucessor é o estado de
início de turno com a carga gasta e o contador de turno incrementado.

Determinística, sem RNG, sem busca.
