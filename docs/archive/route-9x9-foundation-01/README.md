# Rota 9x9 — fundação

Material de aceitação da `ROTA-9X9-FOUNDATION-01`. Capturas do build de
produção (`next build` + `next start`), zero erro de console e zero 404.

## O que mudou na estrutura

- `ROWS`/`COLS` passaram de 7 para **9** (49 → 81 células, +65% de área).
- **Âncoras deixaram de ser literais.** Início do Explorador, aberturas
  seguras, candidatos de saída (geral e por etapa) e assentos do Guardião agora
  derivam de `ROWS`/`COLS`. Antes eram células fixas (`row: 6`, `col: 6`) que
  passariam a apontar para o meio do tabuleiro num grid maior — era o risco real
  de desalinhamento silencioso ao trocar só o número.
- **Quatro templates 9x9 novos** substituíram os 7x7 (três de percurso + um de
  etapa 1 mais aberto). Não há conversão automática de mapa antigo: os literais
  foram reescritos no tamanho novo.
- **Conteúdo reescalado com a área**: paredes 8–17 → 13–28; luzes 2–3 → 3–4
  (até 5 na etapa 3); armadilhas 2–3 → 3–5 (até 6 na etapa 3).
- **Qualidade de mapa reescalada**: células alcançáveis mínimas 34/31/28 (≈65%
  de 49) → 53/50/45 (mesma proporção de 81); junções mínimas 7/6/5 → 10/9/8;
  distância mínima do Guardião ao início 7/6/6 → 9/8/8.
- **Câmera derivada do grid**: a meia-extensão do enquadramento passou a ser
  `max(rows, cols) / 2 + margem`. Trocar o tamanho do tabuleiro reenquadra
  sozinho, sem número mágico.

O `routeBabylonScene.ts` já lia `state.rows`/`state.cols` para posicionar
células, moldura e projeções — o tabuleiro 3D, os hitboxes e a grade se
adaptaram sem alteração.

## Leitura visual medida (produção)

| viewport | canvas | overflowX | erros |
| --- | --- | --- | --- |
| desktop 1440x900 | 928x696 | 0 | 0 |
| tablet 820x1180 | 796x597 | 0 | 0 |
| mobile 390x844 | 372x279 | 0 | 0 |

Capturas: `route-9x9-desktop.png`, `route-9x9-tablet.png`,
`route-9x9-mobile.png`.

## Pendências e riscos

1. **Mobile é o ponto fraco.** Com 9 colunas em 372 px de canvas, cada célula
   fica em torno de 38 px de largura projetada — abaixo do alvo de toque
   confortável. O jogo é jogado pelo D-pad, então não há alvo pequeno de
   toque obrigatório, mas a *leitura* das casas ficou apertada. Precisa de um
   passe próprio de câmera/HUD para mobile.
2. **Balanceamento não foi jogado.** Os números novos foram derivados por área,
   não validados em partidas. Ritmo de coleta, distância de fuga e pressão do
   Guardião precisam de teste real antes de considerar fechado.
3. **Sem compatibilidade com mapas 7x7**: os templates foram substituídos, não
   convertidos. Não existe caminho de volta automático.
4. O caminho do Guardião em 9x9 ficou mais longo; a IA não mudou, então ele
   pode parecer mais lento para alcançar o Explorador.
