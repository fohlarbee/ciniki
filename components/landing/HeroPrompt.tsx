"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Icon from "../ui/Icon";
import { APP_NAME } from "../brand";

const EXAMPLES = ["Swap 1 SOL to USDC", "Stake 2 SOL with JitoSOL", "Buy $50 of SOL every week"];

/** A real prompt box: submitting opens the app with the request queued. */
export default function HeroPrompt() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const go = (text: string) => {
    const t = text.trim();
    if (!t) return;
    start(() => router.push(`/app?q=${encodeURIComponent(t)}`));
  };
  return (
    <div className="hero-prompt">
      <form
        className="prompt-box"
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
      >
        <label htmlFor="hero-q" className="sr-only">
          What do you want to do?
        </label>
        <input id="hero-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="What do you want to do on Solana?" autoComplete="off" />
        <button type="submit" className="btn btn-primary" disabled={!q.trim() || pending} aria-busy={pending}>
          {pending ? <span className="btn-spinner" aria-hidden="true" /> : <Icon name="send" size={17} strokeWidth={2.2} />}
          Ask {APP_NAME}
        </button>
      </form>
      <p className="prompt-examples">
        Try{" "}
        {EXAMPLES.map((e, i) => (
          <span key={e}>
            <button type="button" onClick={() => setQ(e)}>
              {e}
            </button>
            {i < EXAMPLES.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>
    </div>
  );
}
