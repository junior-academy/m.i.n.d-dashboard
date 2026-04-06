import type { ReactNode } from "react";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

export const metadata = {
  title: "M.I.N.D Dashboard",
  description: "Public-facing results dashboard for M.I.N.D ensemble experiments"
};

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-head"
});

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-mono"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${orbitron.variable} ${shareTechMono.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
