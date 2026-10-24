"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { PendingAction } from "@/lib/types";
import { executeAction } from "@/lib/client-exec";
import Icon from "./ui/Icon";

const STAGES = ["Sign", "Send", "Confirm"];
/** Map the executor's free-text step to a stage index. */
function stageOf(step: string) {
  if (/confirm/i.test(step)) return 2;
  if (/send|landing|creating/i.test(step)) return 1;
  return 0;
}

type Props = {
  action: PendingAction;
  onResult: (a: PendingAction, outcome: { ok: true; signature?: string; id?: string } | { ok: false; rejected: boolean; message: string }) => void;
};

export default function ActionCard({ action, onResult }: Props) {
  const wallet = useWallet();
  const [state, setState] = useState<"idle" | "busy" | "done" | "failed" | "rejected">("idle");
  const [step, setStep] = useState("");
  const [sig, setSig] = useState<string>();
  const [orderId, setOrderId] = useState<string>();
  const [error, setError] = useState("");

  const simFailed = action.simulation && !action.simulation.ok;

  // Transactions built ahead of time carry a recent blockhash that goes stale after about a minute.
  const expires = action.exec.mode === "send" || action.exec.mode === "jup-swap";
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!expires || state !== "idle") return;
    const t = setTimeout(() => setExpired(true), 70_000);
    return () => clearTimeout(t);
  }, [expires, state]);

  async function approve() {
    setState("busy");
    setError("");
    try {
      const res = await executeAction(action, wallet as any, setStep);
      setSig(res.signature);
      setOrderId(res.id);
      setState("done");
      onResult(action, { ok: true, ...res });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const rejected = /reject|declin|denied|cancel/i.test(msg) && /user|wallet|request/i.test(msg);
      setError(rejected ? "You declined the request in your wallet." : msg);
      setState(rejected ? "rejected" : "failed");
      onResult(action, { ok: false, rejected, message: msg });
    }
  }

  function dismiss() {
    setState("rejected");
    onResult(action, { ok: false, rejected: true, message: "dismissed" });
  }

  const stage = state === "done" ? 3 : state === "busy" ? stageOf(step) : -1;

  return (
    <div className={`ticket ${state}`}>
      <div className="ticket-head">
        <div className="ticket-head-top">
          <span className="ticket-kind">{action.kind}</span>
          {action.simulation?.ok && state === "idle" && !expired && (
            <span className="sim ok">
              <Icon name="shield" size={13} /> Simulation passed
            </span>
          )}
        </div>
        <h3>{action.title}</h3>
      </div>
      <div className="perf" />
      <dl className="ticket-body">
        {action.lines.map((l, i) => (
          <div key={i}>
            <dt>{l.k}</dt>
            <dd className="mono">{l.v}</dd>
          </div>
        ))}
      </dl>
      {(action.warnings?.length || simFailed) && (
        <ul className="ticket-warn">
          {simFailed && (
            <li>
              <Icon name="alert" size={14} /> Simulation failed: {action.simulation?.error}. It may still work, but check before approving.
            </li>
          )}
          {action.warnings?.map((w, i) => (
            <li key={i}>
              <Icon name="alert" size={14} /> {w}
            </li>
          ))}
        </ul>
      )}
      {(state === "busy" || state === "done") && (
        <ol className="stages" aria-label="Progress">
          {STAGES.map((label, i) => (
            <li key={label} className={i < stage ? "done" : i === stage ? "active" : ""}>
              <span className="stage-dot">{i < stage ? <Icon name="check" size={11} strokeWidth={3} /> : i === stage ? <span className="step-spinner" /> : null}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      <div className="ticket-foot">
        {state === "idle" && expired && (
          <>
            <span className="status muted">
              <Icon name="clock" size={14} /> This quote expired. Ask again to get a fresh one.
            </span>
            <button className="btn btn-ghost btn-sm" onClick={dismiss}>
              Dismiss
            </button>
          </>
        )}
        {state === "idle" && !expired && (
          <>
            <button className="btn btn-primary" onClick={approve} disabled={!wallet.connected}>
              <Icon name="wallet" size={17} /> Approve in wallet
            </button>
            <button className="btn btn-ghost" onClick={dismiss}>
              Dismiss
            </button>
          </>
        )}
        {state === "busy" && (
          <button className="btn btn-primary" disabled aria-busy="true">
            <span className="btn-spinner" aria-hidden="true" />
            {step || "Working"}…
          </button>
        )}
        {state === "done" && (
          <span className="status ok">
            <span className="ok-badge">
              <Icon name="check" size={13} strokeWidth={3} />
            </span>
            Confirmed
            {sig && (
              <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
                View on Solscan <Icon name="external" size={13} />
              </a>
            )}
            {orderId && !sig && <span className="mono"> · order {orderId.slice(0, 8)}</span>}
          </span>
        )}
        {state === "rejected" && <span className="status muted">{error || "Dismissed"}</span>}
        {state === "failed" && (
          <>
            <span className="status bad">
              <Icon name="alert" size={14} /> {error}
            </span>
            {!expires && (
              <button className="btn btn-ghost btn-sm" onClick={approve}>
                <Icon name="retry" size={14} /> Try again
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
