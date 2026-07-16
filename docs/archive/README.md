# MindFlow Archive

Esta pasta guarda assets históricos, previews e materiais de revisão que não são carregados pelo app em runtime.

## Subpastas

- `route-previews/` — PNGs de preview dos GLBs da Rota Estratégica.
- `memory-circuit/` — protótipos visuais antigos do Circuito de Memória.
- `home-legacy/` — assets antigos da Home antes da Home 3D atual.

## Regras

- Não importe arquivos de `docs/archive/` no código do app.
- Não mova arquivos daqui para `public/` sem uma missão explícita.
- Se um asset arquivado voltar a ser runtime, atualize também `docs/ARCHITECTURE.md` e o README da pasta correspondente.
- Previews gerados por scripts podem ser recriados em `public/`, mas devem ser arquivados ou removidos antes de commit se não forem runtime.
