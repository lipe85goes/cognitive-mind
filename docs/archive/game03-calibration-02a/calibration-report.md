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

Pool 23 (A6 B7 C10) · 22 sósias · 115 pistas (diretas 23, associativas 46, indiretas 46).

| | Candidatas | Aceitas | Rejeitadas | Objetos alcançados | Busca min · média · max | Sósias/objeto (média) | Lugares (média) | Relance (média) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 14553 | 414 | 14139 | 23 | 0.533 · 0.543 · 0.552 | 1.003 | 4.481 | 0.959 |
| Médio | 15876 | 1693 | 14183 | 23 | 0.552 · 0.586 · 0.612 | 1.088 | 5.174 | 0.936 |
| Difícil | 9100 | 1890 | 7210 | 15 | 0.612 · 0.681 · 0.778 | 1.353 | 6.285 | 0 |

- Fácil: rejeitadas por tiers fora dos limites 5895, achados de relance demais 8493, abaixo do piso 7601, no piso seguinte ou acima 5813, poucas sósias 2818 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.239–0.821 (média 0.528). Histograma das aceitas: 0.50: 356, 0.55: 58. Objeto mais pedido: chapeu 43.5% das rodadas; menos pedido: xicara 6.3%; só cenário aqui: nenhum.
- Médio: rejeitadas por tiers fora dos limites 8484, achados de relance demais 11196, abaixo do piso 9741, poucas sósias 3503, no piso seguinte ou acima 2532 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.249–0.798 (média 0.527). Histograma das aceitas: 0.55: 1281, 0.60: 412. Objeto mais pedido: lanterna 44.9% das rodadas; menos pedido: pena 9.0%; só cenário aqui: nenhum.
- Difícil: rejeitadas por achados de relance demais 6500, tiers fora dos limites 832, abaixo do piso 3443, poucas sósias 5622 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.475–0.778 (média 0.627). Histograma das aceitas: 0.60: 324, 0.65: 1041, 0.70: 505, 0.75: 20. Objeto mais pedido: gaita 70.1% das rodadas; menos pedido: chapeu 30.5%; só cenário aqui: ampulheta, guarda-chuva, lupa, pena, borboleta, barco, globo, bolsa.

Carga de busca por objeto: ampulheta 0.298 · binoculo 0.584 · chave 0.799 · guarda-chuva 0.275 · gaiola 0.607 · caracol 0.773 · piao 0.633 · lupa 0.263 · bussola 0.616 · relogio 0.842 · xicara 0.85 · pena 0.281 · borboleta 0.31 · chapeu 0.371 · tesoura 0.803 · pinha 0.538 · barco 0.22 · lanterna 0.529 · camera 0.574 · estatueta 0.679 · globo 0.156 · bolsa 0.316 · gaita 0.843.

## Observatório do Explorador

Pool 23 (A6 B7 C10) · 23 sósias · 115 pistas (diretas 23, associativas 46, indiretas 46).

| | Candidatas | Aceitas | Rejeitadas | Objetos alcançados | Busca min · média · max | Sósias/objeto (média) | Lugares (média) | Relance (média) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | 14896 | 767 | 14129 | 23 | 0.533 · 0.543 · 0.552 | 1.024 | 4.112 | 0.947 |
| Médio | 16464 | 2886 | 13578 | 23 | 0.552 · 0.583 · 0.612 | 1.11 | 4.677 | 0.869 |
| Difícil | 10000 | 5899 | 4101 | 17 | 0.612 · 0.677 · 0.78 | 1.338 | 5.34 | 0 |

- Fácil: rejeitadas por tiers fora dos limites 6006, achados de relance demais 5881, abaixo do piso 7698, poucas sósias 1980, no piso seguinte ou acima 6230 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.127–0.81 (média 0.525). Histograma das aceitas: 0.50: 680, 0.55: 87. Objeto mais pedido: bule 32.1% das rodadas; menos pedido: coruja 14.0%; só cenário aqui: nenhum.
- Médio: rejeitadas por tiers fora dos limites 8820, achados de relance demais 8364, abaixo do piso 9810, poucas sósias 2441, no piso seguinte ou acima 3140 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.156–0.802 (média 0.525). Histograma das aceitas: 0.55: 2278, 0.60: 608. Objeto mais pedido: sino 33.8% das rodadas; menos pedido: violino 12.2%; só cenário aqui: nenhum.
- Difícil: rejeitadas por tiers fora dos limites 1272, abaixo do piso 1415, poucas sósias 3590 (uma rodada pode falhar em mais de um critério). Busca das candidatas: 0.526–0.78 (média 0.656). Histograma das aceitas: 0.60: 1172, 0.65: 3420, 0.70: 1233, 0.75: 74. Objeto mais pedido: maca 62.7% das rodadas; menos pedido: ferradura 24.8%; só cenário aqui: coruja, pipa, sistema-solar, vela, violino, gramofone.

Carga de busca por objeto: coruja 0.3 · pipa 0.03 · luneta 0.691 · pantufas 0.471 · oculos 0.662 · ratinho 0.77 · caneca 0.764 · ferradura 0.429 · sistema-solar 0.13 · vela 0.229 · compasso 0.473 · bule 0.515 · sino 0.709 · maca 0.893 · esquadro 0.776 · violino 0.046 · gramofone 0.2 · microscopio 0.471 · gato 0.5 · balanca 0.718 · leque 0.798 · cavalo-marinho 0.686 · cadeado 0.813.

Nenhum invariante falhou.
