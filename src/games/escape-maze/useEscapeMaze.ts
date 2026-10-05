"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { manhattanDistance } from "@/engine/difficulty";
import { calculateEscapeMazeScore } from "@/engine/scoring";
import { nextJourneyRoute } from "@/games/escape-maze/continuation";
import {
  COLS,
  ROWS,
  getRouteProgression,
  type RouteProgression,
} from "@/games/escape-maze/route-config";
import {
  SENTINEL_COMMIT_TURNS,
  chooseGuardianMove,
  computePortalDefenceZone,
  createSentinelState,
  decideSentinelMove,
  type PortalDefenceZone,
  type SentinelState,
} from "@/games/escape-maze/route-defenders";
import {
  generateMaze,
  type MazeMap,
} from "@/games/escape-maze/route-generation";
import { posKey, positionsEqual } from "@/games/escape-maze/route-geometry";
import {
  inspectDynamicMazeState,
  type ChestReward,
  type DynamicMazeStateSnapshot,
  type DynamicSolvabilityInspection,
  type GameStatus,
} from "@/games/escape-maze/route-invariants";
// ROUTE-C5: the session's mutable state is one value, `RouteRuntimeState`,
// changed only by `routeStateReducer`. The hook holds it with `useReducer`,
// computes every derived view from the state, and runs the sounds and
// `onComplete`. Nothing outside the hook sees route-state.ts: the returned
// object is the same, field for field.
// ROUTE-C7B: that value is now the `route` of the hook's `RouteSessionState`
// (route-session.ts), beside where the generation of its next board stands;
// `routeSessionReducer` hands the match's own transitions to `routeStateReducer`.
import {
  createRouteSessionState,
  routeSessionReducer,
  type RouteGenerationIntent,
} from "@/games/escape-maze/route-session";
// ROUTE-C7B: boards are asked for, and arrive later, through the generation
// client (route-generation-client.ts → the C7A job). The hook never calls
// `generateMaze` itself, and does not know where a generation runs.
import {
  routeGenerationExecutor,
  startRouteGeneration,
} from "@/games/escape-maze/route-generation-client";
import type { RouteRuntimeState } from "@/games/escape-maze/route-state";
// ROUTE-C6: the hook says what happened — a `RouteDomainEvent` — and
// route-events.ts translates it into the C5 transitions that record it. The
// hook still runs the turn: it decides which events happen, in what order and
// with what values, and applies each through `applyDomainEvent`, the one place
// the state is written. Events are not stored, queued or published, and no
// component knows them.
import {
  routeStateActionsForEvent,
  type RouteDomainEvent,
} from "@/games/escape-maze/route-events";
import {
  playGentleErrorTone,
  playStoneBreak,
  playSuccessChime,
} from "@/lib/game-sounds";
import type {
  DifficultyLevel,
  GameResult,
  GridPosition,
} from "@/types/game";

/**
 * Rota Estratégica (escape-maze) game logic, extracted verbatim from the
 * original `EscapeMazeGame` so maze generation, templates, wall randomization,
 * player/guardian movement, difficulty behaviour, win/loss, scoring, blocked
 * moves, errors, stars, restart, arrow-key support and the `onComplete`
 * contract are all preserved exactly. The premium presentation is a pure view
 * over this state.
 */

// ROUTE-C1: the grid, the generation budget, the templates and the difficulty
// tables are declared in route-config.ts and only consumed here. The hook's
// public surface is unchanged: the Rota component and the board still read
// ROWS/COLS from it, and `routeProgression` is still a RouteProgression.
export { COLS, ROWS };
export type { RouteProgression };

// ROUTE-C2: maps are made and certified in route-generation.ts, and the board's
// graph primitives (keys, neighbours, distances, paths) live in
// route-geometry.ts, which the defenders (route-defenders.ts since ROUTE-C3)
// and the invariants (route-invariants.ts since ROUTE-C4) also walk the board
// with. The hook only asks
// `generateMaze(difficulty, routeNumber)` for a certified map — since ROUTE-C7B
// through the generation client, never by calling it. What other modules
// import from here is re-exported as it was.
export { generateMaze, posKey, positionsEqual };
export type { MazeMap };

// ROUTE-C3: how the Hunter and the Sentinel decide lives in route-defenders.ts
// — the portal zone, the Sentinel's post and its contract-c3 move, the Hunter's
// trap-aware move. The hook still runs the turn: `runDefenderPhase` asks both
// for a move and then commits it, rolls it back for a Second Chance or ends the
// route. What other modules import from here is re-exported as it was;
// `chooseGuardianMove` stays out of the hook's surface, as it always was.
export { computePortalDefenceZone, createSentinelState, decideSentinelMove };
export type { PortalDefenceZone, SentinelState };

// ROUTE-C4: whether a logical state of the Rota is possible, and whether every
// unfinished objective can still be reached on the current walls, is answered by
// route-invariants.ts — `inspectDynamicMazeState`, its snapshot and its verdict,
// with the state's own vocabulary (`GameStatus`, `ChestReward`) that the
// snapshot is written in. The hook still decides when to ask: the returned
// `dynamicSolvability` is computed from the state it holds, on every render, as
// before. What other modules import from here is re-exported as it was.
export { inspectDynamicMazeState };
export type {
  ChestReward,
  DynamicMazeStateSnapshot,
  DynamicSolvabilityInspection,
  GameStatus,
};

const ARROW_DELTAS: Record<string, GridPosition> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

/** A direction is how the player names a wall, so it is how the Pickaxe aims. */
export type BreakDirection = "up" | "down" | "left" | "right";

const BREAK_DIRECTION_DELTAS: Record<BreakDirection, GridPosition> = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};

/** One adjacent wall the Pickaxe may open, named by the direction it lies in. */
export interface BreakTarget {
  direction: BreakDirection;
  cell: GridPosition;
}

/**
 * Janela mínima entre duas ações de movimento aceitas (ms). "Pensar em paz"
 * exige que um único gesto do Explorador conte como UMA ação: isto absorve
 * despachos duplicados do mesmo gesto (eventos enfileirados, cliques
 * fantasmas, toque+teclado no mesmo instante) sem travar o jogo — a janela é
 * curta demais para ser percebida num jogo por turnos.
 */
const MOVE_INPUT_GUARD_MS = 150;

type CompleteFn = (result: Omit<GameResult, "id" | "playedAt">) => void;

/**
 * What the defenders' half of a turn needs to know. It is passed explicitly
 * rather than read from state because a turn can resolve at three different
 * moments — a normal step, the resumption after a reward choice, and a wall
 * break — and in two of those the state React holds is deliberately not the
 * state the defenders must answer to.
 */
interface DefenderPhaseInput {
  playerPosition: GridPosition;
  guardianFrom: GridPosition;
  sentinelFrom: SentinelState;
  /** The board the defenders see. Already open when a wall was just broken. */
  graphWalls: Set<string>;
  zone: PortalDefenceZone;
  armedTraps: Set<string>;
  turnNumber: number;
  errorsSoFar: number;
  starsCollected: number;
  trapsTriggeredCount: number;
  chestOpenedNow: boolean;
  rewardNow: ChestReward | null;
  rewardSpentNow: boolean;
  brokenWallNow: string | null;
  /** True only while an unspent Second Chance is held. */
  secondChanceReady: boolean;
  /**
   * What to say when the turn ends without anyone being caught. A function
   * because the step's own message ranks against how close the Hunter ended up,
   * and that is only known once the defenders have answered.
   */
  calmMessage: (guardianAfter: GridPosition) => string;
}

/**
 * ROTA-CHEST-REWARDS-01 — Second Chance, resolved by undoing the move that
 * produced the overlap.
 *
 * Whoever stepped into the other's cell goes back to the cell it occupied when
 * this turn began, and the turn ends there. When a defender was the one who
 * stepped in, BOTH defenders go back — not as a favour, but because it is the
 * only phrasing that cannot produce an overlap: every piece returns to a cell
 * that only it occupied at the start of the turn, and those three cells were
 * distinct.
 *
 * The turn is still counted and the charge is still spent, so nothing here
 * hands the Explorer a second action.
 */
const SECOND_CHANCE_EXPLORER_MESSAGE =
  "Segunda Chance: você resistiu e não avançou.";
const SECOND_CHANCE_DEFENDER_MESSAGE =
  "Segunda Chance: você resistiu e os defensores recuaram.";

/**
 * The Sentinel's post on a board nobody has played yet. Computed from the map's
 * own walls — nothing is broken on a new board — rather than read from the
 * hook's portal-zone memo, which still holds the previous map on the render a
 * restart happens in. Pure: no RNG.
 */
function sentinelPostOn(map: MazeMap): SentinelState {
  return createSentinelState(
    map,
    computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls),
  );
}

/** Turn-based maze escape: reach the exit before the guardian catches you. */
export function useEscapeMaze(
  onComplete: CompleteFn,
  initialRouteNumber = 1,
  /**
   * ROTA-DIFFICULTY-04B: the mode a continuing journey arrives on.
   *
   * Progression remounts this hook, so the player's choice used to die with the
   * previous instance and every Route after the first began on the default. The
   * caller now hands it back, from the same continuation the Route comes from.
   *
   * Omitted for a fresh entry, which is what keeps a new journey from
   * inheriting the mode of an old one — see `openActivity` in `app/page.tsx`.
   */
  initialDifficulty: DifficultyLevel = "easy",
) {
  const normalizedInitialRouteNumber = Math.max(
    1,
    Math.floor(initialRouteNumber),
  );
  /**
   * The Route this session plays, fixed for the session's whole life. Nothing in
   * the hook advances it: the next Route is a new session, opened from the
   * continuation `endGame` writes (ROUTE-JOURNEY-OWNERSHIP-01). It is the
   * session's identity, not part of its mutable state, so it stays out of the
   * reducer (ROUTE-C5).
   */
  const [routeNumber] = useState(normalizedInitialRouteNumber);

  /**
   * ROUTE-C5 — the session's whole mutable state, one value (route-state.ts).
   *
   * ROUTE-C7B — held as the `route` of `RouteSessionState` (route-session.ts),
   * beside where the generation of the next board stands. The initialiser no
   * longer draws a board: it asks for one (request 1, "mount"), and the match
   * is null until that board is accepted — there is no stand-in map. Pure, so
   * development Strict Mode calling it twice changes nothing.
   */
  const [state, dispatch] = useReducer(
    routeSessionReducer,
    initialDifficulty,
    createRouteSessionState,
  );
  const { route, generation } = state;
  /**
   * ROUTE-C7B: a board is being generated, or its generation failed. Until the
   * next one is accepted the match is frozen — no step, no reward, no wall, no
   * defender, no end of Route, no runtime draw — whatever is on screen.
   */
  const awaitingRoute = generation.phase !== "ready";
  /** The mode a pending or failed generation is for; null once it has arrived. */
  const requestedDifficulty =
    generation.phase === "ready" ? null : generation.target.difficulty;

  /**
   * ROUTE-C6 — the one place the session's state is written: an event that has
   * already happened, recorded by the transitions route-events.ts gives for it,
   * dispatched in that order. An event that records nothing of its own (a light,
   * the portal, a trap — the step already wrote them) dispatches nothing, so it
   * can never cause a render.
   */
  const applyDomainEvent = useCallback((event: RouteDomainEvent) => {
    for (const action of routeStateActionsForEvent(event)) dispatch(action);
  }, []);

  /**
   * A new Route session on a board that has just been accepted.
   *
   * ROUTE-C7B: this used to generate the board itself, on its first line. It
   * now receives it — accepted by the generation client, the seeded stream
   * already continued — and applies exactly the event it always applied.
   */
  const startNewMaze = useCallback(
    (
      nextMap: MazeMap,
      nextDifficulty: DifficultyLevel,
      nextStatus: GameStatus,
      nextRouteNumber = routeNumber,
    ) => {
      // One transition, one coherent state: the new board on the mode it was
      // generated for, the pieces on their starts, every counter at zero,
      // nothing collected or armed. The Sentinel is rebuilt from the new map,
      // so no commitment survives a restart or a route change.
      // ROTA-CHEST-REWARDS-01 §19/§21: a new route restores the board and the
      // decision. Broken walls close again because they were never written to
      // the map definition — `brokenWall` is the only thing that opened them.
      applyDomainEvent({
        type: "ROUTE_STARTED",
        routeNumber: nextRouteNumber,
        difficulty: nextDifficulty,
        mazeMap: nextMap,
        sentinel: sentinelPostOn(nextMap),
        status: nextStatus,
        message:
          nextStatus === "playing"
            ? `${getRouteProgression(nextRouteNumber).label}: observe a rota e colete as luzes.`
            : "Escolha o modo e inicie no seu ritmo.",
      });
    },
    [routeNumber, applyDomainEvent],
  );

  /**
   * ROUTE-C7B — the generation lifecycle: whenever a board is pending, ask the
   * generation client for it; when it arrives, open the session on it.
   *
   * The effect is keyed on the pending generation itself, so the rules come
   * from React's own effect lifecycle rather than from bookkeeping:
   *
   *  - latest wins: a new request is a new `generation`, and the cleanup of the
   *    previous effect withdraws the previous request first — cancelled for
   *    real if it had not run, ignored if it had;
   *  - unmount, leaving the Rota, Strict Mode's mount → cleanup → mount: the
   *    cleanup withdraws, and only the generation the CURRENT effect asked for
   *    can reach this state. Each withdraw is its own token, so an instance's
   *    answer can never reach the next instance, whatever their request ids;
   *  - nothing is accepted before that check: the client continues the seeded
   *    stream (`acceptRouteGenerationResult`) only for a live request.
   *
   * It owns scheduling, cancelling, accepting and failing a generation —
   * infrastructure. Sounds, `onComplete`, scoring and the turn's events stay
   * where they were; an arriving board is the same ROUTE_STARTED as before.
   */
  useEffect(() => {
    if (generation.phase !== "pending") return;
    const { target } = generation;
    return startRouteGeneration(
      routeGenerationExecutor,
      {
        requestId: target.requestId,
        intent: target.intent,
        difficulty: target.difficulty,
        routeNumber,
      },
      {
        onReady: (nextMap) => {
          if (target.intent === "mount") {
            // The mount's board is the session's starting value, as the
            // reducer's initialiser made it before C7B: not an event.
            dispatch({
              type: "INITIAL_ROUTE",
              difficulty: target.difficulty,
              mazeMap: nextMap,
              sentinel: sentinelPostOn(nextMap),
              status: target.status,
              message: "Escolha a dificuldade e inicie.",
            });
            return;
          }
          startNewMaze(nextMap, target.difficulty, target.status);
        },
        onFailed: () =>
          dispatch({ type: "GENERATION_FAILED", requestId: target.requestId }),
      },
    );
  }, [generation, routeNumber, startNewMaze]);

  /** Ask for a new board. Whatever was pending or failed is superseded. */
  const requestNewMaze = useCallback(
    (
      intent: RouteGenerationIntent,
      nextDifficulty: DifficultyLevel,
      nextStatus: "setup" | "playing",
    ) => {
      dispatch({
        type: "GENERATION_REQUESTED",
        intent,
        difficulty: nextDifficulty,
        status: nextStatus,
      });
    },
    [],
  );

  /** The failed generation again: a new request, the same mode, Route and intent. */
  const retryGeneration = useCallback(() => {
    dispatch({ type: "GENERATION_RETRIED" });
  }, []);

  // ROUTE-C7B: every view below is derived from the match, and before the
  // mount's first board there is no match — each is null then, never a
  // stand-in. Once a board is accepted none of them is null again.
  const boardMap = route === null ? null : route.mazeMap;
  const boardBrokenWall = route === null ? null : route.brokenWall;

  /**
   * The board as it stands right now.
   *
   * A broken wall is simply not a wall any more — for the Explorer, the Hunter
   * and the Sentinel alike, because every walkability question in this file goes
   * through `getNeighbors` on one set. With nothing broken this IS
   * `mazeMap.walls`, the same object, so every pre-chest behaviour is untouched
   * by identity rather than by comparison.
   */
  const walls = useMemo(() => {
    if (boardMap === null) return null;
    if (boardBrokenWall === null) return boardMap.walls;
    const opened = new Set(boardMap.walls);
    opened.delete(boardBrokenWall);
    return opened;
  }, [boardMap, boardBrokenWall]);

  // The Sentinel's region follows the board, so a broken wall reshapes its
  // territory the same way a differently-generated map would have.
  const portalDefenceZone = useMemo(
    () =>
      boardMap === null || walls === null
        ? null
        : computePortalDefenceZone(
            boardMap.playerStart,
            boardMap.exitPosition,
            walls,
          ),
    [boardMap, walls],
  );

  // Carimbo do último input de movimento processado (teclado, D-pad ou toque).
  // Ref (não estado): nunca re-renderiza e se solta sozinho com o tempo.
  const lastMoveInputAtRef = useRef(0);

  const boardCollectedStars = route === null ? null : route.collectedStars;
  const boardTriggeredTraps = route === null ? null : route.triggeredTraps;
  const collectedSet = useMemo(
    () => (boardCollectedStars === null ? null : new Set(boardCollectedStars)),
    [boardCollectedStars],
  );
  const triggeredTrapSet = useMemo(
    () => (boardTriggeredTraps === null ? null : new Set(boardTriggeredTraps)),
    [boardTriggeredTraps],
  );

  const boardStatus = route === null ? null : route.status;
  const boardPlayer = route === null ? null : route.player;
  const boardChoicePending =
    route !== null && route.chestOpened && route.rewardSelected === null;
  const boardPickaxeAvailable =
    route !== null && route.rewardSelected === "pickaxe" && !route.rewardSpent;
  /**
   * The walls the Explorer could open from where it stands.
   *
   * ROTA-CHEST-REWARDS-01 (revisão pós-playtest): this used to be an
   * intersection with a certified set. It is now simply "the walls next to me",
   * because every internal wall of the maze is a legal target and the whole
   * difficulty of the Pickaxe is choosing which one.
   *
   * The four orthogonal neighbours are walked in a fixed order — up, down, left,
   * right — so the list the view renders never depends on iteration order of a
   * set, and two adjacent walls always appear in the same two places.
   *
   * Empty whenever the action is unavailable — and while a board is being
   * generated (ROUTE-C7B) — so the view has nothing to decide.
   */
  const breakTargets = useMemo(() => {
    if (
      awaitingRoute ||
      boardStatus !== "playing" ||
      boardChoicePending ||
      !boardPickaxeAvailable ||
      walls === null ||
      boardPlayer === null
    ) {
      return [];
    }
    return (["up", "down", "left", "right"] as const)
      .map((direction) => ({
        direction,
        cell: {
          row: boardPlayer.row + BREAK_DIRECTION_DELTAS[direction].row,
          col: boardPlayer.col + BREAK_DIRECTION_DELTAS[direction].col,
        },
      }))
      .filter(
        ({ cell }) =>
          cell.row >= 0 &&
          cell.row < ROWS &&
          cell.col >= 0 &&
          cell.col < COLS &&
          walls.has(posKey(cell)),
      );
  }, [
    awaitingRoute,
    boardStatus,
    boardChoicePending,
    boardPickaxeAvailable,
    walls,
    boardPlayer,
  ]);

  const routeProgression = useMemo(
    () => getRouteProgression(routeNumber),
    [routeNumber],
  );

  const endGame = useCallback(
    (
      won: boolean,
      finalStats: {
        turns: number;
        blockedMoves: number;
        errors: number;
        difficulty: DifficultyLevel;
        routeNumber: number;
        routeStageLabel: string;
        starsCollected: number;
        totalStars: number;
        trapsTriggered: number;
        chestOpened: boolean;
        reward: ChestReward | null;
        rewardSpent: boolean;
        wallBroken: boolean;
      },
    ) => {
      // ROUTE-JOURNEY-TERMINAL-01: the journey has an end. Before the last
      // Route the next one opens, won or lost; the last one lost opens again;
      // the last one won completes the journey and opens nothing.
      const nextRouteNumber = nextJourneyRoute(finalStats.routeNumber, won);
      const journeyCompleted = nextRouteNumber === undefined;
      const retriesRoute = nextRouteNumber === finalStats.routeNumber;

      if (won) {
        playSuccessChime();
        applyDomainEvent({
          type: "ROUTE_ENDED",
          outcome: "won",
          turn: finalStats.turns,
          journeyCompleted,
          message: journeyCompleted
            ? "O caminho foi aberto. A jornada da Rota Estrat\u00e9gica est\u00e1 completa."
            : "O caminho foi aberto. A pr\u00f3xima rota fica dispon\u00edvel quando quiser.",
        });
      } else {
        playGentleErrorTone();
        applyDomainEvent({
          type: "ROUTE_ENDED",
          outcome: "lost",
          turn: finalStats.turns,
          journeyCompleted,
          message: "Rota registrada. Voc\u00ea pode observar outro caminho com calma.",
        });
      }
      onComplete({
        activityId: "escape-maze",
        activityTitle: "Rota Estratégica",
        gameId: "escape-maze",
        score: calculateEscapeMazeScore({
          won,
          turns: finalStats.turns,
          blockedMoves: finalStats.blockedMoves,
          errors: finalStats.errors,
          starsCollected: finalStats.starsCollected,
          difficulty: finalStats.difficulty,
        }),
        summary: won
          ? `Voc\u00ea abriu o caminho da Rota ${finalStats.routeNumber} em ${finalStats.turns} turnos e coletou ${finalStats.starsCollected} ${
              finalStats.starsCollected === 1 ? "luz" : "luzes"
            }. ${
              journeyCompleted
                ? "A jornada da Rota Estrat\u00e9gica est\u00e1 completa."
                : `A Rota ${nextRouteNumber} espera por voc\u00ea no seu ritmo.`
            }`
          : retriesRoute
            ? `A Rota ${finalStats.routeNumber} foi registrada. Voc\u00ea pode tentar a Rota ${finalStats.routeNumber} de novo, com calma, quando quiser.`
            : `A Rota ${finalStats.routeNumber} foi registrada. A Rota ${nextRouteNumber} pode ser explorada com calma quando voc\u00ea quiser.`,
        details: {
          turns: finalStats.turns,
          won,
          starsCollected: finalStats.starsCollected,
          totalStars: finalStats.totalStars,
          blockedMoves: finalStats.blockedMoves,
          errors: finalStats.errors,
          difficulty: finalStats.difficulty,
          routeNumber: finalStats.routeNumber,
          routeStage: finalStats.routeStageLabel,
          // The Route "play again" opens — the next one, or this one again
          // when the last Route was lost. A completed journey has none, so it
          // records that instead of a Route that does not exist.
          ...(journeyCompleted
            ? { journeyCompleted: true }
            : {
                nextRouteNumber,
                nextRouteStage: getRouteProgression(nextRouteNumber).label,
              }),
          // Additive optional fields (Gameplay 2.0); old results simply omit them.
          trapsTriggered: finalStats.trapsTriggered,
          chestOpened: finalStats.chestOpened,
          rewardChosen:
            finalStats.reward === "pickaxe"
              ? "Picareta"
              : finalStats.reward === "second-chance"
                ? "Segunda Chance"
                : "Nenhuma",
          rewardSpent: finalStats.rewardSpent,
          wallBroken: finalStats.wallBroken,
        },
        // What "play again" opens: the Route `nextJourneyRoute` decided, on the
        // mode this one was played on. This is the only place a continuation
        // is written; the shell opens it as a new session. A completed journey
        // writes none — there is nothing left to resume. `details` keeps
        // `nextRouteNumber` / `journeyCompleted` and `difficulty` for the
        // result screen and history; nothing reads them to decide that.
        ...(nextRouteNumber !== undefined && {
          continuation: {
            kind: "escape-maze-route",
            routeNumber: nextRouteNumber,
            difficulty: finalStats.difficulty,
          },
        }),
      });
    },
    [onComplete, applyDomainEvent],
  );

  /**
   * ROUTE-C7B — the match on an accepted board: the turn, and everything the
   * hook hands the Rota for it. Built only once a board exists (`route` and
   * the views derived from it, none null), so before the mount's first board
   * there is no turn at all — nothing to call, nothing to show.
   */
  const playRoute = (
    route: RouteRuntimeState,
    walls: Set<string>,
    portalDefenceZone: PortalDefenceZone,
    collectedSet: Set<string>,
    triggeredTrapSet: Set<string>,
  ) => {
    const {
      difficulty,
      mazeMap,
      player,
      guardian,
      sentinel,
      collectedStars,
      turns,
      blockedMoves,
      errors,
      status,
      message,
      blockedShake,
      moveTick,
      // Gameplay 2.0 state — lives here in the brain, not in the Canvas.
      triggeredTraps,
      // ROTA-CHEST-REWARDS-01: four fields, and everything the product and the
      // future solver need is derived from them. There is no fifth field for "a
      // choice is pending" and no separate spent-flag per reward, because both
      // would be a second copy of something these already say.
      chestOpened,
      rewardSelected,
      rewardSpent,
      brokenWall,
    } = route;

    // --- Chest, derived -------------------------------------------------------
    /** The Chest is open and the Explorer has not decided yet. Nothing may move. */
    const rewardChoicePending = chestOpened && rewardSelected === null;
    const pickaxeAvailable = rewardSelected === "pickaxe" && !rewardSpent;
    const pickaxeSpent = rewardSelected === "pickaxe" && rewardSpent;
    const secondChanceAvailable = rewardSelected === "second-chance" && !rewardSpent;
    const secondChanceSpent = rewardSelected === "second-chance" && rewardSpent;

    const totalLights = mazeMap.collectibleStars.length;
    const collectedCount = collectedStars.length;
    const portalActive = totalLights === 0 || collectedCount >= totalLights;

    const score = calculateEscapeMazeScore({
      won: status === "won",
      turns,
      blockedMoves,
      errors,
      starsCollected: collectedStars.length,
      difficulty,
    });

    const startGame = () => {
      if (awaitingRoute) return;
      requestNewMaze("start", difficulty, "playing");
    };

    /**
     * ROUTE-C7B: allowed while a board is pending or failed — a second Restart
     * replaces the first, on the mode that one was for.
     */
    const restartGame = () => {
      requestNewMaze("restart", requestedDifficulty ?? difficulty, "playing");
    };

    /**
     * Mode is a property of the route being set up, not of the campaign.
     *
     * ROTA-DIFFICULTY-04A: this used to `setRouteNumber(1)` and generate Route 1.
     * That was correct when it was written — in `0d7e7fa` the hook could only ever
     * mount at Route 1, so "back to 1" and "back to where this session started"
     * were the same sentence. Two days later `3bde618` added `initialRouteNumber`
     * so a session could mount straight into Route N, and updated the state
     * INITIALISER without revisiting this line. From then on, a player handed
     * Route 2 and choosing Desafiador silently received Route 1.
     *
     * The route the player was given is preserved. Returning to Route 1 is still
     * possible and still explicit — it is what entering the world from Home does,
     * by mounting a fresh session (`openActivity` → continuation cleared).
     */
    const changeDifficulty = (nextDifficulty: DifficultyLevel) => {
      // ROUTE-C5: the mode arrives with the board generated for it, in the same
      // transition (`START_ROUTE` carries `difficulty`), instead of a separate
      // write React had to batch with the rest.
      // ROUTE-C7B: asked for here, applied when it arrives; a later choice
      // replaces a pending one, so only the last mode chosen can appear.
      requestNewMaze("difficulty", nextDifficulty, "setup");
    };
    /**
     * The defenders' half of a turn: Hunter first, then Sentinel on the state the
     * Hunter has already produced, so the two never resolve a shared destination
     * by render order. Unchanged from 01B except for one thing — when an unspent
     * Second Chance is held, a capture undoes the defenders' answer instead of
     * ending the route.
     *
     * "Undoes" is literal: this function simply does not commit the moves it
     * computed. Every piece therefore stays on the cell it held when the turn
     * began, which is why no overlap is possible — those cells were distinct.
     */
    const runDefenderPhase = (input: DefenderPhaseInput) => {
      const statsAt = (finalErrors: number) => ({
        turns: input.turnNumber,
        blockedMoves,
        errors: finalErrors,
        difficulty,
        routeNumber,
        routeStageLabel: routeProgression.label,
        starsCollected: input.starsCollected,
        totalStars: mazeMap.collectibleStars.length,
        trapsTriggered: input.trapsTriggeredCount,
        chestOpened: input.chestOpenedNow,
        reward: input.rewardNow,
        rewardSpent: input.rewardSpentNow,
        wallBroken: input.brokenWallNow !== null,
      });

      const nextGuardian = chooseGuardianMove(
        input.guardianFrom,
        input.playerPosition,
        mazeMap.exitPosition,
        input.graphWalls,
        difficulty,
        new Set([...input.armedTraps, posKey(input.sentinelFrom.position)]),
      );

      if (positionsEqual(nextGuardian, input.playerPosition)) {
        if (input.secondChanceReady) {
          applyDomainEvent({
            type: "SECOND_CHANCE_USED",
            cause: "hunter",
            turn: input.turnNumber,
            at: input.playerPosition,
            message: SECOND_CHANCE_DEFENDER_MESSAGE,
          });
          return;
        }
        const caughtErrors = input.errorsSoFar + 1;
        // The Hunter steps in; the Sentinel had not moved yet and stays.
        applyDomainEvent({
          type: "EXPLORER_CAPTURED",
          by: "hunter",
          turn: input.turnNumber,
          at: input.playerPosition,
          guardian: nextGuardian,
          sentinel: input.sentinelFrom,
          errors: caughtErrors,
        });
        endGame(false, statsAt(caughtErrors));
        return;
      }

      const nextSentinel = decideSentinelMove(
        input.sentinelFrom,
        input.playerPosition,
        mazeMap.exitPosition,
        input.graphWalls,
        input.zone,
        SENTINEL_COMMIT_TURNS,
        input.armedTraps,
      );
      const sentinelBlocked =
        positionsEqual(nextSentinel.position, nextGuardian) &&
        !positionsEqual(nextSentinel.position, input.sentinelFrom.position);
      const settledSentinel: SentinelState = sentinelBlocked
        ? { ...nextSentinel, position: input.sentinelFrom.position }
        : nextSentinel;

      if (positionsEqual(settledSentinel.position, input.playerPosition)) {
        if (input.secondChanceReady) {
          // The Hunter's move is dropped along with the Sentinel's. Keeping it
          // would be the one case where a piece could land on the cell another is
          // being returned to, and dropping both costs nothing the design wants.
          applyDomainEvent({
            type: "SECOND_CHANCE_USED",
            cause: "sentinel",
            turn: input.turnNumber,
            at: input.playerPosition,
            message: SECOND_CHANCE_DEFENDER_MESSAGE,
          });
          return;
        }
        const caughtErrors = input.errorsSoFar + 1;
        applyDomainEvent({
          type: "EXPLORER_CAPTURED",
          by: "sentinel",
          turn: input.turnNumber,
          at: input.playerPosition,
          guardian: nextGuardian,
          sentinel: settledSentinel,
          errors: caughtErrors,
        });
        endGame(false, statsAt(caughtErrors));
        return;
      }

      applyDomainEvent({
        type: "DEFENDERS_SETTLED",
        turn: input.turnNumber,
        guardian: nextGuardian,
        sentinel: settledSentinel,
        message: input.calmMessage(nextGuardian),
      });
    };

    const tryMovePlayer = (delta: GridPosition) => {
      if (awaitingRoute) return;
      if (status !== "playing") return;
      // ROTA-CHEST-REWARDS-01 §12: while the Chest waits for a decision, nothing
      // else in the game may happen — not a step, not a defender.
      if (rewardChoicePending) return;

      // Um gesto = uma ação: ignora um segundo disparo do MESMO gesto chegando
      // logo atrás do primeiro (qualquer origem de input). Nunca trava: a janela
      // expira sozinha em MOVE_INPUT_GUARD_MS.
      const now = Date.now();
      if (now - lastMoveInputAtRef.current < MOVE_INPUT_GUARD_MS) return;
      lastMoveInputAtRef.current = now;

      const next: GridPosition = {
        row: player.row + delta.row,
        col: player.col + delta.col,
      };
      const nextKey = posKey(next);
      const outOfBoard =
        next.row < 0 || next.row >= ROWS || next.col < 0 || next.col >= COLS;

      if (outOfBoard || walls.has(nextKey)) {
        playGentleErrorTone();
        // §10/§18: walking into a wall never spends the Pickaxe — not even into a
        // wall the Pickaxe could open. It only points at the action that would.
        // The hint says "you could open this one", never "you should".
        applyDomainEvent({
          type: "EXPLORER_STEP_BLOCKED",
          reason: outOfBoard ? "boundary" : "wall",
          cell: next,
          message:
            !outOfBoard && pickaxeAvailable
              ? "Parede no caminho. A Picareta pode abri-la."
              : "Caminho bloqueado. Escolha outra direção.",
        });
        return;
      }

      const nextTurn = turns + 1;
      const stepOnGuardian = positionsEqual(next, guardian);
      const stepOnSentinel = positionsEqual(next, sentinel.position);

      // --- the Explorer walked into a defender ---------------------------------
      // Resolved before anything is committed, so an intercepted capture leaves no
      // trace on the board: the step simply did not happen.
      if (stepOnGuardian || stepOnSentinel) {
        if (secondChanceAvailable) {
          // The turn is counted and the charge spent; the Explorer stays.
          applyDomainEvent({
            type: "SECOND_CHANCE_USED",
            cause: "explorer",
            turn: nextTurn,
            at: next,
            message: SECOND_CHANCE_EXPLORER_MESSAGE,
          });
          return;
        }
        const caughtErrors = errors + 1;
        // The step lands on the defender and nothing else: no light is collected
        // and no trap armed on a capture. The defenders have not moved.
        applyDomainEvent({
          type: "EXPLORER_STEP_COMMITTED",
          turn: nextTurn,
          to: next,
          collectedStars,
          armedTrap: null,
        });
        applyDomainEvent({
          type: "EXPLORER_CAPTURED",
          by: "explorer-step",
          turn: nextTurn,
          at: next,
          guardian,
          sentinel,
          errors: caughtErrors,
        });
        endGame(false, {
          turns: nextTurn,
          blockedMoves,
          errors: caughtErrors,
          difficulty,
          routeNumber,
          routeStageLabel: routeProgression.label,
          starsCollected: collectedStars.length,
          totalStars: mazeMap.collectibleStars.length,
          trapsTriggered: triggeredTraps.length,
          chestOpened,
          reward: rewardSelected,
          rewardSpent,
          wallBroken: brokenWall !== null,
        });
        return;
      }

      // --- Gameplay 2.0 overlays (walkable, never alter maze rules) ------------
      const isUntriggeredTrap =
        mazeMap.traps.some((trap) => positionsEqual(trap, next)) &&
        !triggeredTrapSet.has(nextKey);
      // ROTA-TRAPS-STRATEGY-01-CLOSEOUT: arming a trap is not a mistake. It costs
      // no error, no shake and no error tone.
      const arrivesAtChest =
        mazeMap.chest !== null &&
        positionsEqual(next, mazeMap.chest) &&
        !chestOpened;

      const collectedStar =
        mazeMap.collectibleStars.some((star) => positionsEqual(star, next)) &&
        !collectedSet.has(nextKey);
      const nextCollectedStars = collectedStar
        ? [...collectedStars, nextKey]
        : collectedStars;
      const nextTotalLights = mazeMap.collectibleStars.length;
      const nextPortalActive =
        nextTotalLights === 0 || nextCollectedStars.length >= nextTotalLights;
      const nextTrapsTriggered = triggeredTraps.length + (isUntriggeredTrap ? 1 : 0);

      applyDomainEvent({
        type: "EXPLORER_STEP_COMMITTED",
        turn: nextTurn,
        to: next,
        collectedStars: nextCollectedStars,
        armedTrap: isUntriggeredTrap ? nextKey : null,
      });
      // What the step did, said once each. The step above already wrote all of
      // it, so these record nothing more: the light, then the portal it opened,
      // then the trap.
      if (collectedStar) {
        applyDomainEvent({ type: "LIGHT_COLLECTED", turn: nextTurn, light: nextKey });
        if (nextPortalActive) {
          applyDomainEvent({ type: "PORTAL_ACTIVATED", turn: nextTurn });
        }
      }
      if (isUntriggeredTrap) {
        applyDomainEvent({ type: "TRAP_ARMED", turn: nextTurn, trap: nextKey });
      }

      if (positionsEqual(next, mazeMap.exitPosition) && nextPortalActive) {
        endGame(true, {
          turns: nextTurn,
          blockedMoves,
          errors,
          difficulty,
          routeNumber,
          routeStageLabel: routeProgression.label,
          starsCollected: nextCollectedStars.length,
          totalStars: mazeMap.collectibleStars.length,
          trapsTriggered: nextTrapsTriggered,
          chestOpened,
          reward: rewardSelected,
          rewardSpent,
          wallBroken: brokenWall !== null,
        });
        return;
      }

      // ROTA-TRAPS-STRATEGY-01: the trap arms on the turn the Explorer steps on
      // it, so the defenders must already respect it in THIS turn's answer. The
      // set is built locally rather than read back from state, because the state
      // update above is asynchronous and would arrive one turn late.
      const armedTraps = isUntriggeredTrap
        ? new Set<string>([...triggeredTrapSet, nextKey])
        : triggeredTrapSet;

      // --- the Chest pauses the turn ------------------------------------------
      // §12: the Explorer arrives, the Chest opens, and the turn STOPS here. The
      // defenders have not answered yet and will not until a reward is chosen, so
      // there is no race between the UI and the runtime and no hidden turn.
      if (arrivesAtChest) {
        applyDomainEvent({
          type: "CHEST_OPENED",
          turn: nextTurn,
          message: "Baú encontrado. Escolha a sua ferramenta.",
        });
        return;
      }

      runDefenderPhase({
        playerPosition: next,
        guardianFrom: guardian,
        sentinelFrom: sentinel,
        graphWalls: walls,
        zone: portalDefenceZone,
        armedTraps,
        turnNumber: nextTurn,
        errorsSoFar: errors,
        starsCollected: nextCollectedStars.length,
        trapsTriggeredCount: nextTrapsTriggered,
        chestOpenedNow: chestOpened,
        rewardNow: rewardSelected,
        rewardSpentNow: rewardSpent,
        brokenWallNow: brokenWall,
        secondChanceReady: secondChanceAvailable,
        // Same priority the route has always used: what the Explorer just did
        // first, then how close the Hunter got, then the portal, then calm.
        calmMessage: (guardianAfter) =>
          isUntriggeredTrap
            ? "Armadilha ativada. Os defensores precisam contornar."
            : collectedStar
              ? nextPortalActive
                ? "Portal ativado! Vá até a saída."
                : "Luz-chave coletada."
              : positionsEqual(next, mazeMap.exitPosition)
                ? "O portal ainda precisa das luzes da rota."
                : manhattanDistance(guardianAfter, next) <= 2
                  ? "O Caçador está próximo. Pense no próximo caminho."
                  : manhattanDistance(next, mazeMap.exitPosition) <= 2
                    ? nextPortalActive
                      ? "A saída está próxima."
                      : "O portal ainda precisa de todas as luzes."
                    : "Boa jogada. O Caçador se moveu.",
      });
    };

    /**
     * §13/§43: the reward is the Explorer's decision. No RNG, no draw, no
     * weighting — a branch the player takes, which is exactly how the next
     * mission's solver will model it.
     *
     * §12.6/§12.7: choosing is not a turn of its own. The turn the Chest paused
     * resumes here, at the point it paused, with the defenders answering the
     * position the Explorer already reached.
     */
    const chooseReward = (reward: ChestReward) => {
      if (awaitingRoute) return;
      if (status !== "playing" || !rewardChoicePending) return;
      applyDomainEvent({ type: "REWARD_SELECTED", turn: turns, reward });
      runDefenderPhase({
        playerPosition: player,
        guardianFrom: guardian,
        sentinelFrom: sentinel,
        graphWalls: walls,
        zone: portalDefenceZone,
        armedTraps: triggeredTrapSet,
        turnNumber: turns,
        errorsSoFar: errors,
        starsCollected: collectedStars.length,
        trapsTriggeredCount: triggeredTraps.length,
        chestOpenedNow: true,
        rewardNow: reward,
        rewardSpentNow: false,
        brokenWallNow: brokenWall,
        // A Second Chance taken here is armed immediately: it protects the rest of
        // the very turn in which it was chosen.
        secondChanceReady: reward === "second-chance",
        calmMessage: () =>
          reward === "pickaxe"
            ? // Post-playtest: this used to say "procure uma parede rachada",
              // which was the game pointing at the answer. It now states the
              // rule and leaves the decision where it belongs.
              "Picareta na mão. Você pode abrir uma parede — só uma."
            : "Segunda Chance guardada. Você resiste a uma captura.",
      });
    };

    /**
     * §16: breaking is a real play. It costs the turn, the Explorer does not move,
     * and the wall is already open when the defenders answer — which is what makes
     * the trade-off honest instead of a one-sided gift.
     *
     * ROTA-CHEST-REWARDS-01 (revisão pós-playtest) — PICKAXE_TARGET =
     * ANY_INTERNAL_MAZE_WALL.
     *
     * Every guard below is PHYSICAL: does this wall exist, is it inside the grid,
     * is the Explorer standing next to it, is the Pickaxe still in hand. There is
     * deliberately no guard asking whether opening it is a GOOD idea — no shortest
     * path check, no portal check, no "would this help the Hunter". The Pickaxe
     * does not decide for the player, and opening the wrong wall is allowed to
     * leave the Explorer worse off. That is the mechanic.
     *
     * The exclusions §4 lists — portal, chest, trap, light, the three entities,
     * the board frame, decoration — need no code: every one of them lives on a
     * WALKABLE cell or outside the 9x9 logical grid, so none of them can be in
     * `walls`. `walls.has(wallKey)` is the whole of "is a real internal maze
     * wall". The controlled tests assert each exclusion rather than trusting it.
     */
    const breakWall = (wall: GridPosition) => {
      if (awaitingRoute) return;
      if (status !== "playing" || rewardChoicePending) return;
      if (!pickaxeAvailable) return;
      if (wall.row < 0 || wall.row >= ROWS || wall.col < 0 || wall.col >= COLS) return;
      const wallKey = posKey(wall);
      // Still standing, and reachable from where the Explorer actually is.
      if (!walls.has(wallKey)) return;
      if (manhattanDistance(wall, player) !== 1) return;

      const opened = new Set(walls);
      opened.delete(wallKey);
      const openedZone = computePortalDefenceZone(
        mazeMap.playerStart,
        mazeMap.exitPosition,
        opened,
      );
      const nextTurn = turns + 1;

      applyDomainEvent({ type: "WALL_OPENED", turn: nextTurn, wall: wallKey });
      playStoneBreak();

      runDefenderPhase({
        playerPosition: player,
        guardianFrom: guardian,
        sentinelFrom: sentinel,
        // Already open. The Hunter and the Sentinel recompute on the new board in
        // this same turn — they do not learn about it one turn late.
        graphWalls: opened,
        zone: openedZone,
        armedTraps: triggeredTrapSet,
        turnNumber: nextTurn,
        errorsSoFar: errors,
        starsCollected: collectedStars.length,
        trapsTriggeredCount: triggeredTraps.length,
        chestOpenedNow: chestOpened,
        rewardNow: rewardSelected,
        rewardSpentNow: true,
        brokenWallNow: wallKey,
        secondChanceReady: false,
        calmMessage: () => "Parede aberta. O caminho novo serve para todos.",
      });
    };

    return {
      difficulty,
      routeNumber,
      routeProgression,
      mazeMap,
      /** The board as it stands — `mazeMap.walls` until the Pickaxe opens one. */
      walls,
      player,
      guardian,
      sentinel: sentinel.position,
      sentinelTarget: sentinel.target,
      sentinelCommitLeft: sentinel.commitLeft,
      portalDefenceZone,
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
      moveTick,
      // Gameplay 2.0 — read-only views for the HUD and the 3D board.
      triggeredTrapSet,
      trapsTriggered: triggeredTraps.length,
      // ROTA-CHEST-REWARDS-01 — every piece of chest state is observable here, so
      // nothing strategic hides in a ref, in the UI or in the renderer (§42).
      chestPosition: mazeMap.chest,
      chestOpened,
      rewardSelected,
      /** The single charge, spent. The four raw fields are the whole chest state. */
      rewardSpent,
      rewardChoicePending,
      pickaxeAvailable,
      pickaxeSpent,
      secondChanceAvailable,
      secondChanceSpent,
      brokenWall,
      dynamicSolvability: inspectDynamicMazeState({
        mazeMap,
        player,
        guardian,
        sentinel: sentinel.position,
        collectedStars,
        triggeredTraps,
        chestOpened,
        rewardSelected,
        rewardSpent,
        brokenWall,
        status,
      }),
      /** Adjacent walls, in a fixed direction order. The only Pickaxe affordance. */
      breakTargets,
      startGame,
      restartGame,
      changeDifficulty,
      tryMovePlayer,
      chooseReward,
      breakWall,
      // ROUTE-C7B — where the generation of the board stands. "pending" and
      // "error" freeze the match above; `retryGeneration` asks for a failed
      // board again (a new request, the same mode and Route).
      generationPhase: generation.phase,
      requestedDifficulty,
      retryGeneration,
    };
  };

  /**
   * ROUTE-C7B — null while no board has been accepted yet: the mount's first
   * generation is pending or failed. There is no match to show or play then,
   * only where its generation stands, and how to ask for it again.
   */
  const game =
    route === null ||
    walls === null ||
    portalDefenceZone === null ||
    collectedSet === null ||
    triggeredTrapSet === null
      ? null
      : playRoute(
          route,
          walls,
          portalDefenceZone,
          collectedSet,
          triggeredTrapSet,
        );

  // Optional keyboard support: arrow keys mirror the on-screen move buttons.
  // No dependency array so the handler always sees the latest game state.
  useEffect(() => {
    if (game === null || game.status !== "playing" || awaitingRoute) return;
    const { breakTargets, breakWall, tryMovePlayer } = game;

    const handleKeyDown = (event: KeyboardEvent) => {
      // §17: Enter opens the wall only when there is exactly ONE within reach,
      // because only then is there nothing to choose. With two or more the
      // choice is the whole point, and it belongs to the direction buttons —
      // never to a guess about which one the player meant.
      if (event.key === "Enter") {
        if (breakTargets.length !== 1) return;
        event.preventDefault();
        if (event.repeat) return;
        breakWall(breakTargets[0].cell);
        return;
      }
      const delta = ARROW_DELTAS[event.key];
      if (!delta) return;
      event.preventDefault();
      // Tecla segurada dispara auto-repetição do sistema (~30 eventos/s).
      // No MindFlow, um gesto = um passo: repetições automáticas são
      // ignoradas; para andar de novo, solte e pressione de novo.
      if (event.repeat) return;
      tryMovePlayer(delta);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    // `game` holds the turn's handlers, and the step's input guard writes its
    // ref from inside them — on input, never during render. The compiler
    // cannot see through the builder, so it reads `game` as a ref here.
    // eslint-disable-next-line react-hooks/refs -- no ref is read during render
    game ?? {
      routeNumber,
      routeProgression,
      mazeMap: null,
      generationPhase: generation.phase,
      requestedDifficulty,
      retryGeneration,
    }
  );
}
