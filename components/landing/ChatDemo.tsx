"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";

const SCRIPTS = [
  {
    prompt: "Swap 1 SOL to USDC",
    steps: ["Resolving tokens", "Getting best route", "Simulating"],
    reply: "Best route found through Jupiter. Review the ticket and approve in your wallet.",
    kind: "Swap",
    title: "Swap 1 SOL → USDC",
    lines: [
      ["You pay", "1 SOL"],
      ["You receive", "~ quoted USDC"],
      ["Max slippage", "0.5%"],
    ],
  },
  {
    prompt: "Buy $50 of SOL every week for 8 weeks",
    steps: ["Reading wallet balances", "Preparing recurring order"],
    reply: "This runs on-chain in Jupiter escrow. You can cancel it any time from the Orders tab.",
    kind: "Automate",
    title: "Recurring buy · SOL",
    lines: [
      ["Each buy", "$50 USDC"],
      ["Frequency", "Weekly × 8"],
      ["Total", "$400 USDC"],
    ],
  },
  {
    prompt: "Stake 2 SOL with JitoSOL",
    steps: ["Resolving tokens", "Getting best route", "Simulating"],
    reply: "Liquid staking keeps your SOL usable while it earns. Ready when you are.",
    kind: "Stake",
    title: "Stake 2 SOL → JitoSOL",
    lines: [
      ["You stake", "2 SOL"],
      ["You receive", "~ quoted JitoSOL"],
      ["Type", "Liquid staking"],
    ],
  },
];

type Phase = "typing" | "sent" | "steps" | "reply" | "ticket" | "approved";

export default function ChatDemo() {
  const [i, setI] = useState(0);
  // Server render shows a finished frame, so the window is never empty while JS loads.
  const [typed, setTyped] = useState(SCRIPTS[0].prompt);
  const [phase, setPhase] = useState<Phase>("ticket");
  const [stepN, setStepN] = useState(SCRIPTS[0].steps.length);
  const [visible, setVisible] = useState(true);
  const [still, setStill] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const s = SCRIPTS[i];

  useEffect(() => {
    // Start the animated loop once hydrated, unless the user prefers reduced motion.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => {
        setTyped("");
        setStepN(0);
        setPhase("typing");
        setStill(false);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, []);

  // Pause the loop while the demo is offscreen.
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !visible) return;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (typed.length < s.prompt.length) t = setTimeout(() => setTyped(s.prompt.slice(0, typed.length + 1)), 42);
      else t = setTimeout(() => setPhase("sent"), 450);
    } else if (phase === "sent") t = setTimeout(() => setPhase("steps"), 400);
    else if (phase === "steps") {
      if (stepN < s.steps.length) t = setTimeout(() => setStepN((n) => n + 1), 650);
      else t = setTimeout(() => setPhase("reply"), 350);
    } else if (phase === "reply") t = setTimeout(() => setPhase("ticket"), 700);
    else if (phase === "ticket") t = setTimeout(() => setPhase("approved"), 2200);
    else if (phase === "approved")
      t = setTimeout(() => {
        setI((n) => (n + 1) % SCRIPTS.length);
        setTyped("");
        setStepN(0);
        setPhase("typing");
      }, 2400);
    return () => clearTimeout(t);
  }, [phase, typed, stepN, s, visible, still]);

  const after = (p: Phase) => ["sent", "steps", "reply", "ticket", "approved"].indexOf(phase) >= ["sent", "steps", "reply", "ticket", "approved"].indexOf(p);

  return (
    <div className="demo" ref={ref} aria-label="Product demo" role="img">
      <div className="demo-bar">
        <span className="demo-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="demo-url">brine / app</span>
        <span className="demo-live">
          <i /> Live
        </span>
      </div>
      <div className="demo-body">
        {after("sent") && (
          <div className="d-row user" key={`u${i}`}>
            <div className="d-bubble user">{s.prompt}</div>
          </div>
        )}
        {after("steps") && (
          <div className="d-row bot" key={`b${i}`}>
            <span className="avatar sm">
              <Icon name="logo" size={14} />
            </span>
            <div className="d-bubble bot">
              <ul className="d-steps">
                {s.steps.map((st, k) => (
                  <li key={st} className={k < stepN ? "done" : k === stepN && phase === "steps" ? "running" : "idle"}>
                    <span>{k < stepN ? <Icon name="check" size={10} strokeWidth={3} /> : k === stepN && phase === "steps" ? <i className="d-spin" /> : null}</span>
                    {st}
                  </li>
                ))}
              </ul>
              {after("reply") && <p className="d-reply">{s.reply}</p>}
              {after("ticket") && (
                <div className={`d-ticket${phase === "approved" ? " ok" : ""}`}>
                  <div className="d-ticket-head">
                    <span className="ticket-kind">{s.kind}</span>
                    <b>{s.title}</b>
                  </div>
                  <dl>
                    {s.lines.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd className="mono">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {phase === "approved" ? (
                    <div className="d-ok">
                      <span className="ok-badge">
                        <Icon name="check" size={12} strokeWidth={3} />
                      </span>
                      Approved in your wallet
                    </div>
                  ) : (
                    <div className="d-actions">
                      <span className="d-btn primary">
                        <Icon name="wallet" size={14} /> Approve in wallet
                      </span>
                      <span className="d-btn">Dismiss</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="demo-input">
        <span className={phase === "typing" ? "typing" : ""}>{phase === "typing" ? typed : <em>Ask anything about DeFi on Solana…</em>}</span>
        <span className="send-btn sm">
          <Icon name="send" size={15} strokeWidth={2.4} />
        </span>
      </div>
    </div>
  );
}
