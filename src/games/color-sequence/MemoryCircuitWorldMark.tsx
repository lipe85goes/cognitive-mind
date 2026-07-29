import type { SVGProps } from "react";

/**
 * Assinatura visual do Circuito de Memória (CIRCUIT-PRESENTATION-FINAL-01).
 *
 * Um emblema inline leve que ecoa o próprio artefato: anel de bronze do
 * circuito, quatro gemas de sinal nas posições congeladas (chama no topo,
 * onda à direita, folha à esquerda, sol embaixo) e o cristal-core teal no
 * centro. SVG inline = nítido em qualquer escala, zero asset em public,
 * cores fixas do mundo (não dependem só de cor: as posições são a gramática).
 *
 * Decorativo por padrão (aria-hidden); o texto acessível vive sempre em
 * React ao lado do emblema, nunca dentro dele.
 */
export function MemoryCircuitWorldMark({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden
      className={className}
      {...props}
    >
      {/* Anel externo do circuito, bronze envelhecido */}
      <circle
        cx="24"
        cy="24"
        r="20.5"
        stroke="#c08c4a"
        strokeWidth="2.4"
        opacity="0.92"
      />
      <circle
        cx="24"
        cy="24"
        r="16.4"
        stroke="#8a6134"
        strokeWidth="0.9"
        opacity="0.55"
      />

      {/* Trilhas core → sinais */}
      <path
        d="M24 17.2V10.6M30.8 24h6.6M10.6 24h6.6M24 30.8v6.6"
        stroke="#c08c4a"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Sinais: chama (topo), onda (direita), folha (esquerda), sol (baixo) */}
      <circle cx="24" cy="7.6" r="3.5" fill="#ef5b3e" stroke="#a63c22" strokeWidth="1.1" />
      <circle cx="40.4" cy="24" r="3.5" fill="#2e86d9" stroke="#1c5c9e" strokeWidth="1.1" />
      <circle cx="7.6" cy="24" r="3.5" fill="#3fa251" stroke="#276b35" strokeWidth="1.1" />
      <circle cx="24" cy="40.4" r="3.5" fill="#e6aa12" stroke="#a97b0a" strokeWidth="1.1" />

      {/* Core: cristal teal com faceta de luz */}
      <path
        d="M24 15.4c2.6 2.2 4.9 4.9 4.9 7.9 0 3.1-2.2 5.3-4.9 5.3s-4.9-2.2-4.9-5.3c0-3 2.3-5.7 4.9-7.9Z"
        fill="#3fbdae"
        stroke="#0f6f66"
        strokeWidth="1.2"
      />
      <path
        d="M21.9 22.9c.2-2 1.1-3.7 2.1-5.1"
        stroke="#c9f6ec"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
