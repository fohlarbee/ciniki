"use client";

import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";

// Wallet state only exists in the browser, so render the button client-side
// only to avoid a server/client hydration mismatch.
const WalletMultiButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  {
    ssr: false,
    // Neutral placeholder: don't claim "Select Wallet" before we know whether one is connected.
    loading: () => <span className="wallet-placeholder skeleton" aria-hidden="true" />,
  },
);

export default function WalletButton() {
  const { connecting } = useWallet();
  return (
    <span className={`wallet-btn${connecting ? " connecting" : ""}`} aria-busy={connecting}>
      <WalletMultiButton />
    </span>
  );
}
