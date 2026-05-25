import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MindFlow — Treino Cognitivo",
  description:
    "Exercícios cognitivos leves para praticar memória, planejamento e foco.",
  applicationName: "MindFlow",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MindFlow",
  },
};

/** Mobile-first viewport; safe areas support future PWA / Capacitor shells. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#eef4f9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-w-0 flex-col overflow-x-hidden text-slate-800">
        {children}
      </body>
    </html>
  );
}
