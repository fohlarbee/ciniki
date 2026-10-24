"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { cachedJwt, executeAction, fetchOrders } from "@/lib/client-exec";
import Icon, { type IconName } from "./ui/Icon";
import { useWalletStatus } from "./useWalletStatus";

type Tab = "portfolio" | "positions" | "orders";

const money = (n?: number) => (n === undefined ? "–" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 1 ? 4 : 2 }));
const num = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });
const short = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

const ALLOC = ["#8b5cf6", "#2ee6a8", "#5b8cff", "#f472b6", "#ffc56b", "#22d3ee"];
const QUICK: { label: string; icon: IconName; prompt: string }[] = [
  { label: "Swap", icon: "swap", prompt: "I want to swap tokens. What can I swap from my wallet?" },
  { label: "Stake", icon: "stake", prompt: "What are my best options to stake SOL?" },
  { label: "Earn", icon: "earn", prompt: "What are the best yields for the tokens in my wallet?" },
  { label: "Send", icon: "send2", prompt: "I want to send tokens to another wallet." },
];

/** Animates a number toward its target so balance changes feel alive. */
function useCountUp(target: number | undefined, ms = 700) {
  const [v, setV] = useState(target ?? 0);
  const from = useRef(0);
  useEffect(() => {
    if (target === undefined) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      from.current = target;
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(a + (target - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function TokenIcon({ src, symbol, i }: { src?: string; symbol: string; i: number }) {
  const [bad, setBad] = useState(false);
  if (src && !bad) return <img className="tok-icon" src={src} alt="" width={36} height={36} onError={() => setBad(true)} />;
  return (
    <span className="tok-icon tok-fallback" style={{ background: `linear-gradient(135deg, ${ALLOC[i % ALLOC.length]}, ${ALLOC[(i + 1) % ALLOC.length]})` }}>
      {symbol.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "?"}
    </span>
  );
}

function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <>
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="tok-row skeleton-row" aria-hidden="true">
          <span className="skeleton" style={{ width: 36, height: 36, borderRadius: "50%" }} />
          <span className="row-main">
            <span className="skeleton" style={{ width: 70, height: 12 }} />
            <span className="skeleton" style={{ width: 110, height: 10, marginTop: 8 }} />
          </span>
          <span className="skeleton" style={{ width: 56, height: 12 }} />
        </li>
      ))}
    </>
  );
}

export default function Desk({ refreshKey, onAsk }: { refreshKey: number; onAsk: (text: string) => void }) {
  const wallet = useWallet();
  const status = useWalletStatus();
  const addr = wallet.publicKey?.toBase58();
  const [tab, setTab] = useState<Tab>("portfolio");
  const [portfolio, setPortfolio] = useState<any>();
  const [positions, setPositions] = useState<any>();
  const [orders, setOrders] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [cancelling, setCancelling] = useState<string>();

  const load = useCallback(async () => {
    if (!addr) return;
    setLoading(true);
    setErr("");
    try {
      const [p, pos] = await Promise.all([
        fetch(`/api/portfolio?wallet=${addr}`).then((r) => r.json()),
        fetch(`/api/positions?wallet=${addr}`).then((r) => r.json()),
      ]);
      if (p.error) throw new Error(p.error);
      setPortfolio(p);
      setPositions(pos.error ? undefined : pos);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load wallet data");
    } finally {
      setLoading(false);
    }
  }, [addr]);

  const loadOrders = useCallback(async () => {
    if (!addr) return;
    setErr("");
    try {
      const res = await fetchOrders(wallet as any, "active");
      setOrders(res.orders ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load orders");
    }
  }, [addr, wallet]);

  useEffect(() => {
    setPortfolio(undefined);
    setPositions(undefined);
    setOrders(null);
    load();
  }, [addr, refreshKey, load]);

  useEffect(() => {
    if (addr && cachedJwt(addr) && refreshKey >= 0) loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, refreshKey]);

  async function cancel(id: string) {
    setCancelling(id);
    setErr("");
    try {
      await executeAction({ id, kind: "order", title: "Cancel order", lines: [], exec: { mode: "trigger-cancel", orderId: id } }, wallet as any, () => {});
      await loadOrders();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setCancelling(undefined);
    }
  }

  const total = useCountUp(portfolio?.totalUsd);
  const [copiedAddr, setCopiedAddr] = useState(false);

  if (!addr && status === "restoring") {
    return (
      <aside className="desk" aria-busy="true">
        <section className="balance-card">
          <span className="skeleton" style={{ width: 90, height: 12, display: "block" }} />
          <span className="skeleton" style={{ width: 160, height: 34, display: "block", margin: "12px 0 18px" }} />
          <div className="quick">
            {QUICK.map((q) => (
              <span key={q.label} className="skeleton" style={{ width: 44, height: 44, borderRadius: 14, margin: "0 auto" }} />
            ))}
          </div>
        </section>
        <ul className="tok-list" style={{ marginTop: 18 }}>
          <SkeletonRows />
        </ul>
      </aside>
    );
  }

  if (!addr) {
    return (
      <aside className="desk">
        <div className="desk-empty-state">
          <span className="empty-icon">
            <Icon name="wallet" size={22} />
          </span>
          <p>Connect a wallet to see balances, open positions and active orders here.</p>
        </div>
      </aside>
    );
  }

  const nPos = (positions?.earn?.length ?? 0) + (positions?.borrow?.length ?? 0) + (positions?.stake?.length ?? 0);
  const holdings: any[] = portfolio?.holdings ?? [];
  const priced = holdings.filter((h) => h.usdValue > 0);
  const tabs: Tab[] = ["portfolio", "positions", "orders"];
  const tabIndex = tabs.indexOf(tab);

  return (
    <aside className="desk">
      <section className="balance-card">
        <div className="balance-top">
          <span className="balance-label">Wallet value</span>
          <button
            type="button"
            className="addr-chip mono"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(addr);
                setCopiedAddr(true);
                setTimeout(() => setCopiedAddr(false), 1400);
              } catch {
                /* clipboard unavailable */
              }
            }}
            title="Copy address"
          >
            {short(addr)}
            <Icon name={copiedAddr ? "check" : "copy"} size={12} />
          </button>
        </div>
        <div className="balance-row">
          <strong className="balance-value mono">{portfolio ? money(total) : loading ? <span className="skeleton" style={{ width: 140, height: 34, display: "inline-block" }} /> : "–"}</strong>
          <button type="button" className="btn-icon btn refresh-btn" onClick={load} disabled={loading} aria-label="Refresh balances">
            <Icon name="refresh" size={16} className={loading ? "spin" : ""} />
          </button>
        </div>
        {priced.length > 0 && portfolio.totalUsd > 0 && (
          <div className="alloc" aria-label="Allocation">
            <div className="alloc-bar">
              {priced.slice(0, 6).map((h, i) => (
                <span key={h.mint} style={{ width: `${(h.usdValue / portfolio.totalUsd) * 100}%`, background: ALLOC[i % ALLOC.length] }} title={`${h.symbol} ${((h.usdValue / portfolio.totalUsd) * 100).toFixed(1)}%`} />
              ))}
            </div>
            <ul className="alloc-legend">
              {priced.slice(0, 4).map((h, i) => (
                <li key={h.mint}>
                  <i style={{ background: ALLOC[i % ALLOC.length] }} />
                  {h.symbol} <span>{((h.usdValue / portfolio.totalUsd) * 100).toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="quick">
          {QUICK.map((q) => (
            <button key={q.label} type="button" onClick={() => onAsk(q.prompt)}>
              <span>
                <Icon name={q.icon} size={18} />
              </span>
              {q.label}
            </button>
          ))}
        </div>
      </section>

      <div className="seg" role="tablist" style={{ ["--i" as any]: tabIndex }}>
        <span className="seg-thumb" aria-hidden="true" />
        {tabs.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "portfolio" ? "Tokens" : t === "positions" ? "Positions" : "Orders"}
            {t === "positions" && nPos > 0 && <em>{nPos}</em>}
            {t === "orders" && !!orders?.length && <em>{orders.length}</em>}
          </button>
        ))}
      </div>

      {err && (
        <p className="desk-err">
          <Icon name="alert" size={14} /> {err}
        </p>
      )}

      {tab === "portfolio" && (
        <ul className="tok-list">
          {!portfolio && loading && <SkeletonRows />}
          {holdings.map((h: any, i: number) => (
            <li key={h.mint} style={{ animationDelay: `${i * 40}ms` }}>
              <button className="tok-row" onClick={() => onAsk(`Tell me about ${h.symbol} (${h.mint})`)} title="Ask about this token">
                <TokenIcon src={h.icon} symbol={h.symbol} i={i} />
                <span className="row-main">
                  <b>
                    {h.symbol}
                    {h.verified === false && <span className="badge warn">Unverified</span>}
                  </b>
                  <small className="mono">{num(h.amount)}</small>
                </span>
                <span className="row-end">
                  <b className="mono">{money(h.usdValue)}</b>
                  {h.usdPrice !== undefined && <small className="mono">{money(h.usdPrice)}</small>}
                </span>
              </button>
            </li>
          ))}
          {portfolio && !holdings.length && (
            <li className="desk-empty-state small">
              <p>This wallet is empty. Fund it with SOL to get started.</p>
            </li>
          )}
        </ul>
      )}

      {tab === "positions" && (
        <div className="tok-list">
          {!positions && loading && <SkeletonRows n={2} />}
          {positions?.earn?.map((p: any, i: number) => (
            <div className="tok-row static" key={`e${i}`}>
              <span className="pos-icon earn">
                <Icon name="earn" size={16} />
              </span>
              <span className="row-main">
                <b>Earn · {p.symbol}</b>
                <small>
                  {p.protocol}
                  {p.apyPct !== undefined && <span className="apy"> · {p.apyPct.toFixed(2)}% APY</span>}
                </small>
              </span>
              <span className="row-end">
                <b className="mono">
                  {p.underlying} {p.symbol}
                </b>
              </span>
            </div>
          ))}
          {positions?.borrow?.map((p: any, i: number) => {
            const ratio = p.liquidationLtvPct ? Math.min(1, p.ltvPct / p.liquidationLtvPct) : 0;
            const level = ratio > 0.85 ? "bad" : ratio > 0.65 ? "warn" : "ok";
            return (
              <div className="tok-row static col" key={`b${i}`}>
                <div className="tok-row-inner">
                  <span className="pos-icon borrow">
                    <Icon name="borrow" size={16} />
                  </span>
                  <span className="row-main">
                    <b>Borrow · vault #{p.vaultId}</b>
                    <small>
                      {p.collateral} → {p.debt}
                    </small>
                  </span>
                  <span className={`row-end ltv ${level}`}>
                    <b className="mono">LTV {p.ltvPct}%</b>
                    {p.liquidationLtvPct ? <small className="mono">max {p.liquidationLtvPct}%</small> : null}
                  </span>
                </div>
                {p.liquidationLtvPct ? (
                  <div className={`meter ${level}`}>
                    <span style={{ width: `${ratio * 100}%` }} />
                  </div>
                ) : null}
              </div>
            );
          })}
          {positions?.stake?.map((s: any) => (
            <div className="tok-row static" key={s.address}>
              <span className="pos-icon stake">
                <Icon name="stake" size={16} />
              </span>
              <span className="row-main">
                <b className="mono">{s.sol.toFixed(3)} SOL staked</b>
                <small>
                  <span className={`dot ${s.status}`} /> {s.status} · <span className="mono">{short(s.address)}</span>
                </small>
              </span>
              {s.status === "inactive" || s.status === "active" ? (
                <button className="btn btn-ghost btn-sm" onClick={() => onAsk(s.status === "active" ? `Unstake my native stake account ${s.address}` : `Withdraw my inactive stake account ${s.address}`)}>
                  {s.status === "active" ? "Unstake" : "Withdraw"}
                </button>
              ) : null}
            </div>
          ))}
          {positions && nPos === 0 && (
            <div className="desk-empty-state small">
              <span className="empty-icon">
                <Icon name="layers" size={20} />
              </span>
              <p>No open DeFi positions yet.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => onAsk("Earn yield on my USDC")}>
                Try “earn yield on my USDC”
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="tok-list">
          {orders === null ? (
            <div className="desk-empty-state small">
              <span className="empty-icon">
                <Icon name="clock" size={20} />
              </span>
              <p>Recurring buys and price orders live in Jupiter escrow. Sign a login message to list them.</p>
              <button className="btn btn-secondary btn-sm" onClick={loadOrders}>
                <Icon name="key" size={15} /> Sign in and load orders
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="desk-empty-state small">
              <span className="empty-icon">
                <Icon name="clock" size={20} />
              </span>
              <p>No active orders.</p>
              <button className="btn btn-secondary btn-sm" onClick={() => onAsk("Buy $50 of SOL every week for 8 weeks")}>
                Try “buy $50 of SOL every week”
              </button>
            </div>
          ) : (
            orders.map((o) => (
              <div className="tok-row static" key={o.id}>
                <span className="pos-icon order">
                  <Icon name={String(o.orderType).includes("dca") ? "clock" : "zap"} size={16} />
                </span>
                <span className="row-main">
                  <b style={{ textTransform: "capitalize" }}>{String(o.orderType).replace(/_/g, " ")}</b>
                  <small>
                    <span className="mono">
                      {short(o.inputMint)} → {short(o.outputMint)}
                    </span>
                    {o.triggerPriceUsd ? ` · @ ${money(o.triggerPriceUsd)}` : ""} · {o.orderState}
                  </small>
                </span>
                {String(o.orderType).includes("dca") ? (
                  <span className="badge">DCA</span>
                ) : (
                  <button className="btn btn-ghost btn-sm" disabled={cancelling === o.id} onClick={() => cancel(o.id)}>
                    {cancelling === o.id ? "Cancelling" : "Cancel"}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
