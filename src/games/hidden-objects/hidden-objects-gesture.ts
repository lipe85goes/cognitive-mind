import type { Point } from "@/games/hidden-objects/hidden-objects-camera";

/**
 * The one recogniser every pointer on the scene goes through: is this a TAP
 * (select), a DRAG (pan) or a PINCH (zoom)? Pure state machine — the scene
 * controller feeds it Pointer Events and applies what it returns.
 *
 * Policy (Discovery §7; values TO_VALIDATE_IN_SKELETON):
 *   - a tap moves at most 14 px (touch/pen) or 6 px (mouse) and lasts ≤ 1 s;
 *   - a drag never selects; a gesture that ever had two pointers never selects;
 *   - the press that stops a gliding camera never selects;
 *   - pointercancel / lost capture abort the gesture: nothing is selected;
 *   - the tap point is where the pointer went down (steadier with tremor);
 *   - a mouse button other than the primary one is ignored; a third pointer too.
 */

export const TAP_SLOP_TOUCH_PX = 14;
export const TAP_SLOP_MOUSE_PX = 6;
export const TAP_MAX_DURATION_MS = 1000;

export interface PointerSample {
  id: number;
  x: number;
  y: number;
  /** ms, any monotonic clock. */
  t: number;
  pointerType: string;
  /** 0 = primary. */
  button?: number;
}

export type GesturePhase = "idle" | "pressed" | "panning" | "pinch";

export interface GestureState {
  phase: GesturePhase;
  /** Pointers this gesture is tracking (at most two), with their last position. */
  pointers: readonly { id: number; x: number; y: number }[];
  /** Where and when the first pointer went down. */
  origin: { x: number; y: number; t: number; pointerType: string } | null;
  /** This gesture began by catching a moving camera: it can never be a tap. */
  caught: boolean;
  /** A second pointer joined at some point: never a tap. */
  multi: boolean;
}

export type GestureEffect =
  | { kind: "pan"; dx: number; dy: number }
  | { kind: "pinch-start"; centroid: Point; distance: number }
  | { kind: "pinch"; centroid: Point; distance: number }
  | { kind: "pinch-end" }
  | { kind: "tap"; x: number; y: number; pointerType: string }
  | { kind: "end" };

export interface GestureStep {
  state: GestureState;
  effects: GestureEffect[];
  /** The controller should capture this pointer (it joined the gesture). */
  capture?: number;
}

export const IDLE_GESTURE: GestureState = {
  phase: "idle",
  pointers: [],
  origin: null,
  caught: false,
  multi: false,
};

export const tapSlopFor = (pointerType: string) =>
  pointerType === "mouse" ? TAP_SLOP_MOUSE_PX : TAP_SLOP_TOUCH_PX;

const unchanged = (state: GestureState): GestureStep => ({ state, effects: [] });

function pinchFrame(pointers: GestureState["pointers"]) {
  const [a, b] = pointers;
  return {
    centroid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    distance: Math.hypot(b.x - a.x, b.y - a.y),
  };
}

export function pointerDown(state: GestureState, sample: PointerSample, cameraMoving: boolean): GestureStep {
  if (sample.pointerType === "mouse" && (sample.button ?? 0) !== 0) return unchanged(state);
  if (state.pointers.some((pointer) => pointer.id === sample.id)) return unchanged(state);

  if (state.phase === "idle") {
    return {
      state: {
        phase: "pressed",
        pointers: [{ id: sample.id, x: sample.x, y: sample.y }],
        origin: { x: sample.x, y: sample.y, t: sample.t, pointerType: sample.pointerType },
        caught: cameraMoving,
        multi: false,
      },
      effects: [],
      capture: sample.id,
    };
  }

  // A second finger turns whatever this was into a pinch; a third is ignored.
  if (state.pointers.length === 1) {
    const pointers = [...state.pointers, { id: sample.id, x: sample.x, y: sample.y }];
    return {
      state: { ...state, phase: "pinch", pointers, multi: true },
      effects: [{ kind: "pinch-start", ...pinchFrame(pointers) }],
      capture: sample.id,
    };
  }
  return unchanged(state);
}

export function pointerMove(state: GestureState, sample: PointerSample): GestureStep {
  const index = state.pointers.findIndex((pointer) => pointer.id === sample.id);
  if (index === -1 || state.phase === "idle") return unchanged(state);
  const previous = state.pointers[index];
  const pointers = state.pointers.map((pointer, i) =>
    i === index ? { id: pointer.id, x: sample.x, y: sample.y } : pointer,
  );

  if (state.phase === "pinch") {
    return { state: { ...state, pointers }, effects: [{ kind: "pinch", ...pinchFrame(pointers) }] };
  }

  if (state.phase === "pressed") {
    const origin = state.origin!;
    const travelled = Math.hypot(sample.x - origin.x, sample.y - origin.y);
    if (travelled <= tapSlopFor(origin.pointerType)) return { state: { ...state, pointers }, effects: [] };
    // Past the slop it is a drag: catch up with everything travelled so far (no jump).
    return {
      state: { ...state, phase: "panning", pointers },
      effects: [{ kind: "pan", dx: sample.x - origin.x, dy: sample.y - origin.y }],
    };
  }

  return {
    state: { ...state, pointers },
    effects: [{ kind: "pan", dx: sample.x - previous.x, dy: sample.y - previous.y }],
  };
}

export function pointerUp(state: GestureState, sample: PointerSample): GestureStep {
  const index = state.pointers.findIndex((pointer) => pointer.id === sample.id);
  if (index === -1) return unchanged(state);

  if (state.phase === "pinch") {
    // One finger lifts: the other keeps panning. Never a tap.
    const pointers = state.pointers.filter((_, i) => i !== index);
    return { state: { ...state, phase: "panning", pointers }, effects: [{ kind: "pinch-end" }] };
  }

  if (state.phase === "pressed") {
    const origin = state.origin!;
    const quick = sample.t - origin.t <= TAP_MAX_DURATION_MS;
    if (quick && !state.caught && !state.multi) {
      return {
        state: IDLE_GESTURE,
        effects: [{ kind: "tap", x: origin.x, y: origin.y, pointerType: origin.pointerType }],
      };
    }
  }

  return { state: IDLE_GESTURE, effects: [{ kind: "end" }] };
}

/** pointercancel and lostpointercapture: the gesture is over and selects nothing. */
export function pointerCancel(state: GestureState, sample: Pick<PointerSample, "id">): GestureStep {
  if (!state.pointers.some((pointer) => pointer.id === sample.id)) return unchanged(state);
  return { state: IDLE_GESTURE, effects: [{ kind: "end" }] };
}
