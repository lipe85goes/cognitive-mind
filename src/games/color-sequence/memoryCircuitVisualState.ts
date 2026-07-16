import type {
  MemoryPhase,
  TapFeedback,
} from "@/games/color-sequence/useColorSequenceGame";

export function getMemoryCircuitStateLabel(phase: MemoryPhase) {
  if (phase === "input") return "Sua vez de repetir";
  if (phase === "showing") return "Observe o circuito";
  if (phase === "round-complete") return "Circuito ativado";
  return "Circuito em repouso";
}

export function getMemoryPadFeedbackClass(
  isLit: boolean,
  feedback: TapFeedback,
) {
  if (feedback === "wrong") return isLit ? "is-lit is-wrong" : "is-wrong";
  if (feedback === "correct") return isLit ? "is-lit is-correct" : "is-correct";
  return isLit ? "is-lit" : "";
}

/**
 * Um overlay de pad acende quando o circuito mostra a sequência (activeColor)
 * ou quando o Explorador acabou de tocar aquele pad (eco do toque, correto ou
 * suave-âmbar no engano). A lógica do jogo continua no hook congelado — aqui é
 * só leitura visual.
 */
export function getMemoryPadOverlayState(
  padId: number,
  activeColor: number | null,
  lastTapped: number | null,
  tapFeedback: TapFeedback,
): "on" | "wrong" | "off" {
  if (lastTapped === padId && tapFeedback === "wrong") return "wrong";
  if (activeColor === padId) return "on";
  if (lastTapped === padId && tapFeedback === "correct") return "on";
  return "off";
}
