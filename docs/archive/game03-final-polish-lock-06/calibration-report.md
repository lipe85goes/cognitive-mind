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
| Fácil | 28000 | 884 | 27116 | 26 | 0.533 · 0.543 · 0.552 | 0.993 | 4.462 | 0.946 | 0.551 · 0: 397, 1: 487 |
| Médio | 35280 | 3160 | 32120 | 26 | 0.552 · 0.585 · 0.612 | 1.059 | 5.051 | 0.887 | 1.304 · 1: 2200, 2: 960 |
| Difícil | 44800 | 8005 | 36795 | 18 | 0.612 · 0.679 · 0.799 | 1.325 | 5.783 | 0 | 1.55 · 1: 4272, 2: 3067, 3: 666 |

- Fácil: rejeitadas por tiers fora dos limites 9412, achados de relance demais 13900, abaixo do piso 12757, no piso seguinte ou acima 12953, poucas sósias 4863, objetos atrás de peças fora dos limites 2674 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.247–0.826 (média 0.543). Histograma das aceitas: 0.50: 775, 0.55: 109. Objeto mais pedido: chapeu 36.0% das rodadas; menos pedido: apito 7.1%; só cenário aqui: nenhum.
- Médio: rejeitadas por tiers fora dos limites 16110, achados de relance demais 21735, abaixo do piso 19229, objetos atrás de peças fora dos limites 16317, poucas sósias 7098, no piso seguinte ou acima 6974 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.258–0.802 (média 0.543). Histograma das aceitas: 0.55: 2411, 0.60: 749. Objeto mais pedido: cantil 57.1% das rodadas; menos pedido: lupa 9.9%; só cenário aqui: nenhum.
- Difícil: rejeitadas por objetos atrás de peças fora dos limites 9100, achados de relance demais 28350, tiers fora dos limites 4480, abaixo do piso 16301, poucas sósias 29770 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.46–0.799 (média 0.629). Histograma das aceitas: 0.60: 1548, 0.65: 4419, 0.70: 1925, 0.75: 113. Objeto mais pedido: gaita 60.6% das rodadas; menos pedido: chapeu 16.2%; só cenário aqui: ampulheta, guarda-chuva, lupa, pena, borboleta, barco, globo, bolsa.

Carga de busca por objeto: ampulheta 0.314 · binoculo 0.585 · chave 0.793 · guarda-chuva 0.274 · gaiola 0.608 · caracol 0.773 · piao 0.645 · lupa 0.266 · bussola 0.617 · relogio 0.841 · xicara 0.851 · pena 0.291 · borboleta 0.311 · chapeu 0.375 · tesoura 0.802 · pinha 0.532 · barco 0.207 · lanterna 0.542 · camera 0.581 · estatueta 0.682 · globo 0.2 · bolsa 0.316 · gaita 0.84 · apito 0.806 · colar 0.648 · cantil 0.43.

## Observatório do Explorador

Pool 26 (A6 B7 C13) · 26 sósias · 130 pistas (diretas 26, associativas 52, indiretas 52).

| | Candidatas | Aceitas | Rejeitadas | Objetos alcançados | Busca min · média · max | Sósias/objeto (média) | Lugares (média) | Relance (média) | Atrás de peças (média · rodadas por contagem) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 28512 | 1326 | 27186 | 26 | 0.533 · 0.543 · 0.552 | 0.982 | 4.196 | 0.961 | 0.432 · 0: 753, 1: 573 |
| Médio | 36288 | 4021 | 32267 | 26 | 0.552 · 0.584 · 0.612 | 1.025 | 5.013 | 0.897 | 1.245 · 1: 3036, 2: 985 |
| Difícil | 47775 | 19414 | 28361 | 20 | 0.613 · 0.695 · 0.794 | 1.312 | 5.686 | 0 | 1.467 · 1: 11509, 2: 6737, 3: 1168 |

- Fácil: rejeitadas por tiers fora dos limites 9443, achados de relance demais 9318, abaixo do piso 11797, poucas sósias 3412, no piso seguinte ou acima 14811, objetos atrás de peças fora dos limites 2696 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.13–0.822 (média 0.552). Histograma das aceitas: 0.50: 1184, 0.55: 142. Objeto mais pedido: bule 30.3% das rodadas; menos pedido: coruja 11.7%; só cenário aqui: nenhum.
- Médio: rejeitadas por tiers fora dos limites 16142, achados de relance demais 15561, abaixo do piso 17518, poucas sósias 4959, objetos atrás de peças fora dos limites 16912, no piso seguinte ou acima 10156 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.158–0.812 (média 0.552). Histograma das aceitas: 0.55: 3096, 0.60: 925. Objeto mais pedido: ioio 47.5% das rodadas; menos pedido: coruja 12.2%; só cenário aqui: nenhum.
- Difícil: rejeitadas por tiers fora dos limites 2819, abaixo do piso 3307, poucas sósias 21624, objetos atrás de peças fora dos limites 10000 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.532–0.794 (média 0.671). Histograma das aceitas: 0.60: 1361, 0.65: 9765, 0.70: 7537, 0.75: 751. Objeto mais pedido: esquadro 54.3% das rodadas; menos pedido: ferradura 13.7%; só cenário aqui: coruja, pipa, sistema-solar, vela, violino, gramofone.

Carga de busca por objeto: coruja 0.301 · pipa 0.03 · luneta 0.69 · pantufas 0.469 · oculos 0.665 · ratinho 0.81 · caneca 0.762 · ferradura 0.429 · sistema-solar 0.144 · vela 0.23 · compasso 0.47 · bule 0.523 · sino 0.709 · maca 0.891 · esquadro 0.794 · violino 0.046 · gramofone 0.199 · microscopio 0.526 · gato 0.506 · balanca 0.714 · leque 0.798 · cavalo-marinho 0.697 · cadeado 0.814 · foguete 0.748 · ioio 0.665 · tambor 0.731.

Nenhum invariante falhou.
