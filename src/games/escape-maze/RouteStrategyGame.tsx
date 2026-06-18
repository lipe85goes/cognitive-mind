"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  DoorOpen,
  Gauge,
  Play,
  RotateCcw,
  Shield,
  ShieldPlus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { gentleShakeAnimate } from "@/lib/feedback-motion";
import {
  COLS,
  posKey,
  ROWS,
  useEscapeMaze,
} from "@/games/escape-maze/useEscapeMaze";
import type {
  DifficultyLevel,
  GameComponentProps,
  GridPosition,
} from "@/types/game";

/** WebGL is client-only: load the 3D board after mount with a calm fallback. */
const RouteBoardScene = dynamic(
  () =>
    import("@/components/three/route/RouteBoardScene").then(
      (mod) => mod.RouteBoardScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rsg-canvas-loading">Preparando o tabuleiro 3D…</div>
    ),
  },
);

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: "Mais aberto",
  medium: "Equilibrado",
  hard: "Mais caminhos",
};

const DIFFICULTY_TITLE: Record<DifficultyLevel, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

const MOVE_DELTAS: Record<"up" | "down" | "left" | "right", GridPosition> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

/**
 * Rota Estratégica as a premium tabletop board game. All gameplay (maze,
 * guardian, movement, win/loss, scoring, completion) lives in `useEscapeMaze`,
 * extracted verbatim from the original; this component is a pure premium view.
 */
export function RouteStrategyGame({ onComplete, onExit }: GameComponentProps) {
  const reducedMotion = useReducedMotion();
  const game = useEscapeMaze(onComplete);
  const {
    difficulty,
    mazeMap,
    player,
    guardian,
    collectedSet,
    collectedCount,
    turns,
    blockedMoves,
    errors,
    status,
    message,
    score,
    blockedShake,
    triggeredTrapSet,
    trapsTriggered,
    shieldCollected,
    shieldActive,
    startGame,
    restartGame,
    changeDifficulty,
    tryMovePlayer,
  } = game;

  // Walkable neighbours of the player — a calm "available moves" hint. Pure
  // derivation from the map; it never changes the grid logic or input.
  const moveTargets = useMemo(() => {
    if (status !== "playing") return new Set<string>();
    return new Set(
      [
        { row: player.row - 1, col: player.col },
        { row: player.row + 1, col: player.col },
        { row: player.row, col: player.col - 1 },
        { row: player.row, col: player.col + 1 },
      ]
        .filter(
          (p) =>
            p.row >= 0 &&
            p.row < ROWS &&
            p.col >= 0 &&
            p.col < COLS &&
            !mazeMap.walls.has(posKey(p)),
        )
        .map(posKey),
    );
  }, [status, player, mazeMap]);

  // Tiles the guardian can step to next — a simple, calm danger radius derived
  // purely from its position and the walls (never from the guardian AI).
  const dangerTiles = useMemo(() => {
    if (status !== "playing") return new Set<string>();
    return new Set(
      [
        { row: guardian.row - 1, col: guardian.col },
        { row: guardian.row + 1, col: guardian.col },
        { row: guardian.row, col: guardian.col - 1 },
        { row: guardian.row, col: guardian.col + 1 },
      ]
        .filter(
          (p) =>
            p.row >= 0 &&
            p.row < ROWS &&
            p.col >= 0 &&
            p.col < COLS &&
            !mazeMap.walls.has(posKey(p)),
        )
        .map(posKey),
    );
  }, [status, guardian, mazeMap]);

  const positiveMessages = new Set([
    "Você coletou uma luz.",
    "Escudo coletado.",
    "Escudo protegeu você.",
  ]);
  const warnMessages = new Set([
    "Armadilha ativada. Planeje o próximo passo.",
    "Cuidado: o guardião está perto.",
    "Caminho bloqueado. Escolha outra direção.",
  ]);
  const statusVariant: "neutral" | "info" | "success" | "warn" | "error" =
    status === "won" || positiveMessages.has(message)
      ? "success"
      : status === "lost"
        ? "error"
        : warnMessages.has(message)
          ? "warn"
          : status === "playing"
            ? "info"
            : "neutral";

  const moveIcons = {
    up: ChevronUp,
    down: ChevronDown,
    left: ChevronLeft,
    right: ChevronRight,
  };
  const moveLabels = { up: "Cima", down: "Baixo", left: "Esquerda", right: "Direita" };

  const renderMoveButton = (dir: "up" | "down" | "left" | "right") => {
    const Icon = moveIcons[dir];
    return (
      <motion.button
        type="button"
        onClick={() => tryMovePlayer(MOVE_DELTAS[dir])}
        whileTap={reducedMotion ? undefined : { scale: 0.94, y: 2 }}
        whileHover={reducedMotion ? undefined : { y: -2 }}
        aria-label={`Mover ${moveLabels[dir]}`}
        className="rsg-move-btn"
      >
        <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.4} aria-hidden />
      </motion.button>
    );
  };

  return (
    <div className="rsg-shell">
      <div className="rsg-atmosphere" aria-hidden />
      <span className="rsg-vignette" aria-hidden />

      <div className="rsg-frame">
        <header className="rsg-topbar">
          <button
            type="button"
            onClick={onExit}
            aria-label="Voltar à jornada cognitiva"
            className="rsg-back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Voltar à jornada
          </button>
          {status === "playing" && (
            <div className="rsg-chips">
              {shieldCollected && (
                <span
                  className={`rsg-shield-chip ${
                    shieldActive ? "is-active" : "is-used"
                  }`}
                >
                  <ShieldPlus className="h-4 w-4" aria-hidden />
                  Escudo: {shieldActive ? "ativo" : "usado"}
                </span>
              )}
              <span className="rsg-difficulty-chip">
                <Gauge className="h-4 w-4" aria-hidden />
                {DIFFICULTY_TITLE[difficulty]}
              </span>
            </div>
          )}
        </header>

        <div className="rsg-plaque">
          <h1 className="rsg-plaque-text">Rota Estratégica</h1>
        </div>

        <p
          className={`rsg-status rsg-status-${statusVariant}`}
          role="status"
          aria-live="polite"
        >
          {message}
        </p>

        <div className="rsg-layout">
          <div className="rsg-board-col">
            <motion.div
              className={`rsg-board-panel ${
                status === "won"
                  ? "is-won"
                  : status === "lost"
                    ? "is-lost"
                    : ""
              }`}
              initial={false}
              animate={
                reducedMotion || blockedShake === 0
                  ? undefined
                  : gentleShakeAnimate
              }
              key={blockedShake > 0 ? `board-${blockedShake}` : "board"}
            >
              <div
                className="rsg-canvas"
                role="img"
                aria-label="Tabuleiro 3D da rota: o explorador é você, o guardião é o sentinela encapuzado, o portal verde é a saída e as luzes douradas são coletáveis."
              >
                <RouteBoardScene
                  walls={mazeMap.walls}
                  exitPosition={mazeMap.exitPosition}
                  stars={mazeMap.collectibleStars}
                  collectedSet={collectedSet}
                  player={player}
                  guardian={guardian}
                  moveTargets={moveTargets}
                  traps={mazeMap.traps}
                  triggeredTrapSet={triggeredTrapSet}
                  shield={mazeMap.shield}
                  shieldCollected={shieldCollected}
                  dangerTiles={dangerTiles}
                  reducedMotion={Boolean(reducedMotion)}
                  onMove={tryMovePlayer}
                />
              </div>
            </motion.div>

            <ul className="rsg-legend" aria-label="Legenda do tabuleiro">
              <li>
                <CircleUserRound className="h-4 w-4" aria-hidden />
                Você
              </li>
              <li>
                <Shield className="h-4 w-4" aria-hidden />
                Guardião
              </li>
              <li>
                <DoorOpen className="h-4 w-4" aria-hidden />
                Saída
              </li>
              <li>
                <Sparkles className="h-4 w-4" aria-hidden />
                Luz
              </li>
              <li>
                <TriangleAlert className="h-4 w-4" aria-hidden />
                Armadilha
              </li>
              <li>
                <ShieldPlus className="h-4 w-4" aria-hidden />
                Escudo
              </li>
            </ul>
          </div>

          <div className="rsg-control-col">
            {status === "setup" && (
              <section className="rsg-panel rsg-setup">
                <p className="rsg-panel-title">
                  <Gauge className="h-5 w-5" aria-hidden />
                  Escolha a dificuldade
                </p>
                <div className="rsg-difficulty-grid">
                  {(["easy", "medium", "hard"] as DifficultyLevel[]).map(
                    (level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => changeDifficulty(level)}
                        aria-label={`Dificuldade ${DIFFICULTY_TITLE[level]}: ${DIFFICULTY_LABELS[level]}`}
                        aria-pressed={difficulty === level}
                        className={`rsg-difficulty-btn ${
                          difficulty === level ? "is-active" : ""
                        }`}
                      >
                        <strong>{DIFFICULTY_TITLE[level]}</strong>
                        <em>{DIFFICULTY_LABELS[level]}</em>
                      </button>
                    ),
                  )}
                </div>
                <button
                  type="button"
                  onClick={startGame}
                  aria-label="Iniciar rota com a dificuldade selecionada"
                  className="rsg-cta"
                >
                  <Play className="h-6 w-6 fill-current" aria-hidden />
                  Iniciar rota
                </button>
              </section>
            )}

            {status === "playing" && (
              <motion.section
                className="rsg-panel rsg-dpad-panel"
                role="group"
                aria-label="Controles de movimento"
                initial={false}
                animate={
                  reducedMotion || blockedShake === 0
                    ? undefined
                    : gentleShakeAnimate
                }
                key={blockedShake > 0 ? `dpad-${blockedShake}` : "dpad"}
              >
                <p className="rsg-panel-title">
                  <Sparkles className="h-5 w-5" aria-hidden />
                  Toque para mover
                </p>
                <div className="rsg-dpad">
                  <span />
                  {renderMoveButton("up")}
                  <span />
                  {renderMoveButton("left")}
                  <span className="rsg-dpad-center" aria-hidden />
                  {renderMoveButton("right")}
                  <span />
                  {renderMoveButton("down")}
                  <span />
                </div>
              </motion.section>
            )}

            <div className="rsg-stats" aria-label="Progresso da rota">
              <span className="rsg-stat">
                <em>Turnos</em>
                <strong>{turns}</strong>
              </span>
              <span className="rsg-stat rsg-stat-stars">
                <em>Luzes</em>
                <strong>
                  {collectedCount}/{mazeMap.collectibleStars.length}
                </strong>
              </span>
              <span className={`rsg-stat ${blockedMoves > 0 ? "is-danger" : ""}`}>
                <em>Bloqueios</em>
                <strong>{blockedMoves}</strong>
              </span>
              <span className={`rsg-stat ${errors > 0 ? "is-danger" : ""}`}>
                <em>Erros</em>
                <strong>{errors}</strong>
              </span>
              <span
                className={`rsg-stat ${trapsTriggered > 0 ? "is-danger" : ""}`}
              >
                <em>Armadilhas</em>
                <strong>
                  {trapsTriggered}/{mazeMap.traps.length}
                </strong>
              </span>
              <span className="rsg-stat rsg-stat-score">
                <em>Pontuação</em>
                <strong>{score}</strong>
              </span>
              <span className="rsg-stat">
                <em>Dificuldade</em>
                <strong>{DIFFICULTY_TITLE[difficulty]}</strong>
              </span>
            </div>

            {status !== "setup" && (
              <button
                type="button"
                onClick={restartGame}
                disabled={status === "won" || status === "lost"}
                aria-label="Reiniciar rota"
                className="rsg-btn"
              >
                <RotateCcw className="h-5 w-5" aria-hidden />
                Reiniciar
              </button>
            )}
          </div>
        </div>

        <p className="rsg-footnote">
          Toque nos botões de direção ou use as setas do teclado para mover. O
          guardião se move depois de você; os contornos âmbar mostram até onde
          ele pode chegar no próximo passo.
        </p>
      </div>
    </div>
  );
}
