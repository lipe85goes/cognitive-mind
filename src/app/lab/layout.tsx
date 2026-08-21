import type { ReactNode } from "react";
import { notFound } from "next/navigation";

/**
 * Labs are local development tools, not product routes.
 *
 * Keep this boundary server-side: production requests terminate before any
 * diagnostic UI can render or hydrate. The route files remain available to
 * `next dev`, where access still requires typing the explicit `/lab/*` URL.
 */
export default function LabLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return children;
}
