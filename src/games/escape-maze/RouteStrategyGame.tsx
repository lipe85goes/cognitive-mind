"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleUserRound,
  DoorOpen,
  Gauge,
  Hourglass,
  Play,
  RotateCcw,
  Shield,
  ShieldPlus,
  Sparkles,
  Sun,
  TriangleAlert,
  Trophy,
  type LucideIcon,
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

const RouteBabylonBoard = dynamic(
  () =>
    import("@/games/escape-maze/RouteBabylonBoard").then(
      (mod) => mod.RouteBabylonBoard,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rsg-canvas-loading">Preparando o tabuleiro Babylon…</div>
    ),
  },
);

const USE_BABYLON_ROUTE_BOARD = true;

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: "Mais aberto",
  medium: "Equilibrado",
  hard: "Mais caminhos",
};

const DIFFICULTY_TITLE: Record<DifficultyLevel, string> = {
  easy: "Aberto",
  medium: "Equilibrado",
  hard: "Desafiador",
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
    totalLights,
    portalActive,
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
    "Luz-chave coletada.",
    "Portal ativado! Vá até a saída.",
    "Escudo coletado.",
    "Escudo protegeu você.",
  ]);
  const warnMessages = new Set([
    "Este caminho tem um obstáculo. Observe o próximo passo.",
    "O guardião está próximo. Pense no próximo caminho.",
    "Caminho bloqueado. Escolha outra direção.",
    "O portal ainda precisa das luzes da rota.",
    "O portal ainda precisa de todas as luzes.",
  ]);
  const statusVariant: "neutral" | "info" | "success" | "warn" | "error" =
    status === "won" || positiveMessages.has(message)
      ? "success"
      : status === "lost"
        ? "error"
        : warnMessages.has(message)
          ? "info"
          : status === "playing"
            ? "info"
            : "neutral";

  const statusIcons: Record<typeof statusVariant, LucideIcon> = {
    neutral: Sparkles,
    info: Sparkles,
    success: CircleCheck,
    error: Sparkles,
  };
  const StatusIcon = statusIcons[statusVariant];
  const remainingLights = Math.max(totalLights - collectedCount, 0);
  const currentObjective = (() => {
    if (status === "won") {
      return {
        Icon: CircleCheck,
        title: "Rota concluída",
        detail: "Você chegou ao portal com calma.",
        className: "is-complete",
      };
    }
    if (status === "lost") {
      return {
        Icon: Sparkles,
        title: "Sessão registrada",
        detail: "Observe outra rota quando quiser praticar de novo.",
        className: "is-resting",
      };
    }
    if (status !== "playing") {
      return {
        Icon: Gauge,
        title: "Escolha um modo",
        detail: "Comece quando estiver confortável.",
        className: "is-setup",
      };
    }
    if (!portalActive) {
      return {
        Icon: Sun,
        title:
          remainingLights === 1
            ? "Colete 1 luz para acordar o portal"
            : `Colete ${remainingLights} luzes para acordar o portal`,
        detail: "As luzes douradas mostram o caminho da rota.",
        className: "is-lights",
      };
    }
    return {
      Icon: DoorOpen,
      title: "Siga até o portal verde",
      detail: "Agora a saída está pronta para receber você.",
      className: "is-portal",
    };
  })();
  const CurrentObjectiveIcon = currentObjective.Icon;

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

  const topHudItems: Array<{
    key: string;
    label: string;
    value: string | number;
    Icon: LucideIcon;
    className?: string;
    danger?: boolean;
  }> = [
    {
      key: "luzes",
      label: "Luzes",
      value: `${collectedCount}/${totalLights}`,
      Icon: Sun,
      className: "rsg-stat-stars",
    },
    {
      key: "portal",
      label: "Portal",
      value: portalActive ? "Ativo" : "Bloqueado",
      Icon: DoorOpen,
      className: portalActive ? "rsg-hud-portal-active" : "rsg-hud-portal-locked",
    },
    {
      key: "bloqueios",
      label: "Bloqueios",
      value: blockedMoves,
      Icon: Box,
      danger: blockedMoves > 0,
    },
    {
      key: "armadilhas",
      label: "Armadilhas",
      value: `${trapsTriggered}/${mazeMap.traps.length}`,
      Icon: TriangleAlert,
      danger: trapsTriggered > 0,
    },
    {
      key: "escudo",
      label: "Escudo",
      value: shieldActive ? "Ativo" : shieldCollected ? "Usado" : "No mapa",
      Icon: ShieldPlus,
      className: shieldActive ? "rsg-hud-shield-active" : undefined,
    },
  ];

  const sideStatItems: Array<{
    key: string;
    label: string;
    value: string | number;
    Icon: LucideIcon;
    className?: string;
  }> = [
    {
      key: "turnos",
      label: "Turnos",
      value: turns,
      Icon: Hourglass,
    },
    {
      key: "modo",
      label: "Modo",
      value: DIFFICULTY_TITLE[difficulty],
      Icon: Gauge,
    },
    {
      key: "tentativas",
      label: "Tentativas",
      value: errors,
      Icon: Sparkles,
    },
    {
      key: "bloqueios",
      label: "Caminhos fechados",
      value: blockedMoves,
      Icon: Box,
    },
    {
      key: "obstaculos",
      label: "Obstáculos",
      value: `${trapsTriggered}/${mazeMap.traps.length}`,
      Icon: TriangleAlert,
    },
    {
      key: "registro",
      label: "Registro",
      value: score,
      Icon: Trophy,
      className: "rsg-stat-score",
    },
  ];
  const legendItems: Array<{ label: string; Icon: LucideIcon }> = [
    { label: "Você", Icon: CircleUserRound },
    { label: "Guardião", Icon: Shield },
    { label: "Saída", Icon: DoorOpen },
    { label: "Luz", Icon: Sun },
    { label: "Armadilha", Icon: TriangleAlert },
    { label: "Escudo", Icon: ShieldPlus },
    { label: "Bloqueio", Icon: Box },
  ];

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
          <div className="rsg-top-hud" aria-label="Status da rota">
            {topHudItems.map(({ key, label, value, Icon, className, danger }) => (
              <span
                key={key}
                className={`rsg-hud-token ${className ?? ""} ${
                  danger ? "is-danger" : ""
                }`}
              >
                <Icon className="rsg-hud-icon" aria-hidden />
                <em>{label}</em>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
          <span className="rsg-difficulty-chip">
            <Gauge className="h-4 w-4" aria-hidden />
            {DIFFICULTY_TITLE[difficulty]}
          </span>
        </header>

        <div className="rsg-plaque">
          <h1 className="rsg-plaque-text">Rota Estratégica</h1>
        </div>

        <p
          className={`rsg-status rsg-status-${statusVariant}`}
          role="status"
          aria-live="polite"
        >
          <StatusIcon className="rsg-status-icon" aria-hidden />
          <span>{message}</span>
        </p>
        <section
          className={`rsg-current-objective ${currentObjective.className}`}
          aria-label="Objetivo atual da rota"
        >
          <CurrentObjectiveIcon className="rsg-current-objective-icon" aria-hidden />
          <span>
            <em>Objetivo atual</em>
            <strong>{currentObjective.title}</strong>
            <small>{currentObjective.detail}</small>
          </span>
          {status === "playing" && totalLights > 0 && !portalActive && (
            <div
              className="rsg-current-objective-progress"
              aria-hidden="true"
            >
              <i
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, (collectedCount / totalLights) * 100),
                  )}%`,
                }}
              />
            </div>
          )}
        </section>

        <div className="rsg-layout">
          <aside className="rsg-info-col" aria-label="Missão e legenda">
            <section className="rsg-panel rsg-mission-panel">
              <p className="rsg-panel-title rsg-panel-title-left">
                <Shield className="h-5 w-5" aria-hidden />
                Rota Estratégica
              </p>
              <p className="rsg-mission-copy">
                Colete todas as luzes para ativar o portal.
              </p>
              <div className="rsg-mission-steps" aria-label="Como jogar">
                <span>
                  <Sun className="h-4 w-4" aria-hidden />
                  Passe pelas luzes para abrir o portal.
                </span>
                <span>
                  <TriangleAlert className="h-4 w-4" aria-hidden />
                  Evite armadilhas e bloqueios.
                </span>
                <span>
                  <ShieldPlus className="h-4 w-4" aria-hidden />
                  Use o escudo para se proteger uma vez.
                </span>
              </div>
            </section>
          </aside>

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
            >
              <div
                className="rsg-canvas"
                role="img"
                aria-label="Tabuleiro 3D da rota: o explorador é você, o guardião é o sentinela encapuzado, o portal é a saída e as luzes douradas ativam o portal."
              >
                {USE_BABYLON_ROUTE_BOARD ? (
                  <RouteBabylonBoard
                    mazeMap={mazeMap}
                    collectedSet={collectedSet}
                    player={player}
                    guardian={guardian}
                    moveTargets={moveTargets}
                    triggeredTrapSet={triggeredTrapSet}
                    shieldCollected={shieldCollected}
                    dangerTiles={dangerTiles}
                    reducedMotion={Boolean(reducedMotion)}
                    status={status}
                    onMove={tryMovePlayer}
                  />
                ) : (
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
                )}
              </div>
            </motion.div>

            <ul className="rsg-legend rsg-board-legend" aria-label="Legenda do tabuleiro">
              {legendItems.map(({ label, Icon }) => (
                <li key={label}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>          </div>

          <div className="rsg-control-col">
            {status === "setup" && (
              <section className="rsg-panel rsg-setup">
                <p className="rsg-panel-title">
                  <Gauge className="h-5 w-5" aria-hidden />
                  Escolha o modo
                </p>
                <div className="rsg-difficulty-grid">
                  {(["easy", "medium", "hard"] as DifficultyLevel[]).map(
                    (level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => changeDifficulty(level)}
                        aria-label={`Modo ${DIFFICULTY_TITLE[level]}: ${DIFFICULTY_LABELS[level]}`}
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

            <div className="rsg-stats rsg-secondary-stats" aria-label="Informações da rota">
              {sideStatItems.map(({ key, label, value, Icon, className }) => (
                <span
                  key={key}
                  className={`rsg-stat ${className ?? ""}`}
                >
                  <Icon className="rsg-stat-icon" aria-hidden />
                  <em>{label}</em>
                  <strong>{value}</strong>
                </span>
              ))}
            </div>

            {status !== "setup" && (
              <button
                type="button"
                onClick={restartGame}
                disabled={status === "won" || status === "lost"}
                aria-label="Começar outra rota"
                className="rsg-btn"
              >
                <RotateCcw className="h-5 w-5" aria-hidden />
                Começar outra rota
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
