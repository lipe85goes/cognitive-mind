# Geometria de fuga do portal

Por que alguns candidatos são impossíveis antes de existirem, e como o gerador
passou a perceber isso cedo.

## Célula admissível

`routeCellsHaveEscape` julga uma rota, mas **todas** as suas condições dependem
só das paredes. Logo a admissibilidade é propriedade do tabuleiro, não da rota:

```
ADMISSÍVEL(célula) =
    célula é o início                                  → sim, sempre
  senão se grau < 2                                    → não
  senão se célula é o portal                           → sim
  senão se está na convergência e grau < 3             → não
  senão se não partilha bloco biconexo com o Explorador→ não
  senão                                                → sim
```

Convergência = distância BFS ≤ 3 do portal. As duas isenções — Explorador e
portal — são exatamente as que o gate faz.

`admissibleRouteCells` produz esse conjunto. É o mesmo conjunto usado pela
seleção de rota e pela rejeição antecipada, então as duas correções desta missão
partem de uma definição única.

> **Acoplamento registrado.** O raio 3 aparece literalmente em
> `routeCellsHaveEscape` e em `admissibleRouteCells`. A missão proibia tocar na
> primeira, então o número está duplicado de propósito em vez de extraído para
> uma constante compartilhada. O que impede a deriva é o teste de equivalência
> abaixo, que compara a derivação contra o gate real e falha na primeira
> divergência. Vale unificar quando `routeCellsHaveEscape` puder ser tocada.

## Impossibilidade

Uma rota vai do Explorador ao portal e toda célula depois da primeira precisa
ser admissível. Portanto **o portal tem de ser alcançável por células
admissíveis**. Quando não é, nenhuma escolha de luzes e nenhuma ordenação
salvam o candidato.

`escapeGeometryIsPossible` é exatamente essa pergunta: BFS do início pelo
conjunto admissível, o portal é atingido?

Condição **necessária**, não suficiente. Ela nunca afirma que o mapa é bom —
todos os gates continuam rodando depois. É a necessidade que torna seguro
rejeitar cedo: só pode descartar candidatos que o validador final descartaria.

## Onde entra

Em `buildCandidate`, logo após a decomposição biconexa e **antes** da seleção de
luzes. Um candidato reprovado aqui não paga seleção de luzes, nem a busca por
permutações da rota, nem a colocação de armadilhas.

## Equivalência medida

| | |
|---|---|
| candidatos observados | **10.008** |
| early diz impossível | 3.995 |
| rejeições verdadeiras | 3.995 |
| **FALSE_REJECTIONS** | **0** |
| candidatos preservados | 6.013 |

Medido com uma variante em que a checagem é *observada* em vez de *aplicada*,
para que o veredito antecipado e o veredito do pipeline completo existam para o
mesmo candidato. Nenhum mapa que o validador aceitaria foi descartado cedo.

Nos 192 casos legítimos da autópsia: **192/192** identificados cedo. Continuam
rejeitados — não precisamos salvá-los.

## Geometria dos portais

Medida em tabuleiro sem paredes, o caso mais generoso possível: qualquer parede
só pode reduzir o grau de uma célula.

| rota | portal | grau geométrico | células de convergência | onde grau ≥3 é impossível |
|---|---|---|---|---|
| 1 | `2,8` | 3 | 15 | 1 (`0,8`) |
| 1 | `2,7` | 4 | 20 | 1 (`0,8`) |
| 2 | `1,8` | 3 | 13 | 1 (`0,8`) |
| 2 | `0,7` | 3 | 13 | 1 (`0,8`) |
| 2 | `0,8` | **2 (canto)** | 10 | 0 |
| 3 | `0,8` | **2 (canto)** | 10 | 0 |
| 3 | `0,7` | 3 | 13 | 1 (`0,8`) |

Leitura:

- `0,8` é canto: no máximo dois vizinhos, sempre. Quando **não** é o portal mas
  cai na convergência dele, precisa de grau ≥3 e nunca poderá tê-lo. É
  permanentemente inadmissível em cinco das sete configurações.
- Portais de canto (`0,8` nas rotas 2 e 3) têm só **duas** células de
  aproximação, ambas de borda, ambas com grau máximo 3 — precisam dos três
  vizinhos abertos.
- Nenhum portal é classificado `PORTAL_ESCAPE_GEOMETRY_IMPOSSIBLE`: todos têm ao
  menos uma aproximação capaz de atingir grau 3. A impossibilidade é sempre da
  combinação portal + paredes sorteadas, nunca do portal sozinho.

Por isso **nenhum exit foi removido**. A decisão é por candidato, em tempo de
geração, e não uma amputação do design.

## O que esta missão deliberadamente NÃO fez

Não transformou "canto não pode ter grau 3" em "canto ganha exceção de grau 2".
Isso mudaria o contrato de dificuldade e o significado da largura de fuga.

A solução é geracional: não construir nem prosseguir com candidatos que não
conseguem cumprir a regra atual. A regra é a mesma de antes.

## Efeito medido

| | antes | depois |
|---|---|---|
| throws de geração no validador | 6 | **0** |
| candidatos rejeitados por 180 mapas | 8.972 (por 156) | **2.200** |
| tentativas nas 4 seeds da autópsia | 18 / 96 / 40 / 111 | 3 / 10 / 2 / 2 |
| tempo do checkpoint do validador | 310 s | 86 s |
