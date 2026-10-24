# Ciniki: DeFi on Solana, by conversation

Ciniki (said *chi-ni-ki*, Hausa for "trade") is a chat app for Solana DeFi. You type what you want in plain English, like *"swap 1 SOL to USDC"* or *"stake 2 SOL"*. An AI agent prepares the transaction and shows it to you as a ticket you can review. You then approve it in your own wallet.

**Ciniki never holds your funds or your keys.** Every transaction is signed by you in Phantom or Solflare, and nothing happens until you approve it.

> ⚠️ Ciniki runs on Solana **mainnet**. Approved transactions move real funds. Start with small amounts. This is not financial advice.

---

## What you can do

| Ask for… | Example prompt |
|---|---|
| **Swaps** with the best route through Jupiter | "Swap 0.5 SOL to USDC" |
| **Prices and token research**, with risk flags | "What's the price of JUP and is it safe to buy?" |
| **Yields** across Solana | "What are the best stablecoin yields right now?" |
| **Lending and borrowing** on Jupiter Lend | "Deposit 100 USDC to earn interest" |
| **Staking**, native or liquid (JitoSOL, mSOL) | "Stake 2 SOL with JitoSOL" |
| **Automations** such as recurring buys, limit orders and stop-losses | "Buy $50 of SOL every week for 8 weeks" |
| **Transfers** of SOL and SPL tokens | "Send 0.1 SOL to <address>" |

The wallet panel beside the chat shows your balances, open DeFi positions and active orders.

### Safety features

- **Simulation first.** Transactions are simulated before you sign, and the ticket shows the result.
- **Verified tokens only.** Look-alike tokens with copycat symbols are refused.
- **Quotes expire.** Swap quotes expire after about a minute, so you never sign against a stale price.
- **Daily message cap.** Each wallet gets a limited number of free AI messages per day.

---

## Quick start

### 1. Requirements

- **Node.js 20 or newer.** Check with `node -v`.
- **A Solana wallet browser extension.** Phantom or Solflare.

### 2. Get your API keys

| Key | Where to get it | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) | Pay as you go |
| `JUPITER_API_KEY` | [developers.jup.ag/portal](https://developers.jup.ag/portal) | Free tier available |
| `SOLANA_RPC_URL` | A dedicated RPC provider such as Helius, Triton or QuickNode | Free tiers available |

The public Solana RPC works for a quick try, but it is heavily rate limited and balances may load unreliably.

### 3. Install and run

```bash
git clone https://github.com/fohlarbee/ciniki.git
cd ciniki
npm install
cp .env.example .env.local   # then open .env.local and paste your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the landing page. The app lives at [http://localhost:3000/app](http://localhost:3000/app).

To use a different port:

```bash
npm run dev -- --port 3002
```

### 4. Environment variables

All configuration lives in `.env.local`. That file is ignored by git, so your keys are never committed.

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Powers the AI agent. |
| `ANTHROPIC_MODEL` | No | Claude model to use. Defaults to `claude-sonnet-5-5`. |
| `JUPITER_API_KEY` | Yes | Swaps, lending, borrowing, recurring buys and price orders. |
| `SOLANA_RPC_URL` | Recommended | Your mainnet RPC endpoint. |
| `DAILY_FREE_MESSAGES` | No | AI messages per wallet per day. Defaults to 25. |
| `NEXT_PUBLIC_APP_NAME` | No | The name shown in the UI. Defaults to "Ciniki". |

---

## How it works

```
You type a request
      │
      ▼
AI agent (Claude, with tool calling)
  • reads balances, prices and yields
  • picks a route and builds the transaction
  • simulates it on-chain
      │
      ▼
Confirmation ticket in the chat
      │
      ▼
You approve in your wallet ──► transaction is sent and confirmed
```

The server prepares unsigned transactions and never signs anything. Automations such as recurring buys and limit orders run on-chain in Jupiter's escrow after you approve them, so no server key is needed for those either.

---

## Project structure

```
app/
  page.tsx            Landing page
  app/                The chat app at /app
  api/                Server routes: chat stream, portfolio, positions, RPC and Jupiter proxies
components/
  Chat.tsx            Chat thread, streaming replies, composer
  Desk.tsx            Wallet panel: balance, tokens, positions, orders
  ActionCard.tsx      Transaction confirmation ticket
  landing/            Landing page sections
  Ticket.tsx          The transaction ticket, shared by the landing page and chat
  brand.ts            Product name
  ui/Icon.tsx         Inline SVG icons
lib/
  agent.ts            AI agent loop and system prompt
  tools.ts            Tools the agent can call (swap, stake, lend, orders…)
  jup.ts              Jupiter API client
  data.ts             Portfolio, positions and yield data
  client-exec.ts      Signs and sends approved transactions in the browser
styles/               Page-specific CSS (app and landing)
```

**Tech stack:** Next.js 15, React 19, TypeScript, the Anthropic SDK, Solana web3.js with wallet-adapter, the Jupiter APIs and zod. Styling is plain CSS with no UI framework, set in Mona Sans.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run typecheck` | Check TypeScript types |

---

## Before running this for real users

This project is a working prototype. These gaps should be closed before a public launch:

- **Rate limiting is in memory** and keyed by an unverified wallet address. Move it to a shared store such as Redis and add sign-in-with-wallet verification.
- **Add per-IP limits** on the chat endpoint, because each request costs AI tokens.
- **Lending and borrowing flows** follow Jupiter's published schema but have not been fully tested with a funded wallet. Test with small amounts.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Unauthorized" or 401 errors from Jupiter | Your `JUPITER_API_KEY` is wrong. Copy it again from the portal and restart the server. |
| Wallet balance shows no USD value | Usually Jupiter's rate limit on the free tier. Click Refresh after a few seconds. |
| "Wallet not ready" when connecting | The wallet extension isn't installed or enabled in this browser. Install Phantom or Solflare and reload. |
| Balances load slowly or fail | Set `SOLANA_RPC_URL` to a dedicated RPC instead of the public one. |
