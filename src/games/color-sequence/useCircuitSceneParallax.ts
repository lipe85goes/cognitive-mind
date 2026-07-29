"use client";

import { useEffect, useRef } from "react";

/** Deslocamento máximo do ambiente, em px. Presença sem inquietação. */
const MAX_SHIFT_PX = 9;

/**
 * Parallax passivo da cena do Circuito (CIRCUIT-FREE-SCENE-01).
 *
 * Move APENAS as camadas de ambiente (sala e sombreado), nunca o board.
 * Como o artefato e os hitboxes ficam parados, não existe alvo em
 * movimento: clique, toque, foco e teclado permanecem exatamente onde
 * o Explorador espera — a profundidade vem do mundo atrás da peça.
 *
 * Desligado sob `prefers-reduced-motion` e em ponteiros grosseiros
 * (toque), onde não há cursor para responder.
 */
export function useCircuitSceneParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const calmMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (calmMotion.matches || !finePointer.matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const commit = () => {
      frame = 0;
      node.style.setProperty("--mfg-par-x", `${x.toFixed(2)}px`);
      node.style.setProperty("--mfg-par-y", `${y.toFixed(2)}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(commit);
    };

    const handleMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = -(event.clientX / window.innerWidth - 0.5) * 2 * MAX_SHIFT_PX;
      y = -(event.clientY / window.innerHeight - 0.5) * 2 * MAX_SHIFT_PX;
      schedule();
    };

    const handleRest = () => {
      x = 0;
      y = 0;
      schedule();
    };

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("blur", handleRest);
    document.addEventListener("pointerleave", handleRest);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("blur", handleRest);
      document.removeEventListener("pointerleave", handleRest);
      if (frame) window.cancelAnimationFrame(frame);
      node.style.removeProperty("--mfg-par-x");
      node.style.removeProperty("--mfg-par-y");
    };
  }, []);

  return ref;
}
