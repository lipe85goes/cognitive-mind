import { WorldDiorama } from "./WorldDiorama";
import type { WorldDioramaState } from "./worldDioramaLayout";

interface CircuitWorldDioramaProps {
  state?: WorldDioramaState;
  variant?: "home" | "transition";
  sizes?: string;
}

export function CircuitWorldDiorama(props: CircuitWorldDioramaProps) {
  return <WorldDiorama gameId="color-sequence" {...props} />;
}
