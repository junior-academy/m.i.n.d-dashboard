import type { ReactNode } from "react";
import { Bebas_Neue, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

export const metadata = {
  title: "M.I.N.D Dashboard",
  description: "Public-facing results dashboard for M.I.N.D ensemble experiments"
};

const fontDisp = Bebas_Neue({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-disp"
});

const fontUi = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-ui"
});

const fontSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-sans"
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${fontDisp.variable} ${fontUi.variable} ${fontSans.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
