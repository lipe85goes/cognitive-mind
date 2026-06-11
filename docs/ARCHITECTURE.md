# MindFlow — Arquitetura

Guia para quem vai evoluir o MVP. Leia antes de adicionar jogos ou mexer no design system.

## Fluxo de telas

Tudo acontece em uma única rota (`src/app/page.tsx`) controlada por um estado de visão:

```
home (GamifiedDashboard + TrainingMap)
  └─ selecionar estação → game (GameScreen)
       ├─ GameHowToPlay (intro "Como jogar")
       └─ <Jogo /> (remontado por sessionKey a cada nova sessão)
            └─ onComplete(result) → result (RewardResultModal)
                 ├─ "Tentar novamente" → game (nova sessão)
                 └─ "Continuar jornada" → home
```

- `page.tsx` é dono do estado de navegação, do `gameSession` (chave de remontagem) e da persistência (`saveGameResult`).
- Cada visão começa no topo da página (`window.scrollTo` no efeito de troca de visão).
- O jogo **nunca** salva resultado direto: ele chama `onComplete` com `Omit<GameResult, "id" | "playedAt">`.

## Fonte única de verdade: `src/data/worlds.ts`

Todo o material de apresentação por jogo (nome da estação, habilidade, ilustração, ícone, chave visual de mundo) vive em `GAME_WORLDS`. Os consumidores são:

| Consumidor | O que usa |
|------------|-----------|
| `TrainingMap` | nome, propósito, imagem, mundo (cartões de estação) |
| `GameHowToPlay` + `data/game-intros.ts` | título, habilidade, imagem, mundo |
| `GameLayout` | ícone e rótulo do tabuleiro (via `WORLDS`) |
| `GamifiedDashboard` | nome, habilidade, ícone (circuitos recentes) |
| `RewardResultModal` | nome, habilidade, ícone (tela de resultado) |

Use sempre `getWorldMeta(gameId)` para dados vindos do `localStorage` — ele tem fallback seguro para ids desconhecidos (resultados antigos não podem quebrar o dashboard).

## Paleta por mundo (CSS)

`globals.css` define tokens em `:root` (`--memory-*`, `--route-*`, `--commands-*`, `--logic-*`, `--garden-*`). As classes temáticas (`game-world-*`, `game-intro-*`, `reward-world-*`, `recent-circuit-*`) **apenas referenciam** esses tokens. Para ajustar a cor de um mundo, mude o token — nunca duplique hex.

Exceção intencional: `station-entry-*` (cartões do dashboard) tem paleta própria, calibrada à ilustração de cada estação (ex.: a arte do Circuito de Memória é verde, embora o mundo em jogo seja rosé).

## Engine (`src/engine/`)

- `scoring.ts` — fórmulas de pontuação por jogo + limites de erro. Puro, sem React.
- `rewards.ts` — `calculateStars` (sinais de ativação 0–3), `isSuccessfulResult` (heurística sobre `details`), `getRewardCopy` (mensagens por `gameId`).
- `storage.ts` — `localStorage` com validação de formato por item (entradas malformadas são descartadas, nunca quebram a UI). Chave: `cognitive-mind-recent-results`, máx. 12 itens. **Não mude a chave nem o shape sem migração.**
- `daily-goal.ts` — meta diária local (3 sessões/dia).
- `stage-progress.ts` — ordem das estações + melhor resultado por jogo.
- `difficulty.ts` — IA do guardião do labirinto (distância de Manhattan).

## Como adicionar um novo jogo

1. **Tipo**: adicione o id em `GameId` (`src/types/game.ts`).
2. **Mundo**: adicione a entrada em `GAME_WORLDS` (`src/data/worlds.ts`) — nome, habilidade, propósito, ilustração em `public/illustrations/`, chave de mundo (nova ou existente). Se criar uma chave nova de mundo, adicione também em `WORLDS` e crie os tokens de paleta + classes CSS correspondentes.
3. **Intro**: adicione a cópia em `INTRO_COPY` (`src/data/game-intros.ts`) — descrição, passos, frase de tranquilização.
4. **Atividade**: adicione em `ACTIVITIES` (`src/data/activities.ts`) com `status: "available"` e em `PLAYABLE_STAGE_IDS` (`src/engine/stage-progress.ts`).
5. **Pontuação**: crie a fórmula em `src/engine/scoring.ts`.
6. **Componente**: crie `src/games/<id>/<Nome>Game.tsx` recebendo `GameComponentProps`; use `GameLayout`, `StatusBanner`, `StatCard`, `GameActions` e os utilitários de `lib/` (sons, shake, pulso).
7. **Registro**: adicione em `GAME_COMPONENTS` (`src/games/index.ts`).
8. **Recompensa**: adicione a cópia em `WORLD_REWARD_COPY` (`src/engine/rewards.ts`).

## Convenções de experiência (não negociáveis)

- Sem cronômetro; tudo no ritmo da pessoa.
- Erros recebem feedback gentil (shake suave + tom grave baixo), nunca punitivo.
- `useReducedMotion` em toda animação; confete só em sucesso e nunca com motion reduzido.
- Sons sempre opcionais (padrão: desligado).
- Alvos de toque ≥ 3rem; texto-base ≥ 1.0625rem.
- Copy em pt-BR, calma, sem jargão médico e sem promessas clínicas.

## Verificação

```bash
npx tsc --noEmit
npx eslint src
npm run build   # (use next build --webpack se o ambiente local tiver problema com o bundler padrão)
```
