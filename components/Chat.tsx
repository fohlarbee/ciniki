"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletButton from "./WalletButton";
import { useWalletStatus } from "./useWalletStatus";
import type { ChatEvent, HistoryMsg, PendingAction } from "@/lib/types";
import ActionCard from "./ActionCard";
import Md from "./Md";
import Icon, { type IconName } from "./ui/Icon";

type ToolEv = { name: string; label: string; status: "running" | "done" | "error" };
type Msg = { id: string; role: "user" | "assistant"; text: string; tools: ToolEv[]; actions: PendingAction[]; hidden?: boolean; error?: boolean };

const STARTERS: { group: string; icon: IconName; items: string[] }[] = [
  { group: "Trade", icon: "swap", items: ["Swap 0.5 SOL to USDC", "What's the price of JUP and is it safe to buy?"] },
  { group: "Earn", icon: "earn", items: ["What are the best stablecoin yields on Solana right now?", "Deposit 100 USDC to earn interest"] },
  { group: "Borrow & stake", icon: "stake", items: ["Show me borrow markets and their liquidation limits", "Stake 2 SOL with JitoSOL"] },
  { group: "Automate", icon: "clock", items: ["Buy $200 of SOL with USDC every week for 8 weeks", "Sell half my SOL if it goes above $300, stop loss at $150"] },
];

const uid = () => Math.random().toString(36).slice(2);

export default function Chat({ onChanged, pendingAsk, clearAsk }: { onChanged: () => void; pendingAsk: string | null; clearAsk: () => void }) {
  const { publicKey } = useWallet();
  const status = useWalletStatus();
  const wallet = publicKey?.toBase58();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const msgsRef = useRef<Msg[]>([]);
  msgsRef.current = msgs;

  // Follow the stream only while the reader is already at the bottom.
  useEffect(() => {
    if (atBottom) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  // Auto-grow the composer up to its max height.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [input]);

  // A different wallet is a different session.
  useEffect(() => {
    setMsgs([]);
  }, [wallet]);

  const toHistory = (list: Msg[]): HistoryMsg[] =>
    list
      .map((m) => ({
        role: m.role,
        content: m.text.trim() || m.actions.map((a) => `[Prepared for approval: ${a.title}]`).join(" "),
      }))
      .filter((m) => m.content);

  const send = useCallback(
    async (text: string, opts?: { hiddenUser?: boolean }) => {
      if (!wallet || busy || !text.trim()) return;
      const userMsg: Msg = { id: uid(), role: "user", text: text.trim(), tools: [], actions: [], hidden: opts?.hiddenUser };
      const botId = uid();
      const base = [...msgsRef.current, userMsg];
      setMsgs([...base, { id: botId, role: "assistant", text: "", tools: [], actions: [] }]);
      setBusy(true);
      const ac = new AbortController();
      abortRef.current = ac;

      const patch = (fn: (m: Msg) => Msg) => setMsgs((cur) => cur.map((m) => (m.id === botId ? fn(m) : m)));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet, messages: toHistory(base) }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) throw new Error((await res.text()) || `Request failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const raw = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 2);
            if (!raw.startsWith("data:")) continue;
            const ev = JSON.parse(raw.slice(5)) as ChatEvent;
            if (ev.type === "text") patch((m) => ({ ...m, text: m.text + ev.delta }));
            else if (ev.type === "tool")
              patch((m) => {
                const tools = [...m.tools];
                const last = tools.map((t) => t.name).lastIndexOf(ev.name);
                if (ev.status === "running" || last < 0) tools.push({ name: ev.name, label: ev.label, status: ev.status });
                else tools[last] = { ...tools[last], status: ev.status };
                return { ...m, tools };
              });
            else if (ev.type === "action") patch((m) => ({ ...m, actions: [...m.actions, ev.action] }));
            else if (ev.type === "limit") setRemaining(ev.remaining);
            else if (ev.type === "error") patch((m) => ({ ...m, error: true, text: (m.text ? m.text + "\n\n" : "") + ev.message }));
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, error: true, text: (m.text ? m.text + "\n\n" : "") + (e instanceof Error ? e.message : "Request failed") }));
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wallet, busy]
  );

  useEffect(() => {
    if (pendingAsk && wallet && !busy) {
      send(pendingAsk);
      clearAsk();
    }
  }, [pendingAsk, wallet, busy, send, clearAsk]);

  const onResult = useCallback(
    (a: PendingAction, o: { ok: true; signature?: string; id?: string } | { ok: false; rejected: boolean; message: string }) => {
      const note = o.ok
        ? `[wallet event] The user approved "${a.title}" and it succeeded.${o.signature ? ` Signature: ${o.signature}.` : ""}${o.id ? ` Order id: ${o.id}.` : ""}`
        : o.rejected
          ? `[wallet event] The user did not approve "${a.title}".`
          : `[wallet event] "${a.title}" failed: ${o.message.slice(0, 200)}`;
      // Record silently so the assistant has context on the next turn.
      setMsgs((cur) => [...cur, { id: uid(), role: "user", text: note, tools: [], actions: [], hidden: true }]);
      if (o.ok) onChanged();
    },
    [onChanged]
  );

  const retry = (botId: string) => {
    if (busy) return;
    const list = msgsRef.current;
    const bi = list.findIndex((m) => m.id === botId);
    let ui = bi - 1;
    while (ui >= 0 && (list[ui].role !== "user" || list[ui].hidden)) ui--;
    if (ui < 0) return;
    const text = list[ui].text;
    const next = list.slice(0, ui);
    msgsRef.current = next;
    setMsgs(next);
    setAtBottom(true);
    send(text);
  };

  const copy = async (m: Msg) => {
    try {
      await navigator.clipboard.writeText(m.text);
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (status === "restoring") {
    return (
      <section className="chat">
        <div className="welcome" aria-busy="true">
          <div className="restoring">
            <span className="restoring-ring" aria-hidden="true">
              <Icon name="wallet" size={22} />
            </span>
            <p>Reconnecting your wallet…</p>
          </div>
        </div>
      </section>
    );
  }

  if (status === "disconnected") {
    return (
      <section className="chat">
        <div className="welcome">
          <div className="welcome-card">
            <span className="welcome-orb" aria-hidden="true">
              <Icon name="sparkle" size={28} />
            </span>
            <h1>Connect your wallet to start</h1>
            <p>Ask for a swap, a yield, a stake or an automation. Every transaction is prepared for you to review and signed in your own wallet.</p>
            <WalletButton />
            <ul className="welcome-points">
              <li><Icon name="lock" size={16} /> Non-custodial</li>
              <li><Icon name="shield" size={16} /> Simulated before you sign</li>
              <li><Icon name="check" size={16} /> You approve everything</li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  const visible = msgs.filter((m) => !m.hidden);
  const lastId = visible[visible.length - 1]?.id;

  return (
    <section className="chat">
      <div className="scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="thread">
          {visible.length === 0 ? (
            <div className="starters">
              <span className="starters-orb" aria-hidden="true">
                <Icon name="sparkle" size={22} />
              </span>
              <h2>What do you want to do?</h2>
              <p>Pick a prompt or type your own. Nothing moves until you approve it in your wallet.</p>
              <div className="starter-grid">
                {STARTERS.map((s, gi) => (
                  <div key={s.group} className="starter-group" style={{ animationDelay: `${gi * 70}ms` }}>
                    <h3>
                      <span className="starter-icon">
                        <Icon name={s.icon} size={16} />
                      </span>
                      {s.group}
                    </h3>
                    {s.items.map((t) => (
                      <button key={t} onClick={() => send(t)} disabled={busy}>
                        <span>{t}</span>
                        <Icon name="arrowRight" size={15} />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            visible.map((m) => {
              const streaming = busy && m.id === lastId && m.role === "assistant";
              const empty = !m.text && m.actions.length === 0;
              return (
                <div key={m.id} className={`row-msg ${m.role}`}>
                  {m.role === "assistant" && (
                    <span className="avatar" aria-hidden="true">
                      <Icon name="logo" size={16} />
                    </span>
                  )}
                  <article className={`bubble ${m.role}${m.error ? " error" : ""}`}>
                    {m.role === "assistant" && m.tools.length > 0 && (
                      <ul className="steps" aria-label="Agent steps">
                        {m.tools.map((t, i) => (
                          <li key={i} className={t.status}>
                            <span className="step-icon">
                              {t.status === "running" ? <span className="step-spinner" /> : <Icon name={t.status === "error" ? "x" : "check"} size={12} strokeWidth={2.6} />}
                            </span>
                            {t.label}
                            {t.status === "error" ? " failed" : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                    {m.text ? (
                      <div className={`md${streaming ? " streaming" : ""}`}>
                        <Md text={m.text} />
                      </div>
                    ) : streaming && empty && !m.tools.some((t) => t.status === "running") ? (
                      <span className="thinking">Thinking</span>
                    ) : null}
                    {m.actions.map((a) => (
                      <ActionCard key={a.id} action={a} onResult={onResult} />
                    ))}
                    {m.role === "assistant" && !streaming && (m.text || m.error) && (
                      <div className="bubble-tools">
                        {m.text && (
                          <button type="button" onClick={() => copy(m)} aria-label="Copy reply">
                            <Icon name={copied === m.id ? "check" : "copy"} size={14} />
                            {copied === m.id ? "Copied" : "Copy"}
                          </button>
                        )}
                        {m.error && (
                          <button type="button" onClick={() => retry(m.id)} disabled={busy}>
                            <Icon name="retry" size={14} /> Retry
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>
      </div>

      {!atBottom && (
        <button
          type="button"
          className="jump"
          onClick={() => {
            setAtBottom(true);
            endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
          }}
        >
          <Icon name="arrowDown" size={15} /> Latest
        </button>
      )}

      <div className="composer-wrap">
        <form
          className={`composer${busy ? " busy" : ""}`}
          onSubmit={(e) => {
            e.preventDefault();
            const t = input;
            setInput("");
            setAtBottom(true);
            send(t);
          }}
        >
          <textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Swap 1 SOL to USDC, find the best yield, set a stop loss…"
            rows={1}
            aria-label="Message"
          />
          {busy ? (
            <button type="button" className="send-btn stop" onClick={() => abortRef.current?.abort()} aria-label="Stop generating">
              <Icon name="stop" size={16} />
            </button>
          ) : (
            <button type="submit" className="send-btn" disabled={!input.trim()} aria-label="Send message">
              <Icon name="send" size={18} strokeWidth={2.4} />
            </button>
          )}
        </form>
        <div className="fine">
          <span>Not financial advice. Review every transaction.</span>
          <span className="fine-end">
            <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
            {remaining !== null && <span className="quota">{remaining} left today</span>}
          </span>
        </div>
      </div>
    </section>
  );
}
