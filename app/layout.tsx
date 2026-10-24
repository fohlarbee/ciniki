import type { Metadata, Viewport } from "next";
import { Mona_Sans } from "next/font/google";
import "./globals.css";
import { APP_NAME } from "@/components/brand";

const mona = Mona_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-mona", display: "swap" });

const name = APP_NAME;

export const metadata: Metadata = {
  title: `${name} — DeFi on Solana, by conversation`,
  description: "Swap, earn, borrow, stake and automate on Solana by asking. You approve every transaction in your own wallet.",
};
export const viewport: Viewport = { themeColor: "#F4F6F3", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={mona.variable}>
      <body>{children}</body>
    </html>
  );
}
