import {
  CircleAlert,
  CircleCheckBig,
  Info,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

type StatusVariant = "neutral" | "info" | "success" | "warning" | "error";

interface StatusBannerProps {
  children: ReactNode;
  variant?: StatusVariant;
  label?: string;
  className?: string;
}

const variantPresentation = {
  neutral: {
    className: "status-banner-neutral",
    defaultLabel: "Orientação",
    icon: Sparkles,
  },
  info: {
    className: "status-banner-info",
    defaultLabel: "Agora",
    icon: Info,
  },
  success: {
    className: "status-banner-success",
    defaultLabel: "Muito bem",
    icon: CircleCheckBig,
  },
  warning: {
    className: "status-banner-warning",
    defaultLabel: "Atenção",
    icon: TriangleAlert,
  },
  error: {
    className: "status-banner-error",
    defaultLabel: "Com calma",
    icon: CircleAlert,
  },
} satisfies Record<
  StatusVariant,
  { className: string; defaultLabel: string; icon: typeof Sparkles }
>;

/** In-game status / feedback message strip. */
export function StatusBanner({
  children,
  variant = "neutral",
  label,
  className = "",
}: StatusBannerProps) {
  const presentation = variantPresentation[variant];
  const Icon = presentation.icon;

  return (
    <div
      className={`status-banner ${presentation.className} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      <span className="status-banner-icon" aria-hidden>
        <Icon className="h-6 w-6" />
      </span>
      <span className="status-banner-copy">
        <span className="status-banner-label">
          {label ?? presentation.defaultLabel}
        </span>
        <span className="status-banner-message">{children}</span>
      </span>
    </div>
  );
}
