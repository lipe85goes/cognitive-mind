# Algoritmo de seleção de luzes

Como `chooseStars` escolhe, e por que essa forma e não outra.

## O problema

Escolher `k` células num tabuleiro 9×9 que sejam individualmente elegíveis
**e** mutuamente separadas por pelo menos `starMinSeparation`.

A separação acopla as escolhas. Existir 20 células elegíveis não implica
existir um conjunto de 6 mutuamente separadas — e escolher a melhor
primeiro pode destruir a única combinação completa que existia.

## O que havia antes

Score em todas as células elegíveis, ordenação decrescente, varredura
gulosa aceitando cada célula que respeitasse a separação com as já
escolhidas, entrega ao validador.

Duas falhas, medidas nas quatro seeds que travavam a geração:

1. **Elegibilidade incompleta.** O score premia distância do início, que é
   exatamente o que correlaciona com estar atrás de um ponto de
   estrangulamento. O validador então rejeitava. 2.330 de 2.864
   tentativas (81,4%) morriam aí — e um solver exaustivo provou que em
   2.330 de 2.330 existia conjunto válido de 6. O layout estava certo; a
   escolha, não.

2. **Guloso não prova existência.** Mesmo com elegibilidade correta,
   tomar a melhor célula primeiro pode inviabilizar o conjunto.

## O que existe agora

### Etapa 1 — elegibilidade completa

`sharesBlock(blocks, playerStart, pos)` entra nos filtros de candidatura.
A regra que o validador aplica passa a valer no momento da escolha.

`blocks` é a decomposição biconexa deste candidato, calculada uma vez em
`buildCandidate` e compartilhada com `isStructurallyValid` — sem custo
adicional.

### Etapa 2 — o score continua sendo preferência

A ordenação por score é preservada integralmente. Nenhum peso mudou,
nenhum limiar foi afrouxado. A célula preferida continua sendo a primeira
tentada.

### Etapa 3 — backtracking limitado sobre a ordem de score

```
search(from, chosen):
  se chosen tem targetCount        -> devolve chosen
  para index de from até fim:
    se chosen + restantes < alvo   -> devolve null      (poda)
    se não separado de chosen      -> pula
    empilha; recorre; se completou -> devolve
    desempilha                                          (backtrack)
  devolve null
```

Percorre os candidatos **em ordem de score**. A primeira solução
encontrada é a lexicograficamente primeira nessa ordem — ou seja, quando
o guloso funciona, o resultado é idêntico ao guloso. A busca só recua
quando a escolha preferida impediria completar o conjunto.

Custo limitado: 9×9 células, `targetCount ≤ 6`, com poda por contagem.

### Etapa 4 — falha explícita

Sem conjunto completo, devolve menos que o exigido e o validador rejeita.
Nenhuma regra de qualidade é relaxada em nenhum ponto — nem separação,
nem distância mínima, nem quantidade, nem alcance.

## Qual das duas mudanças resolveu o problema

A primeira. Nos 2.330 candidatos reais, `GREEDY_FIRST_PATH_SUCCESS = 2330`
e `BACKTRACK_REQUIRED = 0`: com a elegibilidade corrigida, o guloso em
ordem de score chegou sozinho a um conjunto completo em todos os casos.

O backtracking é rede de segurança para configurações possíveis mas não
observadas nessa amostra. Sua cobertura vem do teste controlado B, não
dos 2.330.

O teste B constrói o caso que a amostra real não continha: 18 células
elegíveis onde a de maior score (`6,7`) não pertence a **nenhum** conjunto
completo de 6. O guloso encalha em 4/6. A busca faz 166 backtracks em 173
nós, abandona a escolha inicial e devolve 6 luzes válidas sem ela.

Sem esse teste o ramo estaria sem cobertura alguma.

## Defeito encontrado ao escrever os testes

O teste B, na sua primeira execução, reprovou por um motivo diferente do
esperado: produção devolveu 6 luzes com 8 violações de separação.

A causa era um resíduo do código anterior que a correção original não
removeu — depois do guloso curto, um laço completava a lista até
`targetCount` ignorando a separação. Como nenhum gate a jusante reexamina
separação, mapas com luzes coladas eram certificados.

O laço foi removido. Detalhes em [`choose-stars-contract.md`](choose-stars-contract.md).
