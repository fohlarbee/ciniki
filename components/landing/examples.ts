import type { TicketCheck } from "../Ticket";

export type Example = {
  id: string;
  group: string;
  prompt: string;
  kind: string;
  title: string;
  lines: { k: string; v: string }[];
  checks: TicketCheck[];
  expiry?: string;
  /** Research answers are information only, with nothing to sign. */
  infoOnly?: boolean;
};

// Illustrative values. Real tickets use live prices and rates at the moment you ask.
export const EXAMPLES: Example[] = [
  {
    id: "swap",
    group: "Trade",
    prompt: "Swap 0.5 SOL to USDC",
    kind: "Swap",
    title: "0.5 SOL for about 50.8 USDC",
    lines: [
      { k: "You pay", v: "0.5 SOL" },
      { k: "You receive", v: "≈ 50.8 USDC" },
      { k: "Route", v: "Jupiter" },
      { k: "Max slippage", v: "0.5%" },
    ],
    checks: [
      { tone: "ok", text: "Simulation passed" },
      { tone: "ok", text: "USDC is a verified token" },
    ],
    expiry: "0:58",
  },
  {
    id: "earn",
    group: "Earn",
    prompt: "Deposit 100 USDC to earn interest",
    kind: "Earn",
    title: "Deposit 100 USDC into Jupiter Lend",
    lines: [
      { k: "You deposit", v: "100 USDC" },
      { k: "Interest", v: "Variable, shown live" },
      { k: "Withdraw", v: "Any time" },
    ],
    checks: [{ tone: "ok", text: "Simulation passed" }],
  },
  {
    id: "borrow",
    group: "Borrow",
    prompt: "Borrow 50 USDC against 2 SOL",
    kind: "Borrow",
    title: "Borrow 50 USDC with 2 SOL as collateral",
    lines: [
      { k: "Collateral", v: "2 SOL" },
      { k: "You borrow", v: "50 USDC" },
      { k: "Loan to value", v: "≈ 25%" },
      { k: "Liquidation at", v: "75% LTV" },
    ],
    checks: [
      { tone: "ok", text: "Simulation passed" },
      { tone: "warn", text: "If SOL falls far enough, your collateral can be liquidated" },
    ],
  },
  {
    id: "stake",
    group: "Stake",
    prompt: "Stake 2 SOL with JitoSOL",
    kind: "Liquid stake",
    title: "Stake 2 SOL for JitoSOL",
    lines: [
      { k: "You stake", v: "2 SOL" },
      { k: "You receive", v: "JitoSOL at the live rate" },
      { k: "Unstake", v: "Swap back any time" },
    ],
    checks: [
      { tone: "ok", text: "Simulation passed" },
      { tone: "ok", text: "JitoSOL is a verified token" },
    ],
    expiry: "0:58",
  },
  {
    id: "automate",
    group: "Automate",
    prompt: "Buy $50 of SOL every week for 8 weeks",
    kind: "Recurring buy",
    title: "$50 of SOL, weekly, 8 times",
    lines: [
      { k: "Each buy", v: "50 USDC" },
      { k: "Every", v: "7 days" },
      { k: "Orders", v: "8" },
      { k: "Total", v: "400 USDC" },
    ],
    checks: [{ tone: "ok", text: "Held in Jupiter escrow until filled or cancelled" }],
  },
  {
    id: "research",
    group: "Research",
    prompt: "Is JUP safe to buy?",
    kind: "Token check",
    title: "JUP (Jupiter)",
    lines: [
      { k: "Verified", v: "Yes" },
      { k: "Mint authority", v: "Disabled" },
      { k: "Freeze authority", v: "Disabled" },
      { k: "Liquidity", v: "Shown live" },
    ],
    checks: [{ tone: "ok", text: "No risk flags found" }],
    infoOnly: true,
  },
];
