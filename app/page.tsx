import Nav from "@/components/landing/Nav";
import HeroPrompt from "@/components/landing/HeroPrompt";
import Ticket from "@/components/Ticket";
import AskList from "@/components/landing/AskList";
import TicketAnatomy from "@/components/landing/TicketAnatomy";
import LaunchLink from "@/components/ui/LaunchLink";
import { APP_NAME } from "@/components/brand";
import "@/styles/landing.css";

const name = APP_NAME;

const FAQ = [
  { q: `Does ${name} ever hold my funds?`, a: `No. ${name} prepares transactions and shows them as tickets. You sign each one in your own wallet, and the server never sees your private key.` },
  { q: "Which wallets work?", a: "Phantom and Solflare. Install either browser extension, open the app and connect." },
  { q: "What if I change my mind?", a: "Dismiss the ticket and nothing is sent. Recurring buys and price orders can be cancelled from the Orders tab, and escrowed funds come back to you." },
  { q: "Why do some tickets expire?", a: "Swap prices move. A quote is only good for about a minute, so an expired ticket asks you to request a fresh one instead of letting you sign an old price." },
  { q: "Does it cost anything?", a: "Asking is free up to a daily message limit. Transactions you approve pay normal Solana network fees, plus any fee shown on the ticket." },
  { q: "Is this financial advice?", a: `No. ${name} explains options and prepares transactions. Every decision is yours. Start with small amounts.` },
];

export default function Landing() {
  return (
    <div className="landing">
      <Nav name={name} />

      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <h1 className="hero-title">
              <span>Say what you want.</span>
              <span>Sign what you see.</span>
            </h1>
            <p className="hero-sub">
              {name} is a chat for Solana DeFi. Ask for a swap, a stake or a recurring buy. It prepares the transaction as a ticket you can read, and nothing moves until you approve it in your own wallet.
            </p>
            <HeroPrompt />
            <p className="hero-note">Works with Phantom and Solflare. {name} never holds your keys.</p>
          </div>

          <div className="hero-demo" aria-label="Example ticket">
            <p className="typed-ask">
              <span>Swap 1 SOL to USDC</span>
            </p>
            <div className="slot" aria-hidden="true" />
            <div className="slot-window">
              <Ticket
                kind="Swap"
                title="1 SOL for about 101.6 USDC"
                number="0412"
                lines={[
                  { k: "You pay", v: "1 SOL" },
                  { k: "You receive", v: "≈ 101.6 USDC" },
                  { k: "Route", v: "Jupiter" },
                  { k: "Max slippage", v: "0.5%" },
                ]}
                checks={[
                  { tone: "ok", text: "Simulation passed" },
                  { tone: "ok", text: "USDC is a verified token" },
                ]}
                expiryLabel="0:58"
                printing
                className="hero-ticket"
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
            <p className="demo-caption">Example ticket. Prices are live when you ask.</p>
          </div>
        </div>
      </section>

      <section className="section" id="ask">
        <div className="wrap">
          <div className="section-head">
            <h2>Ask for it in plain words</h2>
            <p>Trades, deposits, loans, staking, recurring buys and token checks. Pick a request to see the ticket it produces.</p>
          </div>
          <AskList />
        </div>
      </section>

      <section className="section section-sheet" id="ticket">
        <div className="wrap">
          <div className="section-head">
            <h2>Every ticket shows what you are signing</h2>
            <p>The ticket is the whole point. Read it, and approve only if it matches what you asked for.</p>
          </div>
          <TicketAnatomy />
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap how">
          <h2>How it works</h2>
          <ol className="how-steps">
            <li>
              <h3>Ask</h3>
              <p>Type what you want, the way you would say it.</p>
            </li>
            <li>
              <h3>Read the ticket</h3>
              <p>{name} finds the route, simulates it and lists every number that matters.</p>
            </li>
            <li>
              <h3>Approve in your wallet</h3>
              <p>Your wallet signs. Nothing moves until you approve, and you can dismiss any ticket.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap faq-wrap">
          <h2>Questions</h2>
          <div className="faq">
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="l-foot">
        <div className="wrap">
          <div className="foot-cta">
            <h2>Start with a small trade.</h2>
            <LaunchLink className="btn btn-primary btn-lg">Open {name}</LaunchLink>
          </div>
          <div className="foot-meta">
            <p>
              {name} is Hausa for trade. Prices and routes come from Jupiter, yields from DefiLlama and token data from DexScreener. Not financial advice. DeFi carries risk, including loss of funds.
            </p>
            <nav aria-label="Footer">
              <a href="#ask">What you can ask</a>
              <a href="#ticket">Security</a>
              <a href="#faq">FAQ</a>
              <a href="https://github.com/fohlarbee/solanon">GitHub</a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
