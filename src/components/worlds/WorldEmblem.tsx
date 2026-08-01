import type { SVGProps } from "react";
import type { GameId } from "@/types/game";

/**
 * Emblemas dos mundos (HOME-WORLDS-FINAL-01).
 *
 * Uma família só: anel de bronze + a gramática do próprio mundo em teal e
 * âmbar contidos. SVG inline (nítido em qualquer escala, zero asset), sempre
 * decorativo — o nome do mundo vive em React ao lado, nunca dentro da arte.
 * Cada emblema é reconhecível pela FORMA, não só pela cor.
 */

const RING = "#c08c4a";
const RING_SOFT = "#8a6134";
const TEAL = "#3fbdae";
const TEAL_DEEP = "#0f6f66";
const AMBER = "#e6aa12";
const STONE = "#9fb3ad";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <>
      <circle cx="24" cy="24" r="20.5" stroke={RING} strokeWidth="2.4" opacity="0.92" />
      <circle cx="24" cy="24" r="16.4" stroke={RING_SOFT} strokeWidth="0.9" opacity="0.5" />
      {children}
    </>
  );
}

/** Rota: tabuleiro em perspectiva com o portal teal aberto à frente. */
function RouteMark() {
  return (
    <Frame>
      <path
        d="M24 11.5 38 20 24 28.5 10 20Z"
        fill="#1d3b3f"
        stroke={STONE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M17 15.8 31 24M31 15.8 17 24" stroke={STONE} strokeWidth="0.9" opacity="0.6" />
      <path
        d="M18.6 33.4c0-3 2.4-5.4 5.4-5.4s5.4 2.4 5.4 5.4v3.2H18.6Z"
        fill={TEAL}
        stroke={TEAL_DEEP}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="32.6" r="1.5" fill="#e8fffb" opacity="0.9" />
    </Frame>
  );
}

/** Circuito: quatro sinais em torno do cristal central. */
function CircuitMark() {
  return (
    <Frame>
      <path
        d="M24 17.2V10.6M30.8 24h6.6M10.6 24h6.6M24 30.8v6.6"
        stroke={RING}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <circle cx="24" cy="7.6" r="3.5" fill="#ef5b3e" stroke="#a63c22" strokeWidth="1.1" />
      <circle cx="40.4" cy="24" r="3.5" fill="#2e86d9" stroke="#1c5c9e" strokeWidth="1.1" />
      <circle cx="7.6" cy="24" r="3.5" fill="#3fa251" stroke="#276b35" strokeWidth="1.1" />
      <circle cx="24" cy="40.4" r="3.5" fill={AMBER} stroke="#a97b0a" strokeWidth="1.1" />
      <path
        d="M24 15.4c2.6 2.2 4.9 4.9 4.9 7.9 0 3.1-2.2 5.3-4.9 5.3s-4.9-2.2-4.9-5.3c0-3 2.3-5.7 4.9-7.9Z"
        fill={TEAL}
        stroke={TEAL_DEEP}
        strokeWidth="1.2"
      />
    </Frame>
  );
}

/** Central de Comandos: escudo selado entre duas alavancas. */
function CommandsMark() {
  return (
    <Frame>
      <path
        d="M24 12.5 33 15.6v7.2c0 5.4-3.7 9.6-9 11.4-5.3-1.8-9-6-9-11.4v-7.2Z"
        fill="#1d3b3f"
        stroke={STONE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M20 23.4l3 3.1 5.4-6"
        stroke={TEAL}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M11.4 30.5v-6.2M36.6 30.5v-6.2" stroke={RING} strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="11.4" cy="22.4" r="2.1" fill={TEAL} stroke={TEAL_DEEP} strokeWidth="1" />
      <circle cx="36.6" cy="22.4" r="2.1" fill={AMBER} stroke="#a97b0a" strokeWidth="1" />
    </Frame>
  );
}

/** Trilha Lógica: degraus subindo com marcos de altura crescente. */
function TrailMark() {
  return (
    <Frame>
      <path
        d="M10.5 33h7v4h-7zM19.5 28.5h7V37h-7zM28.5 23.5h7V37h-7z"
        fill="#1d3b3f"
        stroke={STONE}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="28.5" r="2" fill={TEAL} stroke={TEAL_DEEP} strokeWidth="1" />
      <circle cx="23" cy="23.4" r="2" fill={AMBER} stroke="#a97b0a" strokeWidth="1" />
      <circle cx="32" cy="18.2" r="2.2" fill={TEAL} stroke={TEAL_DEEP} strokeWidth="1" />
      <path
        d="M14 26.4v-3.2M23 21.3v-3.1M32 16v-3"
        stroke={RING}
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.8"
      />
    </Frame>
  );
}

/** Jardim de Sementes: semente, broto e florada sobre o canteiro. */
function GardenMark() {
  return (
    <Frame>
      <path
        d="M12 30h24v3.4c0 1.4-1.1 2.6-2.6 2.6H14.6c-1.5 0-2.6-1.2-2.6-2.6Z"
        fill="#2a1b10"
        stroke={RING_SOFT}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <ellipse cx="16" cy="27.4" rx="2.5" ry="1.8" fill={RING} stroke={RING_SOFT} strokeWidth="1" />
      <path d="M24 30v-6.4" stroke="#3fa251" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="21.6" cy="23.8" rx="2.8" ry="1.4" fill="#3fa251" transform="rotate(-24 21.6 23.8)" />
      <ellipse cx="26.4" cy="24.6" rx="2.6" ry="1.3" fill="#4db85f" transform="rotate(20 26.4 24.6)" />
      <path d="M33 30v-8.6" stroke="#3fa251" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="33" cy="18.6" r="3" fill={AMBER} stroke="#a97b0a" strokeWidth="1.1" />
      <circle cx="33" cy="18.6" r="1" fill="#fff3d0" />
    </Frame>
  );
}

const MARKS: Record<GameId, () => React.ReactElement> = {
  "escape-maze": RouteMark,
  "color-sequence": CircuitMark,
  "security-panel": CommandsMark,
  "number-trail": TrailMark,
  "seed-garden": GardenMark,
};

interface WorldEmblemProps extends SVGProps<SVGSVGElement> {
  gameId: GameId;
}

export function WorldEmblem({ gameId, className, ...props }: WorldEmblemProps) {
  const Mark = MARKS[gameId];
  if (!Mark) return null;

  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden className={className} {...props}>
      <Mark />
    </svg>
  );
}
