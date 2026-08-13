# Segunda Chance — decisão de desenho

§20 pede que a resolução espacial seja formalizada **antes** de implementar, que
as opções sejam comparadas, e que a mais simples que preserve estratégia seja
escolhida e documentada. Este é esse documento.

---

## 1. O que havia para reaproveitar: nada

A auditoria (`shield-to-chest-audit.md` §1.5) encontrou o achado central:

> `setShieldUsed(true)` **não é chamado em lugar nenhum do código**.

O escudo perdeu seu único consumidor (a penalidade de armadilha) em
ROTA-TRAPS-STRATEGY-01 e ficou sendo um colecionável sem efeito. Nunca houve
resolução espacial de captura ligada a ele.

```
SHIELD_LEGACY_SEMANTICS  = ABSORVE_UMA_PENALIDADE_DE_TRAP   (removida)
SHIELD_CURRENT_SEMANTICS = NENHUMA
```

Não existe código antigo de rollback, reposicionamento ou snapshot a reaproveitar.
A Segunda Chance parte do zero.

---

## 2. O problema, exatamente

Existem **quatro** momentos em que duas peças disputam uma célula, e eles não são
o mesmo problema:

| # | Quem entrou na célula de quem | Estado no instante |
|---|---|---|
| C1 | Explorer → Caçador | os defensores ainda **não** se moveram neste turno |
| C2 | Explorer → Sentinela | idem |
| C3 | Caçador → Explorer | o Sentinela ainda **não** decidiu |
| C4 | Sentinela → Explorer | o turno terminaria aqui |

Qualquer resolução tem de valer para os quatro. É aí que as opções óbvias
começam a falhar.

---

## 3. Opções avaliadas

### Opção A — "o defensor volta para a posição anterior"

Falha imediatamente em C1 e C2: quem se moveu foi o **Explorer**. O defensor
estava parado. Devolvê-lo à "posição anterior" é devolvê-lo à mesma célula, e a
sobreposição continua.

**Descartada:** não cobre metade dos casos.

### Opção B — "restaurar snapshot de ameaças"

Guardar as posições dos defensores do turno anterior e restaurá-las. Cobre C3/C4,
mas em C1/C2 não há nada a restaurar, e obriga a carregar um snapshot no estado —
mais memória para o solver e um campo a mais que pode divergir do tabuleiro.

**Descartada:** estado redundante (§11) sem cobrir C1/C2.

### Opção C — desfazer o turno inteiro

Simples de enunciar e trivialmente sem sobreposição. Mas é **incoerente com o
Baú**: se o jogador escolhe Segunda Chance no Baú e é capturado na retomada
daquele mesmo turno, "desfazer o turno" teria de desfazer também a abertura do
Baú e a própria escolha. Absurdo, e impossível de explicar.

**Descartada:** colide com a pausa de §12.

### Opção D — desfazer o movimento que causou a sobreposição ← **escolhida**

Quem entrou na célula do outro volta para a casa em que estava no **início deste
turno**, e o turno acaba ali.

```
C1 / C2  →  o passo do Explorer não é aplicado.
            Nada de posição, nada de luz coletada, nada de armadilha armada.
            Os defensores não chegaram a se mover.

C3 / C4  →  os DOIS defensores permanecem nas casas em que começaram o turno.
            O Explorer mantém o passo que já havia dado.
```

---

## 4. Por que "os dois defensores" em C3/C4

Parece generoso; é a única formulação que **não pode** produzir sobreposição.

Se em C4 apenas o Sentinela recuasse, ele voltaria para a casa em que começou o
turno — e o Caçador pode ter se movido para exatamente essa casa neste mesmo
turno (`chooseGuardianMove` não exclui a célula do Sentinela). Duas peças na
mesma célula.

Descartando os **dois** movimentos, cada peça volta para uma casa que só ela
ocupava. Uma cláusula a menos, e a prova fica trivial.

### Prova de ausência de sobreposição

No início do turno, Explorer, Caçador e Sentinela ocupam três células.

* **C1/C2** — o Explorer volta para a sua própria casa de início de turno. Os
  defensores não se moveram. Nenhuma peça mudou de lugar: o estado é o de início
  de turno, que era válido.
* **C3/C4** — os dois defensores voltam para as suas casas de início de turno,
  distintas entre si. O Explorer fica na célula nova. Essa célula nova é
  diferente das duas casas dos defensores — se fosse igual a alguma, C1 ou C2
  teria disparado antes e este ramo não seria alcançado. ∎

**Ressalva medida e registrada:** as três casas de início de turno são distintas
*entre Explorer e defensores*, mas Caçador e Sentinela **podem** já estar
compartilhando célula. Isso é uma condição **pré-existente** do engine —
`chooseGuardianMove` exclui o portal e as armadilhas armadas das células legais do
Caçador, nunca a do Sentinela, enquanto `decideSentinelMove` é protegido no
sentido inverso. Medido em jogo comum, **sem Baú, sem recompensa e sem parede
quebrada**: 23 de 1.466 turnos (~1,6%).

A resolução da Segunda Chance nem cria nem agrava essa condição — cada peça volta
para onde já estava. §38 proíbe mexer na política do Caçador nesta missão, então
a condição é medida e reportada, não escondida:
`second-chance-controlled-tests.json` → `preExistingEngineCondition`, e o teste S
verifica separadamente que **nenhuma sobreposição nova** é introduzida.

---

## 5. Contra os critérios de §20

| Critério | Como a opção D satisfaz |
|---|---|
| determinística | a casa de destino é um valor único já conhecido; não há busca, escolha nem RNG |
| legível | *"você resistiu e não avançou"* / *"os defensores recuaram"* |
| sem teleporte arbitrário | cada peça anda um passo de volta pelo caminho que acabou de fazer |
| sem duas entidades na mesma célula | provado acima |
| não cria turno duplicado | `turns` incrementa uma vez; o Explorer não ganha ação extra — perde a que gastou |
| não depende de render | estado puro; o renderer só desenha o resultado |
| solver-friendly | a transição é "não aplique o sub-passo"; um bit a mais no estado |
| fácil de explicar | *"a primeira captura da rota não te derrota: o golpe é desfeito e o turno acaba"* |

---

## 6. Por que o turno acaba ali

Alternativa considerada: em C1/C2, deixar os defensores responderem normalmente
depois do recuo do Explorer.

Isso tornaria a recompensa quase inútil: o Explorer tentou entrar na célula do
Caçador, logo está encostado nele; o Caçador simplesmente daria um passo e o
capturaria no mesmo turno — com a carga já gasta. O jogador leria isso como um
bug: *"disse que eu sobrevivi e eu morri no mesmo instante"*.

Terminar o turno é o que dá o que a recompensa promete: **o Explorer volta a
jogar com o tabuleiro na sua frente**, e como o Explorer move primeiro, ele tem
uma escolha real antes da próxima resposta.

---

## 7. O que ela não faz (§21)

Não funciona contra movimento bloqueado, contra armadilha, nem contra nada que
não seja captura. Armadilhas, aliás, não penalizam o Explorer desde
ROTA-TRAPS-STRATEGY-01 — não há o que absorver.

A segunda captura derrota normalmente.
