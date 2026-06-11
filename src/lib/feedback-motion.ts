import type { TargetAndTransition, Variants } from "motion/react";

/** Gentle horizontal shake for wrong taps (respect reduced motion externally). */
export const gentleShakeAnimate: TargetAndTransition = {
  x: [0, -6, 6, -4, 4, 0],
  transition: { duration: 0.42, ease: "easeInOut" },
};

/** Quick positive scale pulse for correct taps. */
export const positivePulseAnimate: TargetAndTransition = {
  scale: [1, 1.06, 1],
  transition: { duration: 0.28, ease: "easeOut" },
};

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};
