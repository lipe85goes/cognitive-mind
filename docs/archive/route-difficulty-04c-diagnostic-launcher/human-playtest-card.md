# Ficha de playtest humano — Rota Estratégica

Ferramenta: `/lab/route-launcher` (só por URL; não aparece na Home).

Uma ficha por partida. Sem backend, sem analytics — isto é papel.

---

## Ordem recomendada

Referência **antes** dos outliers, para haver base de comparação. Um outlier só
significa alguma coisa contra uma partida normal.

| # | ID | Route | Difficulty | Seed | O que observar |
|---|---|---|---|---|---|
| 1 | BASE-1 | 2 | easy | `12420031` | Hunter começa a distância 9 — pressão baixa. É a sensação de "normal". |
| 2 | BASE-2 | 3 | easy | `12430048` | Chest detour de 10 — o baú vale o desvio? |
| 3 | BASE-3 | 2 | medium | `12421027` | Pickaxe melhora 10 moves — a Picareta compensa o turno gasto? |
| 4 | OUT-1 | 3 | hard | `12432116` | Forced streak de 10 — o mapa joga sozinho por 10 passos? |
| 5 | OUT-2 | 3 | hard | `12432045` | Objective route de 43 moves — a rota mais longa medida. Cansa? |

Se sobrar fôlego, jogue **livre**: R1 easy e R1 hard com seed à sua escolha, para
sentir os extremos do início da jornada.

> Os cinco cenários acima estão no botão da bateria dentro do launcher — não é
> preciso digitar seed.

---

## Ficha (uma por partida)

```
Route: ____    Difficulty: ____________    Seed: ______________

Resultado:        ( ) venceu    ( ) perdeu
Turnos (aprox.):  ______        Duração (aprox.): ______ min

Recompensa do baú escolhida:
  ( ) Picareta    ( ) Segunda Chance    ( ) não cheguei ao baú

Picareta usada?          ( ) sim  ( ) não  ( ) não tinha
  Se sim, a parede aberta ajudou?   ( ) muito ( ) pouco ( ) atrapalhou

Segunda Chance acionada? ( ) sim  ( ) não  ( ) não tinha
  Se sim, ficou claro que ela te salvou?  ( ) sim ( ) não

Caçador (Hunter) pareceu:
  ( ) baixo        ( ) adequado        ( ) excessivo

Sentinela pareceu:
  ( ) baixo        ( ) adequado        ( ) excessivo

O mapa pareceu:
  ( ) fácil   ( ) justo   ( ) difícil   ( ) frustrante

Momento mais difícil (onde e por quê):
______________________________________________________________
______________________________________________________________

Observação livre:
______________________________________________________________
______________________________________________________________
```

---

## Como usar o launcher

1. abrir `/lab/route-launcher`;
2. clicar no cenário da bateria (ou digitar Route / Difficulty / Seed e
   **Launch**);
3. a faixa escura no topo mostra Route, Difficulty e Seed ativos durante toda a
   partida — confira antes de começar a jogar;
4. jogar normalmente: é o jogo real, não uma simulação;
5. **Relançar** repete o mesmo cenário do zero, com o mesmo tabuleiro;
6. **Sair do diagnóstico** desarma a seed e volta ao formulário.

O mesmo `Route + Difficulty + Seed` sempre dá o mesmo tabuleiro — inclusive as
posições iniciais do Caçador e do Sentinela. Dá para repetir uma partida difícil
quantas vezes quiser e testar decisões diferentes no mesmo cenário.

---

## O que NÃO fazer nesta rodada

* não ajustar dificuldade, Hunter, Sentinela, traps, walls, RNG ou recompensas —
  esta rodada é **coleta**, não balanceamento;
* não descartar uma partida ruim: a partida frustrante é o dado mais útil;
* não jogar só os outliers. Sem as três partidas de referência não há com o que
  comparar.
