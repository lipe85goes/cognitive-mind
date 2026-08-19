"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Box,
  BrickWall,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  CircleUserRound,
  DoorOpen,
  Gauge,
  Hourglass,
  Info,
  Package,
  Pickaxe,
  Play,
  RotateCcw,
  Shield,
  ShieldPlus,
  Sparkles,
  Sun,
  TriangleAlert,
  Trophy,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { gentleShakeAnimate } from "@/lib/feedback-motion";
import {
  COLS,
  posKey,
  ROWS,
  useEscapeMaze,
  type ChestReward,
} from "@/games/escape-maze/useEscapeMaze";
import { getWorldMasterSceneStyle } from "@/components/worlds/master-scene/worldMasterSceneConfig";
import type {
  DifficultyLevel,
  GameComponentProps,
  GridPosition,
} from "@/types/game";
import "@/components/worlds/master-scene/world-master-scene.css";
import "@/games/escape-maze/route-visual.css";

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
 * The two rewards, as the player meets them. Short enough to decide from, and
 * deliberately silent about how either one is computed (ROTA-CHEST-REWARDS-01 §27).
 */
const REWARD_COPY: Record<
  ChestReward,
  { title: string; detail: string; Icon: LucideIcon }
> = {
  pickaxe: {
    title: "Picareta",
    // Post-playtest: it used to say "uma parede marcada". Nothing is marked any
    // more, and the copy has to say what the player can actually do — open ONE
    // wall, any wall — without hinting at which.
    detail: "Abra uma parede do labirinto. Só uma.",
    Icon: Pickaxe,
  },
  "second-chance": {
    title: "Segunda Chance",
    detail: "Sobreviva a uma captura.",
    Icon: Undo2,
  },
};

const DIRECTION_LABEL: Record<"up" | "down" | "left" | "right", string> = {
  up: "acima",
  down: "abaixo",
  left: "à esquerda",
  right: "à direita",
};

function RouteWorldMark() {
  return (
    <svg
      className="rsg-world-mark"
      viewBox="0 0 72 72"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 57c5-14 15-10 19-22 4-11 11-16 23-20"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="3 7"
      />
      <circle cx="16" cy="56" r="5" fill="currentColor" />
      <circle cx="34" cy="35" r="4" fill="currentColor" />
      <path
        d="M48 31V18c0-8 5-13 12-13s12 5 12 13v24H48V31Z"
        transform="translate(-8 7) scale(.84)"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="m52 48 8 8 8-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Rota Estratégica as a premium tabletop board game. All gameplay (maze,
 * guardian, movement, win/loss, scoring, completion) lives in `useEscapeMaze`,
 * extracted verbatim from the original; this component is a pure premium view.
 */
export function RouteStrategyGame({
  onComplete,
  onExit,
  initialRouteNumber,
  initialDifficulty,
  onEntryReady,
  onEntryError,
}: GameComponentProps) {
  const reducedMotion = useReducedMotion();
  const [detailsOpen, setDetailsOpen] = useState(false);
  /**
   * The wall the player is pointing at, so the board can show WHICH one would
   * open. Pure UX: it exists only while a break affordance is hovered or
   * focused, and it says "this is the target", never "this is the good target".
   */
  const [aimedWall, setAimedWall] = useState<string | null>(null);
  const detailsTriggerRef = useRef<HTMLButtonElement>(null);
  const game = useEscapeMaze(onComplete, initialRouteNumber, initialDifficulty);
  const {
    difficulty,
    routeNumber,
    routeProgression,
    mazeMap,
    walls,
    player,
    guardian,
    sentinel,
    sentinelTarget,
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
    chestOpened,
    rewardSelected,
    rewardChoicePending,
    pickaxeAvailable,
    pickaxeSpent,
    secondChanceAvailable,
    secondChanceSpent,
    brokenWall,
    breakTargets,
    startGame,
    restartGame,
    continueJourney,
    changeDifficulty,
    tryMovePlayer,
    chooseReward,
    breakWall,
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
            !walls.has(posKey(p)),
        )
        .map(posKey),
    );
  }, [status, player, walls]);

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
            !walls.has(posKey(p)),
        )
        .map(posKey),
    );
  }, [status, guardian, walls]);

  const positiveMessages = new Set([
    "Luz-chave coletada.",
    "Portal ativado! Vá até a saída.",
    "Baú encontrado. Escolha a sua ferramenta.",
    "Picareta na mão. Você pode abrir uma parede — só uma.",
    "Segunda Chance guardada. Você resiste a uma captura.",
    "Parede aberta. O caminho novo serve para todos.",
    "Segunda Chance: você resistiu e não avançou.",
    "Segunda Chance: você resistiu e os defensores recuaram.",
  ]);
  const warnMessages = new Set([
    "Este caminho tem um obstáculo. Observe o próximo passo.",
    "O Caçador está próximo. Pense no próximo caminho.",
    "Caminho bloqueado. Escolha outra direção.",
    "Parede no caminho. A Picareta pode abri-la.",
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
  const remainingLights = Math.max(totalLights - collectedCount, 0);
  const nextRouteNumber = routeNumber + 1;
  const currentObjective = (() => {
    if (status === "won") {
      return {
        Icon: CircleCheck,
        title: `Rota ${routeNumber} concluída`,
        detail: `A Rota ${nextRouteNumber} fica dispon\u00edvel quando quiser continuar.`,
        className: "is-complete",
      };
    }
    if (status === "lost") {
      return {
        Icon: Sparkles,
        title: `Rota ${routeNumber} registrada`,
        detail: "Você pode observar uma nova rota no seu ritmo.",
        className: "is-resting",
      };
    }
    if (status !== "playing") {
      return {
        Icon: Gauge,
        title: `Rota ${routeNumber}: ${routeProgression.label}`,
        detail: routeProgression.description,
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
        detail: `${routeProgression.label}. As luzes douradas mostram o caminho.`,
        className: "is-lights",
      };
    }
    return {
      Icon: DoorOpen,
      title: "Siga até o portal verde",
      detail: `${routeProgression.label}. Agora a saída está pronta para receber você.`,
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

  const essentialHudItems: Array<{
    key: string;
    label: string;
    value: string | number;
    Icon: LucideIcon;
    className?: string;
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
      value: portalActive ? "Disponível" : "Bloqueado",
      Icon: DoorOpen,
      className: portalActive ? "rsg-hud-portal-active" : "rsg-hud-portal-locked",
    },
    {
      key: "bau",
      label: "Baú",
      value: pickaxeAvailable
        ? "Picareta"
        : pickaxeSpent
          ? "Picareta usada"
          : secondChanceAvailable
            ? "2ª Chance"
            : secondChanceSpent
              ? "2ª Chance usada"
              : rewardChoicePending
                ? "Escolha"
                : "No mapa",
      Icon: pickaxeAvailable
        ? Pickaxe
        : secondChanceAvailable
          ? Undo2
          : Package,
      className: pickaxeAvailable || secondChanceAvailable
        ? "rsg-hud-reward-active"
        : rewardSelected !== null
          ? "rsg-hud-reward-spent"
          : undefined,
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
    { label: "Caçador", Icon: Shield },
    { label: "Sentinela", Icon: ShieldPlus },
    { label: "Saída", Icon: DoorOpen },
    { label: "Luz", Icon: Sun },
    { label: "Armadilha", Icon: TriangleAlert },
    { label: "Baú", Icon: Package },
    // Post-playtest: there is no "cracked wall" symbol on the board any more.
    // Every wall is a possible target, so the legend says what a wall IS, not
    // which ones are special.
    { label: "Parede", Icon: BrickWall },
    { label: "Bloqueio", Icon: Box },
  ];

  const closeDetails = () => {
    setDetailsOpen(false);
    requestAnimationFrame(() => detailsTriggerRef.current?.focus());
  };

  const handleDetailsKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    closeDetails();
  };

  return (
    <div
      className="rsg-shell wms-world-shell"
      data-world-scene="route"
      style={getWorldMasterSceneStyle("escape-maze", "game-shell")}
    >
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
          <div className="rsg-top-hud" aria-label="Informações essenciais da rota">
            {essentialHudItems.map(({ key, label, value, Icon, className }) => (
              <span
                key={key}
                className={`rsg-hud-token ${className ?? ""}`}
              >
                <Icon className="rsg-hud-icon" aria-hidden />
                <em>{label}</em>
                <strong>{value}</strong>
              </span>
            ))}
          </div>
          <button
            ref={detailsTriggerRef}
            type="button"
            className="rsg-details-trigger"
            aria-expanded={detailsOpen}
            aria-controls="route-details-panel"
            onClick={() => setDetailsOpen((open) => !open)}
          >
            <Info className="h-5 w-5" aria-hidden />
            Detalhes da rota
            <ChevronDown className="rsg-details-chevron h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="rsg-plaque rsg-signature wms-plate">
          <RouteWorldMark />
          <span className="rsg-signature-copy">
            <h1 className="rsg-plaque-text">Rota Estratégica</h1>
            <small>Observe o caminho. Escolha o próximo passo.</small>
          </span>
        </div>

        <section
          className={`rsg-current-objective ${currentObjective.className}`}
          aria-label="Objetivo atual da rota"
        >
          <CurrentObjectiveIcon className="rsg-current-objective-icon" aria-hidden />
          <span>
            <em>Objetivo atual</em>
            <strong>{currentObjective.title}</strong>
            <small
              className={`rsg-objective-message rsg-objective-message-${statusVariant}`}
              role="status"
              aria-live="polite"
            >
              {message}
            </small>
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
                aria-label="Tabuleiro 3D da rota: o explorador é você, o Caçador encapuzado persegue pelo tabuleiro, o Sentinela em teal guarda a região do portal, o portal é a saída e as luzes douradas o ativam."
              >
                {USE_BABYLON_ROUTE_BOARD ? (
                  <RouteBabylonBoard
                    mazeMap={mazeMap}
                    walls={walls}
                    collectedSet={collectedSet}
                    player={player}
                    guardian={guardian}
                    sentinel={sentinel}
                    sentinelCommitted={sentinelTarget !== null}
                    moveTargets={moveTargets}
                    triggeredTrapSet={triggeredTrapSet}
                    chestOpened={chestOpened}
                    breakTargets={breakTargets.map(({ cell }) => posKey(cell))}
                    aimedWall={aimedWall}
                    brokenWall={brokenWall}
                    dangerTiles={dangerTiles}
                    reducedMotion={Boolean(reducedMotion)}
                    status={status}
                    onMove={tryMovePlayer}
                    onReady={onEntryReady}
                    onError={onEntryError}
                  />
                ) : (
                  <RouteBoardScene
                    walls={walls}
                    exitPosition={mazeMap.exitPosition}
                    stars={mazeMap.collectibleStars}
                    collectedSet={collectedSet}
                    player={player}
                    guardian={guardian}
                    sentinel={sentinel}
                    moveTargets={moveTargets}
                    traps={mazeMap.traps}
                    triggeredTrapSet={triggeredTrapSet}
                    chest={mazeMap.chest}
                    chestOpened={chestOpened}
                    breakTargets={breakTargets.map(({ cell }) => posKey(cell))}
                    aimedWall={aimedWall}
                    brokenWall={brokenWall}
                    dangerTiles={dangerTiles}
                    reducedMotion={Boolean(reducedMotion)}
                    onMove={tryMovePlayer}
                  />
                )}
              </div>
            </motion.div>

          </div>

          <div className="rsg-control-col">
            {!detailsOpen && status === "setup" && (
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
                  className="rsg-cta wms-button-primary"
                >
                  <Play className="h-6 w-6 fill-current" aria-hidden />
                  Iniciar rota
                </button>
              </section>
            )}

            {!detailsOpen && status === "playing" && rewardChoicePending && (
              <section
                className="rsg-panel rsg-reward-panel"
                role="group"
                aria-label="Escolha a recompensa do baú"
              >
                <p className="rsg-panel-title">
                  <Package className="h-5 w-5" aria-hidden />
                  O baú abriu. Escolha uma.
                </p>
                <div className="rsg-reward-grid">
                  {(["pickaxe", "second-chance"] as ChestReward[]).map((reward) => {
                    const { title, detail, Icon } = REWARD_COPY[reward];
                    return (
                      <button
                        key={reward}
                        type="button"
                        autoFocus={reward === "pickaxe"}
                        onClick={() => chooseReward(reward)}
                        aria-label={`Escolher ${title}: ${detail}`}
                        className="rsg-reward-btn"
                      >
                        <Icon className="rsg-reward-icon" aria-hidden />
                        <strong>{title}</strong>
                        <em>{detail}</em>
                      </button>
                    );
                  })}
                </div>
                <p className="rsg-reward-note">
                  A outra ferramenta fica no baú. Nesta rota, só uma vem com você.
                </p>
              </section>
            )}

            {!detailsOpen && status === "playing" && !rewardChoicePending && (
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
                {/*
                  ROTA-CHEST-REWARDS-01 §15/§17/§18 (revisão pós-playtest): one
                  button per ADJACENT WALL — any wall, not a marked subset. It is
                  always an explicit tap; walking into a wall never consumes the
                  Pickaxe.

                  Each button names its direction, so two adjacent walls are two
                  distinguishable choices and nothing is decided by array order.
                  Pointing at a button aims at that wall on the board (§16): a
                  VALID target is control information, and showing it is fine —
                  what the game must never say is which target is a GOOD one.
                */}
                {breakTargets.length > 0 && (
                  <div className="rsg-break-actions" role="group" aria-label="Ação da Picareta">
                    {breakTargets.map(({ direction, cell }) => (
                      <button
                        key={posKey(cell)}
                        type="button"
                        onClick={() => breakWall(cell)}
                        onPointerEnter={() => setAimedWall(posKey(cell))}
                        onPointerLeave={() => setAimedWall(null)}
                        onFocus={() => setAimedWall(posKey(cell))}
                        onBlur={() => setAimedWall(null)}
                        aria-label={`Quebrar a parede ${DIRECTION_LABEL[direction]}. Gasta a Picareta e custa um turno.`}
                        className="rsg-break-btn"
                      >
                        <Pickaxe className="h-5 w-5" aria-hidden />
                        Quebrar parede
                        <em>{DIRECTION_LABEL[direction]}</em>
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            <section
              id="route-details-panel"
              className="rsg-route-details"
              hidden={!detailsOpen}
              aria-label="Detalhes da rota"
              onKeyDown={handleDetailsKeyDown}
            >
              <header className="rsg-route-details-header">
                <span>
                  <Info className="h-5 w-5" aria-hidden />
                  <strong>Detalhes da rota</strong>
                </span>
                <button
                  type="button"
                  className="rsg-details-close"
                  aria-label="Fechar detalhes da rota"
                  onClick={closeDetails}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </header>

              <p className="rsg-route-context">
                Rota {routeNumber}: {currentObjective.detail}
              </p>

              <div className="rsg-stats rsg-secondary-stats" aria-label="Registro da rota">
                {sideStatItems.map(({ key, label, value, Icon, className }) => (
                  <span key={key} className={`rsg-stat ${className ?? ""}`}>
                    <Icon className="rsg-stat-icon" aria-hidden />
                    <em>{label}</em>
                    <strong>{value}</strong>
                  </span>
                ))}
              </div>

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
                  <Package className="h-4 w-4" aria-hidden />
                  O baú é opcional: escolha uma ferramenta, só uma.
                </span>
              </div>

              <p className="rsg-details-note">
                Use os botões de direção ou as setas do teclado. Os contornos
                âmbar mostram até onde o Caçador pode chegar no próximo passo.
              </p>

              <ul className="rsg-legend rsg-details-legend" aria-label="Legenda do tabuleiro">
                {legendItems.map(({ label, Icon }) => (
                  <li key={label}>
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>

              {status === "playing" && (
                <button
                  type="button"
                  onClick={restartGame}
                  aria-label="Começar outra rota"
                  className="rsg-btn rsg-details-restart wms-button-secondary"
                >
                  <RotateCcw className="h-5 w-5" aria-hidden />
                  Começar outra rota
                </button>
              )}
            </section>

            {(status === "won" || status === "lost") && (
              <button
                type="button"
                onClick={continueJourney}
                aria-label="Explorar próxima rota"
                className="rsg-btn rsg-next-route-btn wms-button-secondary"
              >
                <Sparkles className="h-5 w-5" aria-hidden />
                {status === "won" ? "Explorar próxima rota" : "Começar uma nova rota"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
