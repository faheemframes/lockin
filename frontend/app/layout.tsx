import { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { MotionRoot } from "../components/ui/motion";
import TopLoader from "../components/TopLoader";

// Brand system: Space Grotesk. 300 for large headlines, 500 for UI.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  variable: "--font-grotesk",
  display: "swap"
});

export const viewport: Viewport = {
  themeColor: "#000000",
  viewportFit: "cover"
};

export const metadata: Metadata = {
  title: "LOCKIN",
  description: "Stop scrolling. Start executing.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png"
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={grotesk.variable}>
      <body className="font-sans">
        <TopLoader />
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
