import confetti from "canvas-confetti";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Short, calm celebration burst — only for successful completions.
 * Skipped when the user prefers reduced motion.
 */
export function celebrateSuccess(): void {
  if (prefersReducedMotion()) return;

  const fire = (delayMs: number) => {
    window.setTimeout(() => {
      void confetti({
        particleCount: 36,
        spread: 58,
        startVelocity: 22,
        origin: { x: 0.5, y: 0.55 },
        colors: ["#0d9488", "#fbbf24", "#6ee7b7", "#7dd3fc", "#fcd34d"],
        ticks: 110,
        gravity: 0.95,
        scalar: 0.85,
        disableForReducedMotion: true,
      });
    }, delayMs);
  };

  fire(0);
  fire(150);
}
