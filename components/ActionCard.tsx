"use client";

import { useEffect, useState } from "react";
import Ticket, { ticketNumber, type TicketCheck } from "./Ticket";
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
  const [expiresAt] = useState(() => (expires ? Date.now() + 70_000 : undefined));
  useEffect(() => {
    if (!expiresAt || state !== "idle") return;
    const t = setTimeout(() => setExpired(true), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [expiresAt, state]);

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

  const checks: TicketCheck[] = [];
  if (action.simulation?.ok) checks.push({ tone: "ok", text: "Simulation passed" });
  if (simFailed) checks.push({ tone: "bad", text: `Simulation failed: ${action.simulation?.error}. It may still work, so check before approving.` });
  for (const w of action.warnings ?? []) checks.push({ tone: "warn", text: w });

  const footer = (
    <>
      {(state === "busy" || state === "done") && (
        <ol className="stages" aria-label="Progress">
          {STAGES.map((label, i) => (
            <li key={label} className={i < stage ? "done" : i === stage ? "active" : ""}>
              <span className="stage-dot">{i < stage ? <Icon name="check" size={11} strokeWidth={3} /> : i === stage ? <span className="btn-spinner" /> : null}</span>
              {label}
            </li>
          ))}
        </ol>
      )}
      {state === "idle" && expired && (
        <>
          <span className="status muted">Ask again for a fresh quote.</span>
          <button className="btn btn-ghost btn-sm" onClick={dismiss}>
            Dismiss
          </button>
        </>
      )}
      {state === "idle" && !expired && (
        <>
          <button className="btn btn-signal btn-lg" onClick={approve} disabled={!wallet.connected}>
            Approve in wallet
          </button>
          <button className="btn btn-ghost btn-lg" onClick={dismiss}>
            Dismiss
          </button>
        </>
      )}
      {state === "busy" && (
        <button className="btn btn-signal btn-lg" disabled aria-busy="true">
          <span className="btn-spinner" aria-hidden="true" />
          {step || "Working"}…
        </button>
      )}
      {state === "done" && (
        <span className="status ok">
          <Icon name="check" size={16} strokeWidth={2.6} />
          Approved and confirmed.
          {sig && (
            <a href={`https://solscan.io/tx/${sig}`} target="_blank" rel="noreferrer">
              View on Solscan
            </a>
          )}
          {orderId && !sig && <span> Order {orderId.slice(0, 8)}</span>}
        </span>
      )}
      {state === "rejected" && <span className="status muted">{error || "Dismissed. Nothing was sent."}</span>}
      {state === "failed" && (
        <>
          <span className="status bad">
            <Icon name="alert" size={15} /> {error}
          </span>
          {!expires && (
            <button className="btn btn-ghost btn-sm" onClick={approve}>
              Try again
            </button>
          )}
        </>
      )}
    </>
  );

  return (
    <Ticket
      kind={action.kind.charAt(0).toUpperCase() + action.kind.slice(1)}
      title={action.title}
      number={ticketNumber(action.id)}
      lines={action.lines}
      checks={checks}
      expiresAt={state === "idle" && !expired ? expiresAt : undefined}
      printing
      className={`state-${state}`}
      footer={footer}
    />
  );
}
