import type { ReactNode } from "react";

type StatusVariant = "neutral" | "info" | "success" | "warning" | "error";

interface StatusBannerProps {
  children: ReactNode;
  variant?: StatusVariant;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  neutral: "status-banner-neutral",
  info: "status-banner-info",
  success: "status-banner-success",
  warning: "status-banner-warning",
  error: "status-banner-error",
};

/** In-game status / feedback message strip. */
export function StatusBanner({
  children,
  variant = "neutral",
  className = "",
}: StatusBannerProps) {
  return (
    <p
      className={`status-banner min-h-[3.5rem] flex items-center justify-center ${variantStyles[variant]} ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {children}
    </p>
  );
}
