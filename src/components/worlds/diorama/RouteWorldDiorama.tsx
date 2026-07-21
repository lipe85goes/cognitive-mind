import { WorldDiorama } from "./WorldDiorama";
import type { WorldDioramaState } from "./worldDioramaLayout";

interface RouteWorldDioramaProps {
  state?: WorldDioramaState;
  variant?: "home" | "transition";
  sizes?: string;
}

export function RouteWorldDiorama(props: RouteWorldDioramaProps) {
  return <WorldDiorama gameId="escape-maze" {...props} />;
}
