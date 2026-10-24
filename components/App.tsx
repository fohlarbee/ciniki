"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import WalletButton from "./WalletButton";
import Chat from "./Chat";
import Desk from "./Desk";
import Icon from "./ui/Icon";
import { APP_NAME } from "./brand";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [ask, setAsk] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "wallet">("chat");
  const name = APP_NAME;

  const onChanged = useCallback(() => setTimeout(() => setRefreshKey((k) => k + 1), 2500), []);
  const clearAsk = useCallback(() => setAsk(null), []);

  // A prompt typed on the landing page arrives as ?q=. Queue it; Chat sends it once a wallet is connected.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (q) {
      setAsk(q.slice(0, 500));
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="logo" aria-label={`${name} home`}>
          <span className="logo-mark">
            <Icon name="logo" />
          </span>
          <span>{name}</span>
          <span className="net-label">Solana mainnet</span>
        </Link>
        <div className="top-end">
          <WalletButton />
        </div>
      </header>

      <div className="view-switch" role="tablist" aria-label="View">
        <span className="view-switch-thumb" data-pos={view} aria-hidden="true" />
        <button role="tab" aria-selected={view === "chat"} className={view === "chat" ? "on" : ""} onClick={() => setView("chat")}>
          <Icon name="chat" size={16} /> Chat
        </button>
        <button role="tab" aria-selected={view === "wallet"} className={view === "wallet" ? "on" : ""} onClick={() => setView("wallet")}>
          <Icon name="wallet" size={16} /> Wallet
        </button>
      </div>

      <main className={`main view-${view}`}>
        <Chat onChanged={onChanged} pendingAsk={ask} clearAsk={clearAsk} />
        <Desk
          refreshKey={refreshKey}
          onAsk={(t) => {
            setView("chat");
            setAsk(t);
          }}
        />
      </main>
    </div>
  );
}
