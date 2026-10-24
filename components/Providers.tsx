"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletNotReadyError, type WalletError } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";

export default function Providers({ children }: { children: React.ReactNode }) {
  const [endpoint, setEndpoint] = useState("http://localhost:3000/api/rpc");
  useEffect(() => setEndpoint(`${window.location.origin}/api/rpc`), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  // Wallet not installed: send the user to its install page instead of raising an error overlay.
  const onError = useCallback((error: WalletError, adapter?: { url?: string }) => {
    if (error instanceof WalletNotReadyError && adapter?.url) window.open(adapter.url, "_blank");
    else console.warn(error.name, error.message);
  }, []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
