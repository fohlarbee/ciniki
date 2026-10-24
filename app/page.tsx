import Link from "next/link";
import Nav from "@/components/landing/Nav";
import ChatDemo from "@/components/landing/ChatDemo";
import FeatureCard from "@/components/landing/FeatureCard";
import Reveal from "@/components/landing/Reveal";
import Icon, { type IconName } from "@/components/ui/Icon";
import "@/styles/landing.css";

const name = process.env.NEXT_PUBLIC_APP_NAME || "Brine";

const MARQUEE = ["Swaps", "Lending", "Borrowing", "Native staking", "Liquid staking", "Recurring buys", "Limit orders", "Take-profit", "Stop-loss", "Token risk scans", "Yield scanner", "Transfers"];
const SOURCES = ["Jupiter", "DefiLlama", "DexScreener", "Solana mainnet"];

const FEATURES: { icon: IconName; title: string; body: string; example: string }[] = [
  { icon: "swap", title: "Trade", body: "Best-route swaps across Solana liquidity through Jupiter, with slippage and price impact shown before you sign.", example: "Swap 0.5 SOL to USDC" },
  { icon: "earn", title: "Earn", body: "Scan yields across Solana, then deposit into Jupiter Lend in one step and withdraw whenever you like.", example: "Best stablecoin yields right now?" },
  { icon: "borrow", title: "Borrow", body: "Open vaults, add collateral, borrow and repay. Your loan-to-value and liquidation limit stay in view.", example: "Show borrow markets and their limits" },
  { icon: "stake", title: "Stake", body: "Native staking with validator selection, or liquid staking into JitoSOL and mSOL so your SOL keeps working.", example: "Stake 2 SOL with JitoSOL" },
  { icon: "clock", title: "Automate", body: "Recurring buys, limit orders, take-profit, stop-loss and OCO pairs that run on-chain in Jupiter escrow.", example: "Buy $200 of SOL every week" },
  { icon: "search", title: "Research", body: "Check any token before you buy: verification, mint and freeze authority, holder concentration, liquidity and risk flags.", example: "Is JUP safe to buy?" },
];

const SECURITY: { icon: IconName; title: string; body: string }[] = [
  { icon: "key", title: "Your keys never leave your wallet", body: "The server never holds a private key. Every transaction is signed in Phantom or Solflare by you." },
  { icon: "eye", title: "Simulated before you sign", body: "Transactions are simulated on-chain first, so you see a pass or a warning before you approve." },
  { icon: "shield", title: "Look-alike tokens refused", body: "Symbols resolve to verified tokens only. Copycat tokens with familiar names are rejected." },
  { icon: "clock", title: "Stale quotes expire", body: "Prepared swaps expire after about a minute, so you never sign against an outdated price." },
];

const FAQ = [
  { q: `Does ${name} ever hold my funds?`, a: `No. ${name} prepares transactions and shows them to you as a ticket. You sign each one in your own wallet, and the server never sees your private key.` },
  { q: "Which wallets are supported?", a: "Phantom and Solflare. Install either browser extension, open the app and connect." },
  { q: "What can I ask it to do?", a: "Swap tokens, send tokens, lend and borrow on Jupiter Lend, stake SOL natively or through liquid staking, set recurring buys and price orders, and research token risk." },
  { q: "What happens if I change my mind?", a: "Dismiss the ticket and nothing happens. Automated orders can be cancelled from the Orders tab, and escrowed funds are returned." },
  { q: "Is this financial advice?", a: `No. ${name} explains options and prepares transactions, but every decision is yours. Start with small amounts.` },
  { q: "Does it cost anything?", a: "Using the assistant is free within a daily message allowance. You pay normal Solana network fees on transactions you approve." },
];

export default function Landing() {
  return (
    <div className="landing">
      <Nav name={name} />

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg" aria-hidden="true">
          <span className="orb o1" />
          <span className="orb o2" />
          <span className="orb o3" />
          <span className="grid-bg" />
        </div>
        <div className="wrap hero-inner">
          <div className="hero-copy">
            <span className="eyebrow">
              <i /> AI agent for Solana DeFi
            </span>
            <h1>
              DeFi on Solana,
              <br />
              <span className="grad-text">just by asking.</span>
            </h1>
            <p className="lede">
              Swap, earn, borrow, stake and automate in plain English. {name} prepares every transaction, you review a clear ticket, and you sign in your own wallet.
            </p>
            <div className="hero-ctas">
              <Link href="/app" className="btn btn-primary btn-lg">
                Launch app <Icon name="arrowRight" />
              </Link>
              <a href="#how" className="btn btn-ghost btn-lg">
                See how it works
              </a>
            </div>
            <ul className="hero-trust">
              <li>
                <Icon name="lock" size={16} /> Non-custodial
              </li>
              <li>
                <Icon name="shield" size={16} /> Simulated first
              </li>
              <li>
                <Icon name="check" size={16} /> You approve every step
              </li>
            </ul>
          </div>
          <div className="hero-demo">
            <ChatDemo />
          </div>
        </div>
      </section>

      {/* Marquee */}
      <section className="marquee" aria-label="Supported actions">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i}>
              <Icon name="sparkle" size={14} /> {m}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="section" id="how">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">How it works</span>
            <h2>
              From idea to on-chain in <span className="grad-text">three steps</span>
            </h2>
            <p>No dashboards to learn and no forms to fill. Say what you want and stay in control of every transaction.</p>
          </Reveal>
          <ol className="steps-row">
            {[
              { icon: "chat" as IconName, t: "Ask", b: "Type what you want in your own words, like “swap half my SOL to USDC”." },
              { icon: "eye" as IconName, t: "Review", b: "The agent finds the route, simulates it and shows a ticket with every number that matters." },
              { icon: "wallet" as IconName, t: "Sign", b: "Approve in your wallet. Nothing moves until you do, and you can dismiss any ticket." },
            ].map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 120} className="step-card">
                <span className="step-num">0{i + 1}</span>
                <span className="step-ico">
                  <Icon name={s.icon} size={22} />
                </span>
                <h3>{s.t}</h3>
                <p>{s.b}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="section" id="features">
        <div className="wrap">
          <Reveal className="section-head">
            <span className="kicker">Everything in one conversation</span>
            <h2>
              The whole Solana DeFi stack, <span className="grad-text">one prompt away</span>
            </h2>
            <p>Six kinds of action, one place to ask for them, and a ticket you can read before anything is signed.</p>
          </Reveal>
          <div className="f-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 100}>
                <FeatureCard {...f} />
              </Reveal>
            ))}
          </div>
          <Reveal className="sources">
            <span>Live data from</span>
            {SOURCES.map((s) => (
              <b key={s}>{s}</b>
            ))}
          </Reveal>
        </div>
      </section>

      {/* Security */}
      <section className="section security" id="security">
        <div className="wrap sec-inner">
          <Reveal className="sec-copy">
            <span className="kicker">Security first</span>
            <h2>
              You hold the keys.
              <br />
              <span className="grad-text">You make the call.</span>
            </h2>
            <p>{name} is built so that nothing happens without your signature. The agent prepares, explains and checks. You decide.</p>
            <Link href="/app" className="btn btn-secondary btn-lg">
              Try it with a small amount <Icon name="arrowRight" />
            </Link>
          </Reveal>
          <div className="sec-grid">
            {SECURITY.map((s, i) => (
              <Reveal key={s.title} delay={i * 90} className="sec-card">
                <span className="sec-ico">
                  <Icon name={s.icon} size={20} />
                </span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section" id="faq">
        <div className="wrap faq-wrap">
          <Reveal className="section-head">
            <span className="kicker">FAQ</span>
            <h2>Questions, answered</h2>
          </Reveal>
          <div className="faq">
            {FAQ.map((f, i) => (
              <Reveal key={f.q} delay={i * 60}>
                <details>
                  <summary>
                    {f.q}
                    <Icon name="chevron" size={18} />
                  </summary>
                  <p>{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section">
        <div className="wrap">
          <Reveal className="cta">
            <span className="cta-glow" aria-hidden="true" />
            <h2>Ready to do DeFi the easy way?</h2>
            <p>Connect Phantom or Solflare and make your first request in under a minute.</p>
            <Link href="/app" className="btn btn-lg cta-btn">
              Launch {name} <Icon name="arrowRight" />
            </Link>
          </Reveal>
        </div>
      </section>

      <footer className="l-foot">
        <div className="wrap foot-inner">
          <Link href="/" className="logo">
            <span className="logo-mark">
              <Icon name="logo" />
            </span>
            {name}
          </Link>
          <p>Not financial advice. DeFi carries risk, including loss of funds. Review every transaction before you sign.</p>
          <nav aria-label="Footer">
            <a href="#features">Features</a>
            <a href="#security">Security</a>
            <a href="#faq">FAQ</a>
            <Link href="/app">App</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
