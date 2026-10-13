# Game 03 · Difficulty V3 — relatório de calibração

Gerado por `node tools/validation/hidden-objects-calibration.mjs --out docs/archive/game03-calibration-02a`.
Base de referência: `3b122cf` (Difficulty V2, arte v1 das duas salas). Veredito: **CALIBRATION_REPORT_OK**.

## 1. A régua e os pisos, derivados da base

- Borda: 1.3 (piso de justiça) → 1, 2.96 (P90 da arte v1) → 0.
- Desordem ao redor: 0.096 (P10) → 0, 0.196 (P90) → 1.
- Tamanho (√área, su): 188 (P90) → 0, 80 (P10) → 1.
- Achado de relance: carga < 0.325 (meio caminho entre a média dos A e a dos B da arte v1).
- Pisos de busca (Difícil V2, 1460 rodadas das duas salas): Fácil 0.533 (P25) · Médio 0.552 (média) · Difícil 0.612 (máximo).
- Pisos de sósias por objeto: Fácil 0.75 · Médio 0.794 · Difícil 1.25.
- Constantes do produto iguais às derivadas: **sim**.

| V2 (base) | Fácil | Médio | Difícil |
| --- | --- | --- | --- |
| busca mín. | 0.213 | 0.391 | 0.474 |
| busca média | 0.299 | 0.501 | 0.552 |
| busca máx. | 0.372 | 0.577 | 0.612 |
| sósias/objeto (média) | 0.423 | 0.732 | 0.794 |

## Estúdio do Explorador

Pool 26 (A6 B8 C12) · 25 sósias · 130 pistas (diretas 26, associativas 52, indiretas 52).

| | Candidatas | Aceitas | Rejeitadas | Objetos alcançados | Busca min · média · max | Sósias/objeto (média) | Lugares (média) | Relance (média) | Atrás de peças (média · rodadas por contagem) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 28000 | 898 | 27102 | 26 | 0.533 · 0.543 · 0.552 | 0.992 | 4.46 | 0.941 | 0.546 · 0: 408, 1: 490 |
| Médio | 35280 | 3153 | 32127 | 26 | 0.552 · 0.585 · 0.612 | 1.059 | 5.051 | 0.886 | 1.304 · 1: 2195, 2: 958 |
| Difícil | 44800 | 8001 | 36799 | 18 | 0.612 · 0.679 · 0.799 | 1.325 | 5.783 | 0 | 1.55 · 1: 4265, 2: 3070, 3: 666 |

- Fácil: rejeitadas por tiers fora dos limites 9412, achados de relance demais 13900, abaixo do piso 12910, no piso seguinte ou acima 12819, poucas sósias 4863, objetos atrás de peças fora dos limites 2674 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.243–0.828 (média 0.542). Histograma das aceitas: 0.50: 781, 0.55: 117. Objeto mais pedido: chapeu 34.7% das rodadas; menos pedido: apito 7.5%; só cenário aqui: nenhum.
- Médio: rejeitadas por tiers fora dos limites 16110, achados de relance demais 21735, abaixo do piso 19415, objetos atrás de peças fora dos limites 16317, poucas sósias 7098, no piso seguinte ou acima 6926 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.255–0.803 (média 0.541). Histograma das aceitas: 0.55: 2419, 0.60: 734. Objeto mais pedido: cantil 56.7% das rodadas; menos pedido: borboleta 9.7%; só cenário aqui: nenhum.
- Difícil: rejeitadas por objetos atrás de peças fora dos limites 9100, achados de relance demais 28350, tiers fora dos limites 4480, abaixo do piso 16393, poucas sósias 29770 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.458–0.799 (média 0.629). Histograma das aceitas: 0.60: 1545, 0.65: 4397, 0.70: 1941, 0.75: 118. Objeto mais pedido: gaita 60.6% das rodadas; menos pedido: chapeu 16.2%; só cenário aqui: ampulheta, guarda-chuva, lupa, pena, borboleta, barco, globo, bolsa.

Carga de busca por objeto: ampulheta 0.312 · binoculo 0.584 · chave 0.799 · guarda-chuva 0.276 · gaiola 0.607 · caracol 0.773 · piao 0.651 · lupa 0.268 · bussola 0.616 · relogio 0.842 · xicara 0.85 · pena 0.292 · borboleta 0.31 · chapeu 0.371 · tesoura 0.803 · pinha 0.538 · barco 0.22 · lanterna 0.529 · camera 0.574 · estatueta 0.679 · globo 0.158 · bolsa 0.316 · gaita 0.843 · apito 0.805 · colar 0.655 · cantil 0.431.

## Observatório do Explorador

Pool 26 (A6 B7 C13) · 26 sósias · 130 pistas (diretas 26, associativas 52, indiretas 52).

| | Candidatas | Aceitas | Rejeitadas | Objetos alcançados | Busca min · média · max | Sósias/objeto (média) | Lugares (média) | Relance (média) | Atrás de peças (média · rodadas por contagem) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 28512 | 1343 | 27169 | 26 | 0.533 · 0.543 · 0.552 | 0.983 | 4.191 | 0.958 | 0.429 · 0: 767, 1: 576 |
| Médio | 36288 | 4053 | 32235 | 26 | 0.552 · 0.584 · 0.612 | 1.026 | 5.019 | 0.898 | 1.244 · 1: 3063, 2: 990 |
| Difícil | 47775 | 19413 | 28362 | 20 | 0.612 · 0.694 · 0.792 | 1.312 | 5.686 | 0 | 1.467 · 1: 11508, 2: 6737, 3: 1168 |

- Fácil: rejeitadas por tiers fora dos limites 9443, achados de relance demais 9318, abaixo do piso 11831, poucas sósias 3412, no piso seguinte ou acima 14762, objetos atrás de peças fora dos limites 2696 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.13–0.818 (média 0.552). Histograma das aceitas: 0.50: 1194, 0.55: 149. Objeto mais pedido: compasso 29.9% das rodadas; menos pedido: maca 11.4%; só cenário aqui: nenhum.
- Médio: rejeitadas por tiers fora dos limites 16142, achados de relance demais 15561, abaixo do piso 17595, poucas sósias 4959, objetos atrás de peças fora dos limites 16912, no piso seguinte ou acima 10061 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.158–0.809 (média 0.552). Histograma das aceitas: 0.55: 3121, 0.60: 932. Objeto mais pedido: ioio 47.2% das rodadas; menos pedido: coruja 12.3%; só cenário aqui: nenhum.
- Difícil: rejeitadas por tiers fora dos limites 2819, abaixo do piso 3385, poucas sósias 21624, objetos atrás de peças fora dos limites 10000 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.533–0.792 (média 0.67). Histograma das aceitas: 0.60: 1456, 0.65: 9836, 0.70: 7419, 0.75: 702. Objeto mais pedido: maca 54.3% das rodadas; menos pedido: ferradura 13.7%; só cenário aqui: coruja, pipa, sistema-solar, vela, violino, gramofone.

Carga de busca por objeto: coruja 0.3 · pipa 0.03 · luneta 0.691 · pantufas 0.469 · oculos 0.672 · ratinho 0.811 · caneca 0.764 · ferradura 0.429 · sistema-solar 0.144 · vela 0.229 · compasso 0.474 · bule 0.523 · sino 0.709 · maca 0.893 · esquadro 0.774 · violino 0.046 · gramofone 0.2 · microscopio 0.525 · gato 0.499 · balanca 0.717 · leque 0.798 · cavalo-marinho 0.686 · cadeado 0.813 · foguete 0.751 · ioio 0.671 · tambor 0.731.

Nenhum invariante falhou.
