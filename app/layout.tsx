import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

const name = process.env.NEXT_PUBLIC_APP_NAME || "Brine";

export const metadata: Metadata = {
  title: `${name} — DeFi on Solana, by conversation`,
  description: "Swap, earn, borrow, stake and automate on Solana by asking. You approve every transaction in your own wallet.",
};
export const viewport: Viewport = { themeColor: "#11152A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
