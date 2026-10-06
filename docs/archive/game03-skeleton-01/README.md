# GAME03-SKELETON-01 — testemunhas

Evidência visual e o registro da execução do probe de browser do skeleton do
Estúdio das Descobertas. Nada aqui é runtime. O registro completo da missão
está em `docs/GAME03_SKELETON_01.md`.

Gerado com o build de produção:

```bash
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-browser-probe.mjs \
  --out docs/archive/game03-skeleton-01/witnesses \
  --json docs/archive/game03-skeleton-01/browser-probe-run.json
```

Ambiente: Chromium headless com SwiftShader (rasterização por software), 1×.
Tempos dependem da máquina; os veredictos não. As imagens não são comparadas
pixel a pixel com o mockup — servem para avaliar composição, legibilidade,
sensação de exploração, HUD e área de cena.

| Arquivo | Momento |
| --- | --- |
| `witnesses/01-home.webp` | Home (1440×900), cinco mundos |
| `witnesses/02-home-slot-selected.webp` | o Estúdio selecionado no slot da antiga Trilha |
| `witnesses/03-intro.webp` | intro do jogo |
| `witnesses/04-setup.webp` | preparar: Fácil / Médio / Difícil |
| `witnesses/05-playing-desktop.webp` | jogando no desktop, painel lateral |
| `witnesses/06-mesa-zoom.webp` | estação Mesa com zoom |
| `witnesses/07-hint.webp` | pista 2: o halo suave |
| `witnesses/08-show-where.webp` | "Mostrar onde está" |
| `witnesses/09-completion.webp` | "Estúdio explorado" |
| `witnesses/10-result.webp` | `RewardResultModal` com o resultado do Estúdio |
| `witnesses/11-mobile-playing.webp` | celular 390×844, bandeja inferior |
| `witnesses/12-mobile-pinch.webp` | depois da pinça |
| `witnesses/13-mobile-hint.webp` | pista no celular |
| `witnesses/14-mobile-completion.webp` | conclusão no celular |
| `witnesses/15-small-phone.webp` | celular pequeno 360×640 |
| `witnesses/16-legacy-home.webp` | Home com um resultado antigo da Trilha salvo |

`browser-probe-run.json`: os 61 veredictos (desktop, mobile, celular pequeno,
reduced motion, histórico legado, bundle) e as medições dessa execução.
