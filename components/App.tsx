"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import WalletButton from "./WalletButton";
import Chat from "./Chat";
import Desk from "./Desk";
import Icon from "./ui/Icon";

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [ask, setAsk] = useState<string | null>(null);
  const [view, setView] = useState<"chat" | "wallet">("chat");
  const name = process.env.NEXT_PUBLIC_APP_NAME || "Brine";

  const onChanged = useCallback(() => setTimeout(() => setRefreshKey((k) => k + 1), 2500), []);
  const clearAsk = useCallback(() => setAsk(null), []);

  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="logo" aria-label={`${name} home`}>
          <span className="logo-mark">
            <Icon name="logo" />
          </span>
          <span>{name}</span>
          <span className="net-badge">
            <i /> Solana
          </span>
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
