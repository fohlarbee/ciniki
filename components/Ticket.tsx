"use client";

import { useEffect, useState } from "react";
import Icon from "./ui/Icon";

export type TicketCheck = { tone: "ok" | "warn" | "bad"; text: string };

type Props = {
  kind: string;
  title: string;
  /** Short reference shown in the header, e.g. "0412". */
  number?: string;
  lines: { k: string; v: string }[];
  checks?: TicketCheck[];
  /** Epoch ms when the quote goes stale. Shows a live countdown. */
  expiresAt?: number;
  /** Fixed expiry text for examples, where a live clock would differ between server and browser. */
  expiryLabel?: string;
  /** Background behind the ticket, so the perforation notches look cut out. */
  notchBg?: string;
  printing?: boolean;
  footer?: React.ReactNode;
  className?: string;
};

function useCountdown(expiresAt?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt - now) / 1000));
}

/** Derive a stable 4-digit ticket number from an id. */
export function ticketNumber(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, "0");
}

export default function Ticket({ kind, title, number, lines, checks = [], expiresAt, expiryLabel, notchBg, printing, footer, className = "" }: Props) {
  const left = useCountdown(expiresAt);
  return (
    <article className={`ticket${printing ? " printing" : ""} ${className}`} style={notchBg ? ({ "--notch-bg": notchBg } as React.CSSProperties) : undefined}>
      <header className="ticket-head">
        <span className="ticket-kind">{kind}</span>
        {number && <span className="ticket-no">Ticket {number}</span>}
      </header>
      <h3 className="ticket-title">{title}</h3>
      <div className="tear" aria-hidden="true" />
      <dl className="ticket-rows">
        {lines.map((l, i) => (
          <div key={i}>
            <dt>{l.k}</dt>
            <dd>{l.v}</dd>
          </div>
        ))}
      </dl>
      {(checks.length > 0 || left !== null || expiryLabel) && (
        <ul className="ticket-checks">
          {checks.map((c, i) => (
            <li key={i} className={c.tone}>
              <Icon name={c.tone === "ok" ? "check" : "alert"} size={15} strokeWidth={2.2} />
              {c.text}
            </li>
          ))}
          {expiryLabel && left === null && (
            <li className="ticket-expiry">
              <Icon name="clock" size={15} />
              <span>
                Quote expires in <b>{expiryLabel}</b>
              </span>
            </li>
          )}
          {left !== null && (
            <li className={`ticket-expiry${left <= 15 ? " late" : ""}`}>
              <Icon name="clock" size={15} />
              {left > 0 ? (
                <span>
                  Quote expires in <b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</b>
                </span>
              ) : (
                <span>Quote expired</span>
              )}
            </li>
          )}
        </ul>
      )}
      {footer && (
        <>
          <div className="tear" aria-hidden="true" />
          <footer className="ticket-foot">{footer}</footer>
        </>
      )}
    </article>
  );
}
