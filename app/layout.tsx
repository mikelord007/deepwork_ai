import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "deepwork.ai – Data‑driven focus coach",
  description:
    "deepwork.ai is an AI focus coach that understands how your mind works, shows what builds or destroys your focus, and gives personalized guidance to improve it over time.",
  icons: { icon: "/logo.svg" },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}


