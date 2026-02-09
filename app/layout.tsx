import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/theme";
import PwaRegister from "@/app/components/PwaRegister";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7C6AFF",
};

export const metadata: Metadata = {
  title: "deepwork.ai – Data‑driven focus coach",
  description:
    "deepwork.ai is an AI focus coach that understands how your mind works, shows what builds or destroys your focus, and gives personalized guidance to improve it over time.",
  icons: { icon: "/logo.svg" },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "deepwork.ai" },
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <PwaRegister />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}


