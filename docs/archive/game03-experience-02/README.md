# GAME03-EXPERIENCE-02 — evidência

Evidência da experiência V2 e do pool de alvos V1 do Estúdio das Descobertas.
Nada aqui é runtime. O registro completo da missão está em
`docs/GAME03_EXPERIENCE_02.md`.

Gerado com o build de produção:

```bash
npx next build && npx next start -p 3100
node tools/validation/hidden-objects-browser-probe.mjs \
  --out docs/archive/game03-experience-02/witnesses \
  --json docs/archive/game03-experience-02/browser-probe-run.json
node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02
```

Ambiente: Chromium headless com SwiftShader (rasterização por software), 1×.
Tempos dependem da máquina; os veredictos não. Cada cenário do probe planta as
próprias sementes de rodada, então as listas das testemunhas são sempre as mesmas.

| Arquivo | O que é |
| --- | --- |
| `browser-probe-run.json` | os 104 veredictos dos 10 cenários e as medições (bundle, arrasto, entrada, rodadas na tela, corrida do reload) |
| `probe-scenarios-alone.json` | cada cenário rodado sozinho (`--scenario NOME`), processo e browser próprios: 104/104 |
| `fairness-report.md` · `fairness-report.json` | a seleção real sobre 1.000.000 de sementes por dificuldade: frequência por objeto, tiers, estações, primeira linha, carga perceptiva |
| `witnesses/e00-home.webp` … `e01c-setup.webp` | Home, o Estúdio selecionado, intro, preparar |
| `witnesses/e02-easy-playing.webp` | Fácil (semente 101): imagem + nome |
| `witnesses/e02b-easy-new-entry.webp` | nova entrada pela Home (semente 303): outra lista |
| `witnesses/e03-medium-playing.webp` · `e04-medium-hint-pool.webp` | Médio (202): silhuetas; halo largo da pista 2 |
| `witnesses/e05-hard-playing.webp` · `e06-hard-hint-max.webp` · `e07-hard-semantic-found.webp` · `e08-hard-result.webp` | Difícil (404): pistas de função, pista de contexto, achado com nome, resultado |
| `witnesses/e09-zoom-table.webp` · `e10-hint-easy-final.webp` | zoom na mesa; "Mostrar onde está" no Fácil |
| `witnesses/e11-completion.webp` · `e12-result.webp` | "Estúdio explorado"; tela de resultado ("Objetos encontrados", "Modo") |
| `witnesses/e13-mobile-hard.webp` … `e16-mobile-tray-folded.webp` | celular 390×844, Difícil (505): bandeja, pinça, pista, bandeja recolhida |
| `witnesses/e17-desktop-rail.webp` | lista recolhida em trilho no desktop |
| `witnesses/e18-small-phone.webp` | celular pequeno 360×640 (707) |
| `witnesses/e19-legacy-home.webp` | Home com um resultado antigo da Trilha |
| `witnesses/e20-landscape-medium.webp` … `e23-landscape-complete.webp` | celular deitado 844×390, Médio (606): coluna lateral, achados, virado em pé no meio da rodada, conclusão |
| `witnesses/e24-round-*.webp` | o cenário `rounds`: uma entrada por dificuldade (1001, 2001, 3001) |
