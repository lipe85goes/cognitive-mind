import {
  Brain,
  Eye,
  Grid3x3,
  Hash,
  ShieldCheck,
  Map,
  Palette,
  Search,
  Target,
  Zap,
} from "lucide-react";
import type { Activity } from "@/types/game";

interface ActivityIconProps {
  activityId: string;
  skill: Activity["skill"];
  className?: string;
}

const iconClass = "h-7 w-7 text-teal-700";

/** Static lucide icon per activity — avoids dynamic component creation in render. */
export function ActivityIcon({
  activityId,
  skill,
  className = iconClass,
}: ActivityIconProps) {
  switch (activityId) {
    case "color-sequence":
      return <Palette className={className} strokeWidth={2} aria-hidden />;
    case "escape-maze":
      return <Grid3x3 className={className} strokeWidth={2} aria-hidden />;
    case "security-panel":
      return <ShieldCheck className={className} strokeWidth={2} aria-hidden />;
    case "number-trail":
      return <Hash className={className} strokeWidth={2} aria-hidden />;
    case "quick-tap":
      return <Zap className={className} strokeWidth={2} aria-hidden />;
    case "pattern-match":
      return <Search className={className} strokeWidth={2} aria-hidden />;
    case "word-sprint":
      return <Brain className={className} strokeWidth={2} aria-hidden />;
    case "path-planner":
      return <Map className={className} strokeWidth={2} aria-hidden />;
    case "focus-grid":
      return <Eye className={className} strokeWidth={2} aria-hidden />;
    case "dual-task":
      return <Target className={className} strokeWidth={2} aria-hidden />;
    default:
      break;
  }

  switch (skill) {
    case "attention":
      return <Eye className={className} strokeWidth={2} aria-hidden />;
    case "memory":
      return <Brain className={className} strokeWidth={2} aria-hidden />;
    case "planning":
      return <Map className={className} strokeWidth={2} aria-hidden />;
    case "reaction":
      return <Zap className={className} strokeWidth={2} aria-hidden />;
    case "spatial":
      return <Grid3x3 className={className} strokeWidth={2} aria-hidden />;
    default:
      return <Brain className={className} strokeWidth={2} aria-hidden />;
  }
}
