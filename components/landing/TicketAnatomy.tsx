import Ticket from "../Ticket";

const NOTES = [
  { side: "left", row: "sim", title: "Simulated before you sign", body: "Every transaction runs against the chain first. A failed simulation shows up here in red." },
  { side: "left", row: "verified", title: "Verified tokens only", body: "Symbols resolve to verified tokens. Look-alikes with copied names are refused." },
  { side: "right", row: "expiry", title: "Quotes expire", body: "Swap quotes go stale after about a minute, so you never sign an old price." },
  { side: "right", row: "sign", title: "Only your wallet signs", body: "Your keys stay in Phantom or Solflare. Dismiss the ticket and nothing is sent." },
];

export default function TicketAnatomy() {
  return (
    <div className="anatomy">
      <ul className="notes notes-left">
        {NOTES.filter((n) => n.side === "left").map((n) => (
          <li key={n.row} className={`note note-${n.row}`}>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
          </li>
        ))}
      </ul>
      <div className="anatomy-ticket">
        <Ticket
          kind="Swap"
          title="2 SOL for about 203.2 USDC"
          number="0587"
          lines={[
            { k: "You pay", v: "2 SOL" },
            { k: "You receive", v: "≈ 203.2 USDC" },
            { k: "Route", v: "Jupiter" },
            { k: "Price impact", v: "< 0.01%" },
          ]}
          checks={[
            { tone: "ok", text: "Simulation passed" },
            { tone: "ok", text: "USDC is a verified token" },
          ]}
          expiryLabel="0:41"
          footer={
            <>
              <span className="btn btn-signal btn-lg" aria-hidden="true">
                Approve in wallet
              </span>
              <span className="btn btn-ghost btn-lg" aria-hidden="true">
                Dismiss
              </span>
            </>
          }
        />
      </div>
      <ul className="notes notes-right">
        {NOTES.filter((n) => n.side === "right").map((n) => (
          <li key={n.row} className={`note note-${n.row}`}>
            <h3>{n.title}</h3>
            <p>{n.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
