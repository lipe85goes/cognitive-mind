import type { MetadataRoute } from "next";

/** Web app manifest for installable / home-screen shortcuts (basic PWA). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MindFlow — Treino Cognitivo",
    short_name: "MindFlow",
    description:
      "Exercícios cognitivos leves para praticar memória, planejamento e foco.",
    start_url: "/",
    display: "standalone",
    background_color: "#eef4f9",
    theme_color: "#eef4f9",
    lang: "pt-BR",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
