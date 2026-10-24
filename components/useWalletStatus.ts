"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * "restoring" covers the gap on page load while a remembered wallet auto-reconnects,
 * so the UI can show a placeholder instead of flashing the connect screen.
 */
export function useWalletStatus(): "connected" | "restoring" | "disconnected" {
  const { connected, connecting, wallet } = useWallet();
  const [mounted, setMounted] = useState(false);
  const [remembered, setRemembered] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setRemembered(!!JSON.parse(localStorage.getItem("walletName") || "null"));
    } catch {
      /* storage unavailable */
    }
    // Never block the UI for long if the wallet extension doesn't respond.
    const t = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(t);
  }, []);

  if (connected) return "connected";
  if (!mounted || connecting) return "restoring";
  // The provider clears the selected wallet if auto-connect fails.
  if (remembered && wallet && !timedOut) return "restoring";
  return "disconnected";
}
