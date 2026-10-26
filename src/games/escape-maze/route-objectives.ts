import type { MazeMap } from "@/games/escape-maze/route-generation";

/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — what a Route asks of the Explorer before its
 * portal opens, and how far the Explorer has got.
 *
 * The objective graph is small and fixed by the Route's place in the journey:
 *
 *   Route 1            collect-all-lights ──────────────→ reach-portal
 *
 *   Routes 2 and 3     collect-all-lights ─────┐
 *                                              ├──→ reach-portal
 *                      open-linked-passage ────┘
 *
 * The prerequisites have no order between them: either may be finished first.
 * `reach-portal` is not a prerequisite — it is the move that wins, and it is
 * open only once every prerequisite is complete.
 *
 * Nothing here is state. Every answer is derived from what the Route already
 * holds — the lights collected, and the walls as they stand right now
 * (`currentWalls(mazeMap.walls, brokenWall, trapOpenedWalls)`, route-geometry).
 * "The marked passage is open" is a fact about the maze, not about who opened
 * it: the linked trap and the Pickaxe both remove the same wall, and either
 * one completes the objective. A restart or a new Route has its own lights and
 * its own walls, so its objectives start over with no reset to remember.
 *
 * Pure: no React, no Babylon, no sounds, no browser, no storage, no Worker and
 * no random draw — the plan is a table indexed by the Route number. The
 * evaluator returns structured results; the words the player reads are the
 * hook's and the Rota component's.
 */

/** What the portal waits for. */
export type RoutePrerequisiteId = "collect-all-lights" | "open-linked-passage";

/** Every objective of a Route: the prerequisites, then the portal itself. */
export type RouteObjectiveId = RoutePrerequisiteId | "reach-portal";

export interface RouteObjectivePlan {
  /** The prerequisites of `reach-portal`, in display order. Completable in any order. */
  readonly prerequisites: readonly RoutePrerequisiteId[];
}

const STANDARD_PLAN: RouteObjectivePlan = Object.freeze({
  prerequisites: Object.freeze(["collect-all-lights"] as const),
});

const LIGHTS_AND_PASSAGE_PLAN: RouteObjectivePlan = Object.freeze({
  prerequisites: Object.freeze([
    "collect-all-lights",
    "open-linked-passage",
  ] as const),
});

/**
 * The plan of each Route of the journey. Deliberate and deterministic: Route 1
 * is the onboarding Route and keeps the v1 objective exactly; Routes 2 and 3
 * add the marked passage. A Route number outside the journey (the product has
 * none) reads as the nearest one.
 */
const ROUTE_OBJECTIVE_PLANS: Readonly<Record<1 | 2 | 3, RouteObjectivePlan>> =
  Object.freeze({
    1: STANDARD_PLAN,
    2: LIGHTS_AND_PASSAGE_PLAN,
    3: LIGHTS_AND_PASSAGE_PLAN,
  });

export function routeObjectivePlan(routeNumber: number): RouteObjectivePlan {
  const route = Number.isFinite(routeNumber)
    ? Math.min(3, Math.max(1, Math.floor(routeNumber)))
    : 1;
  return ROUTE_OBJECTIVE_PLANS[route as 1 | 2 | 3];
}

/**
 * The marked passage: the wall the map's dynamic trap is linked to
 * (ROTA2-DYNAMIC-TRAPS-01 certifies exactly one). Null on a map with no link.
 */
export function linkedPassageWall(
  mazeMap: Pick<MazeMap, "trapLinks">,
): string | null {
  return (mazeMap.trapLinks ?? [])[0]?.mutation.wall ?? null;
}

export interface RouteObjectiveInput {
  plan: RouteObjectivePlan;
  mazeMap: Pick<MazeMap, "collectibleStars" | "trapLinks">;
  /** The lights collected so far (route-state's `collectedStars`). */
  collectedStars: readonly string[];
  /** The walls as they stand now — `currentWalls(...)`, never the certified set alone. */
  walls: ReadonlySet<string>;
}

export interface RouteObjectiveEvaluation {
  plan: RouteObjectivePlan;
  lights: {
    collected: number;
    total: number;
    complete: boolean;
  };
  passage: {
    /** The plan asks for it. */
    required: boolean;
    /** The marked wall, or null when the map has none. */
    wall: string | null;
    /** The marked wall no longer stands (whoever opened it). */
    open: boolean;
    /** Not required, or required and open. */
    complete: boolean;
  };
  /** The prerequisites still missing, in plan order. Empty once the portal is ready. */
  missing: RoutePrerequisiteId[];
  /** Every prerequisite complete: reaching the portal now wins. */
  portalReady: boolean;
}

/**
 * Where the Route's objectives stand, derived from the lights and the walls.
 *
 * The light rule is v1's, verbatim: a Route without lights has its lights
 * complete from the start. The passage is complete when the plan does not ask
 * for it, when the map has no marked wall (nothing to open), or when the marked
 * wall is not among the standing walls.
 */
export function evaluateRouteObjectives({
  plan,
  mazeMap,
  collectedStars,
  walls,
}: RouteObjectiveInput): RouteObjectiveEvaluation {
  const total = mazeMap.collectibleStars.length;
  const collected = collectedStars.length;
  const lightsComplete = total === 0 || collected >= total;

  const required = plan.prerequisites.includes("open-linked-passage");
  const wall = linkedPassageWall(mazeMap);
  const open = wall === null || !walls.has(wall);
  const passageComplete = !required || open;

  const missing = plan.prerequisites.filter((id) =>
    id === "collect-all-lights" ? !lightsComplete : !passageComplete,
  );
  return {
    plan,
    lights: { collected, total, complete: lightsComplete },
    passage: { required, wall, open, complete: passageComplete },
    missing,
    portalReady: missing.length === 0,
  };
}
