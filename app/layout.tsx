import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "deepwork.ai – Data‑driven focus coach",
  description:
    "deepwork.ai is an AI focus coach that understands how your mind works, shows what builds or destroys your focus, and gives personalized guidance to improve it over time."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


