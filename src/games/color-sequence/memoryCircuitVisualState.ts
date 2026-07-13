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