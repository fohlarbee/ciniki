import { randomUUID } from "crypto";
import { z } from "zod";
import type { PendingAction } from "./types";
import { connection, parsePubkey, simulateBase64, SOL_MINT } from "./solana";
import { extractTx, jup } from "./jup";
import { fromBase, resolveToken, STABLES, toBase, tokensByMint } from "./tokens";
import { dexScreener, getLendPositions, getPortfolio, getStakeAccounts, getYields } from "./data";
import {
  buildDeactivate,
  buildNativeStake,
  buildSolTransfer,
  buildSplTransfer,
  buildStakeWithdraw,
  pickValidator,
} from "./builders";

type Ctx = { wallet: string; emit: (a: PendingAction) => void };

export type Tool = {
  name: string;
  label: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  run: (input: any, ctx: Ctx) => Promise<unknown>;
};

const MIN_I128 = "-170141183460469231731687303715884105728";

async function propose(ctx: Ctx, a: Omit<PendingAction, "id" | "simulation">, simTx?: string) {
  const sim = simTx ? await simulateBase64(simTx) : undefined;
  const action: PendingAction = { ...a, id: randomUUID(), simulation: sim };
  ctx.emit(action);
  const lines = a.lines.map((l) => `${l.k}: ${l.v}`).join("; ");
  return {
    status: "awaiting_user_approval",
    note: "A confirmation card was shown to the user. NOTHING has been executed. Tell the user to review and approve it in their wallet. Never say it was completed.",
    summary: lines,
    simulation: sim ? (sim.ok ? "passed" : `FAILED: ${sim.error}`) : "not run",
    warnings: a.warnings ?? [],
  };
}

const usd = (n?: number) => (n === undefined ? "n/a" : `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 4 : 2 })}`);
const amountStr = z.union([z.string(), z.number()]).transform(String);

export const tools: Tool[] = [
  {
    name: "get_portfolio",
    label: "Reading wallet balances",
    description: "Get the connected wallet's SOL and SPL token balances with USD values.",
    input_schema: { type: "object", properties: {} },
    run: async (_i, ctx) => {
      const p = await getPortfolio(ctx.wallet);
      return {
        totalUsd: Math.round(p.totalUsd * 100) / 100,
        holdings: p.holdings.slice(0, 25).map((h) => ({
          symbol: h.symbol,
          mint: h.mint,
          amount: h.amount,
          usdValue: h.usdValue ? Math.round(h.usdValue * 100) / 100 : undefined,
          verified: h.verified,
        })),
      };
    },
  },
  {
    name: "get_defi_positions",
    label: "Checking DeFi positions",
    description: "List the wallet's DeFi positions: Jupiter Lend earn deposits, borrow positions (with LTV), and native SOL stake accounts.",
    input_schema: { type: "object", properties: {} },
    run: async (_i, ctx) => {
      const [lend, stakes] = await Promise.all([getLendPositions(ctx.wallet), getStakeAccounts(ctx.wallet)]);
      return { ...lend, nativeStake: stakes };
    },
  },
  {
    name: "get_prices",
    label: "Fetching prices",
    description: "Get current USD price and 24h change for one or more tokens (symbols or mint addresses).",
    input_schema: {
      type: "object",
      properties: { tokens: { type: "array", items: { type: "string" }, description: "Symbols or mints, max 10" } },
      required: ["tokens"],
    },
    run: async (i) => {
      const list = z.object({ tokens: z.array(z.string()).min(1).max(10) }).parse(i).tokens;
      const resolved = await Promise.all(list.map((t) => resolveToken(t)));
      return resolved.map((t) => ({
        symbol: t.symbol,
        mint: t.id,
        usdPrice: t.usdPrice,
        change24hPct: t.stats24h?.priceChange,
        liquidityUsd: t.liquidity,
        verified: t.isVerified,
      }));
    },
  },
  {
    name: "analyze_token",
    label: "Researching token",
    description:
      "Research a token: verification status, mint/freeze authority, holder concentration, liquidity, age, DEX pairs and risk flags. Accepts a symbol or mint address. Use before the user buys unfamiliar tokens.",
    input_schema: { type: "object", properties: { token: { type: "string" } }, required: ["token"] },
    run: async (i) => {
      const { token } = z.object({ token: z.string() }).parse(i);
      const t = await resolveToken(token);
      const pairs = await dexScreener(t.id);
      const flags: string[] = [];
      if (!t.isVerified) flags.push("Not verified by Jupiter");
      if (t.audit?.isSus) flags.push("Flagged suspicious by Jupiter audit");
      if (t.audit?.mintAuthorityDisabled === false) flags.push("Mint authority is still enabled (supply can be inflated)");
      if (t.audit?.freezeAuthorityDisabled === false) flags.push("Freeze authority is enabled (wallets can be frozen)");
      if ((t.audit?.topHoldersPercentage ?? 0) > 50) flags.push(`Top holders own ${t.audit?.topHoldersPercentage?.toFixed(0)}% of supply`);
      if ((t.liquidity ?? 0) < 50_000) flags.push("Low liquidity (< $50k)");
      if (pairs[0]?.ageHours !== undefined && pairs[0].ageHours < 24) flags.push("Pair is less than 24 hours old");
      return {
        symbol: t.symbol,
        name: t.name,
        mint: t.id,
        usdPrice: t.usdPrice,
        marketCapUsd: t.mcap,
        fdvUsd: t.fdv,
        liquidityUsd: t.liquidity,
        holders: t.holderCount,
        organicScore: t.organicScoreLabel,
        change24hPct: t.stats24h?.priceChange,
        riskFlags: flags,
        pairs,
      };
    },
  },
  {
    name: "find_yields",
    label: "Scanning yields",
    description:
      "Find the best Solana yield opportunities (lending, LSTs, LPs). Rows marked 'executable here' can be deposited through this app; others are info only.",
    input_schema: {
      type: "object",
      properties: {
        stablecoin_only: { type: "boolean" },
        min_tvl_usd: { type: "number", description: "Default 1,000,000" },
        project: { type: "string", description: "Filter by protocol name, e.g. kamino, meteora, jito" },
        limit: { type: "number" },
      },
    },
    run: async (i) => {
      const a = z
        .object({ stablecoin_only: z.boolean().optional(), min_tvl_usd: z.number().optional(), project: z.string().optional(), limit: z.number().max(25).optional() })
        .parse(i ?? {});
      return getYields({ stablecoinOnly: a.stablecoin_only, minTvlUsd: a.min_tvl_usd, project: a.project, limit: a.limit });
    },
  },
  {
    name: "swap",
    label: "Routing swap",
    description: "Prepare a token swap via Jupiter. Only call when the user explicitly asked to swap. Amount is in UI units of the FROM token (e.g. 1.5 SOL).",
    input_schema: {
      type: "object",
      properties: {
        from_token: { type: "string", description: "Symbol or mint to sell" },
        to_token: { type: "string", description: "Symbol or mint to buy" },
        amount: { type: "string", description: "Amount of from_token, in token units" },
      },
      required: ["from_token", "to_token", "amount"],
    },
    run: async (i, ctx) => {
      const a = z.object({ from_token: z.string(), to_token: z.string(), amount: amountStr }).parse(i);
      const [from, to] = await Promise.all([resolveToken(a.from_token), resolveToken(a.to_token)]);
      if (from.id === to.id) throw new Error("From and to tokens are the same");
      const base = toBase(a.amount, from.decimals);
      const order = await jup<any>("/swap/v2/order", {
        query: { inputMint: from.id, outputMint: to.id, amount: base.toString(), taker: ctx.wallet },
      });
      if (!order?.transaction) throw new Error(`No route available${order?.errorCode ? ` (code ${order.errorCode})` : ""}${order?.error ? `: ${order.error}` : ""}`);
      const out = fromBase(order.outAmount ?? "0", to.decimals);
      const warnings: string[] = [];
      if (!to.isVerified) warnings.push(`${to.symbol} is not verified by Jupiter`);
      if (order.priceImpact !== undefined && Math.abs(Number(order.priceImpact)) > 0.02) warnings.push("High price impact");
      return propose(
        ctx,
        {
          kind: "swap",
          title: `Swap ${a.amount} ${from.symbol} → ${to.symbol}`,
          lines: [
            { k: "You pay", v: `${a.amount} ${from.symbol}` },
            { k: "You receive (est.)", v: `${out} ${to.symbol}` },
            ...(order.router ? [{ k: "Route", v: String(order.router) }] : []),
            ...(order.feeBps !== undefined ? [{ k: "Fee", v: `${order.feeBps} bps` }] : []),
          ],
          warnings,
          exec: { mode: "jup-swap", tx: order.transaction, requestId: order.requestId },
        },
        order.transaction
      );
    },
  },
  {
    name: "transfer",
    label: "Preparing transfer",
    description: "Prepare a transfer of SOL or an SPL token to another Solana address. Only when the user explicitly asks to send funds.",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient Solana address (base58)" },
        token: { type: "string", description: "Symbol or mint, e.g. SOL" },
        amount: { type: "string" },
      },
      required: ["to", "token", "amount"],
    },
    run: async (i, ctx) => {
      const a = z.object({ to: z.string(), token: z.string(), amount: amountStr }).parse(i);
      const from = parsePubkey(ctx.wallet, "wallet");
      const to = parsePubkey(a.to, "recipient address");
      const t = await resolveToken(a.token);
      const raw = toBase(a.amount, t.decimals);
      const warnings: string[] = [];
      let tx: string;
      if (t.id === SOL_MINT) {
        tx = await buildSolTransfer(from, to, raw);
        const info = await connection.getAccountInfo(to);
        if (!info && raw < 890_880n) warnings.push("Recipient account does not exist yet; amounts below ~0.00089 SOL will fail");
      } else {
        const built = await buildSplTransfer(from, to, parsePubkey(t.id), raw);
        tx = built.tx;
        if (built.createsAccount) warnings.push("Recipient has no token account; one will be created (~0.002 SOL rent paid by you)");
      }
      warnings.push("Double-check the recipient address. Transfers cannot be reversed.");
      return propose(
        ctx,
        {
          kind: "transfer",
          title: `Send ${a.amount} ${t.symbol}`,
          lines: [
            { k: "To", v: a.to },
            { k: "Amount", v: `${a.amount} ${t.symbol}` },
          ],
          warnings,
          exec: { mode: "send", txs: [{ label: "Transfer", base64: tx }] },
        },
        tx
      );
    },
  },
  {
    name: "lend_deposit",
    label: "Preparing lend deposit",
    description: "Deposit a token into Jupiter Lend earn to receive interest. Use find_yields to see rates first if the user asks for the best option.",
    input_schema: {
      type: "object",
      properties: { token: { type: "string" }, amount: { type: "string" } },
      required: ["token", "amount"],
    },
    run: async (i, ctx) => {
      const a = z.object({ token: z.string(), amount: amountStr }).parse(i);
      const t = await resolveToken(a.token);
      const markets = await jup<any[]>("/lend/v1/earn/tokens");
      const m = markets.find((x) => x.assetAddress === t.id);
      if (!m) throw new Error(`${t.symbol} is not supported by Jupiter Lend earn`);
      const raw = toBase(a.amount, t.decimals);
      const res = await jup<any>("/lend/v1/earn/deposit", { body: { asset: t.id, amount: raw.toString(), signer: ctx.wallet } });
      const tx = extractTx(res);
      return propose(
        ctx,
        {
          kind: "lend",
          title: `Deposit ${a.amount} ${t.symbol} into Jupiter Lend`,
          lines: [
            { k: "Deposit", v: `${a.amount} ${t.symbol}` },
            { k: "Current APY", v: `${(Number(m.totalRate) / 100).toFixed(2)}% (${(Number(m.supplyRate) / 100).toFixed(2)}% base + ${(Number(m.rewardsRate) / 100).toFixed(2)}% rewards)` },
            { k: "Receipt token", v: m.symbol },
          ],
          warnings: ["Rates are variable. Smart-contract risk applies."],
          exec: { mode: "send", txs: [{ label: "Deposit", base64: tx }] },
        },
        tx
      );
    },
  },
  {
    name: "lend_withdraw",
    label: "Preparing lend withdrawal",
    description: "Withdraw a token from Jupiter Lend earn back to the wallet.",
    input_schema: {
      type: "object",
      properties: { token: { type: "string" }, amount: { type: "string" } },
      required: ["token", "amount"],
    },
    run: async (i, ctx) => {
      const a = z.object({ token: z.string(), amount: amountStr }).parse(i);
      const t = await resolveToken(a.token);
      const raw = toBase(a.amount, t.decimals);
      const res = await jup<any>("/lend/v1/earn/withdraw", { body: { asset: t.id, amount: raw.toString(), signer: ctx.wallet } });
      const tx = extractTx(res);
      return propose(
        ctx,
        {
          kind: "lend",
          title: `Withdraw ${a.amount} ${t.symbol} from Jupiter Lend`,
          lines: [{ k: "Withdraw", v: `${a.amount} ${t.symbol}` }],
          exec: { mode: "send", txs: [{ label: "Withdraw", base64: tx }] },
        },
        tx
      );
    },
  },
  {
    name: "list_borrow_vaults",
    label: "Loading borrow markets",
    description: "List Jupiter Lend borrow vaults: collateral token, borrow token, borrow rate, max LTV and liquidation threshold.",
    input_schema: { type: "object", properties: {} },
    run: async () => {
      const vaults = await jup<any[]>("/lend/v1/borrow/vaults");
      return vaults.slice(0, 40).map((v) => ({
        vaultId: v.id,
        collateral: v.supplyToken?.symbol,
        borrow: v.borrowToken?.symbol,
        borrowAprPct: v.borrowRate ? Number(v.borrowRate) / 100 : undefined,
        maxLtvPct: v.collateralFactor ? Number(v.collateralFactor) / 10 : undefined,
        liquidationLtvPct: v.liquidationThreshold ? Number(v.liquidationThreshold) / 10 : undefined,
      }));
    },
  },
  {
    name: "borrow_manage",
    label: "Preparing borrow action",
    description:
      "Open or manage a Jupiter Lend borrow position. Actions: deposit_collateral, borrow, repay, withdraw_collateral, repay_all, withdraw_all. Use position_id 0 to open a new position. To open and borrow in one step, pass both collateral_amount and borrow_amount with action 'open'.",
    input_schema: {
      type: "object",
      properties: {
        vault_id: { type: "number" },
        position_id: { type: "number", description: "0 for a new position" },
        action: { type: "string", enum: ["open", "deposit_collateral", "borrow", "repay", "withdraw_collateral", "repay_all", "withdraw_all"] },
        collateral_amount: { type: "string", description: "Collateral token units (deposit/withdraw/open)" },
        borrow_amount: { type: "string", description: "Debt token units (borrow/repay/open)" },
      },
      required: ["vault_id", "action"],
    },
    run: async (i, ctx) => {
      const a = z
        .object({
          vault_id: z.number().int(),
          position_id: z.number().int().default(0),
          action: z.enum(["open", "deposit_collateral", "borrow", "repay", "withdraw_collateral", "repay_all", "withdraw_all"]),
          collateral_amount: amountStr.optional(),
          borrow_amount: amountStr.optional(),
        })
        .parse(i);
      const vaults = await jup<any[]>("/lend/v1/borrow/vaults");
      const v = vaults.find((x) => x.id === a.vault_id);
      if (!v) throw new Error(`Vault ${a.vault_id} not found`);
      const cd = Number(v.supplyToken.decimals);
      const bd = Number(v.borrowToken.decimals);
      let col = "0";
      let debt = "0";
      const need = (x: string | undefined, name: string) => {
        if (!x) throw new Error(`${name} is required for ${a.action}`);
        return x;
      };
      switch (a.action) {
        case "open":
          col = toBase(need(a.collateral_amount, "collateral_amount"), cd).toString();
          debt = a.borrow_amount ? toBase(a.borrow_amount, bd).toString() : "0";
          break;
        case "deposit_collateral":
          col = toBase(need(a.collateral_amount, "collateral_amount"), cd).toString();
          break;
        case "borrow":
          debt = toBase(need(a.borrow_amount, "borrow_amount"), bd).toString();
          break;
        case "repay":
          debt = "-" + toBase(need(a.borrow_amount, "borrow_amount"), bd).toString();
          break;
        case "withdraw_collateral":
          col = "-" + toBase(need(a.collateral_amount, "collateral_amount"), cd).toString();
          break;
        case "repay_all":
          debt = MIN_I128;
          break;
        case "withdraw_all":
          col = MIN_I128;
          break;
      }
      const positionId = a.action === "open" ? 0 : a.position_id;
      const res = await jup<any>("/lend/v1/borrow/operate", {
        body: { vaultId: a.vault_id, positionId, signer: ctx.wallet, colAmount: col, debtAmount: debt },
      });
      const tx = extractTx(res);
      const lines = [
        { k: "Vault", v: `${v.supplyToken.symbol} collateral / ${v.borrowToken.symbol} debt (#${v.id})` },
        { k: "Action", v: a.action.replace(/_/g, " ") },
        ...(a.collateral_amount ? [{ k: "Collateral", v: `${a.collateral_amount} ${v.supplyToken.symbol}` }] : []),
        ...(a.borrow_amount ? [{ k: "Debt", v: `${a.borrow_amount} ${v.borrowToken.symbol}` }] : []),
        ...(v.borrowRate ? [{ k: "Borrow rate", v: `${(Number(v.borrowRate) / 100).toFixed(2)}% APR` }] : []),
        ...(v.liquidationThreshold ? [{ k: "Liquidation LTV", v: `${(Number(v.liquidationThreshold) / 10).toFixed(1)}%` }] : []),
      ];
      const risky = a.action === "borrow" || a.action === "withdraw_collateral" || a.action === "open";
      return propose(
        ctx,
        {
          kind: "borrow",
          title: `Borrow: ${a.action.replace(/_/g, " ")}`,
          lines,
          warnings: risky ? ["Borrowing can lead to liquidation if collateral value falls. Keep LTV well below the liquidation threshold."] : [],
          exec: { mode: "send", txs: [{ label: "Borrow operation", base64: tx }] },
        },
        tx
      );
    },
  },
  {
    name: "stake_sol",
    label: "Preparing stake",
    description:
      "Stake SOL. mode 'liquid' swaps SOL for a liquid staking token (default JitoSOL; stays usable in DeFi). mode 'native' creates a stake account delegated to a validator (min ~1 SOL, takes an epoch to activate, ~2-3 days to unstake).",
    input_schema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "SOL amount" },
        mode: { type: "string", enum: ["liquid", "native"] },
        lst: { type: "string", description: "For liquid mode: JitoSOL (default) or mSOL" },
        validator_vote_account: { type: "string", description: "Optional vote account for native mode" },
      },
      required: ["amount", "mode"],
    },
    run: async (i, ctx) => {
      const a = z
        .object({ amount: amountStr, mode: z.enum(["liquid", "native"]), lst: z.string().optional(), validator_vote_account: z.string().optional() })
        .parse(i);
      if (a.mode === "liquid") {
        const swapTool = tools.find((t) => t.name === "swap")!;
        return swapTool.run({ from_token: "SOL", to_token: a.lst ?? "JitoSOL", amount: a.amount }, ctx);
      }
      const owner = parsePubkey(ctx.wallet, "wallet");
      const lamports = toBase(a.amount, 9);
      const minDel = BigInt((await (connection as any)._rpcRequest("getStakeMinimumDelegation", []).then((r: any) => r?.result?.value).catch(() => 1_000_000_000)) ?? 1_000_000_000);
      if (lamports < minDel) throw new Error(`Minimum native stake is ${fromBase(minDel, 9)} SOL`);
      const v = a.validator_vote_account
        ? { votePubkey: a.validator_vote_account, commission: NaN }
        : await pickValidator();
      const { tx, stakeAccount, rent } = await buildNativeStake(owner, lamports, parsePubkey(v.votePubkey, "vote account"));
      return propose(
        ctx,
        {
          kind: "stake",
          title: `Stake ${a.amount} SOL natively`,
          lines: [
            { k: "Amount", v: `${a.amount} SOL (+ ${fromBase(rent, 9)} SOL account rent, refundable)` },
            { k: "Validator", v: v.votePubkey },
            ...(Number.isNaN(v.commission) ? [] : [{ k: "Commission", v: `${v.commission}%` }]),
            { k: "Stake account", v: stakeAccount },
          ],
          warnings: ["Stake activates at the next epoch boundary. Unstaking takes about one epoch (2-3 days)."],
          exec: { mode: "send", txs: [{ label: "Create & delegate stake", base64: tx }] },
        },
        tx
      );
    },
  },
  {
    name: "unstake_native",
    label: "Preparing unstake",
    description:
      "Native stake management. action 'deactivate' starts unstaking a stake account; action 'withdraw' moves SOL from a fully deactivated stake account back to the wallet. Use get_defi_positions first to find stake account addresses and status.",
    input_schema: {
      type: "object",
      properties: {
        stake_account: { type: "string" },
        action: { type: "string", enum: ["deactivate", "withdraw"] },
      },
      required: ["stake_account", "action"],
    },
    run: async (i, ctx) => {
      const a = z.object({ stake_account: z.string(), action: z.enum(["deactivate", "withdraw"]) }).parse(i);
      const owner = parsePubkey(ctx.wallet, "wallet");
      const acct = parsePubkey(a.stake_account, "stake account");
      const mine = (await getStakeAccounts(ctx.wallet)).find((s) => s.address === a.stake_account);
      if (!mine) throw new Error("That stake account is not controlled by this wallet");
      if (a.action === "deactivate") {
        if (mine.status === "inactive") throw new Error("Stake is already inactive; use withdraw");
        const tx = await buildDeactivate(owner, acct);
        return propose(
          ctx,
          { kind: "stake", title: "Start unstaking", lines: [{ k: "Stake account", v: a.stake_account }, { k: "Amount", v: `${mine.sol} SOL` }], warnings: ["SOL becomes withdrawable after the current epoch ends."], exec: { mode: "send", txs: [{ label: "Deactivate", base64: tx }] } },
          tx
        );
      }
      if (mine.status !== "inactive") throw new Error(`Stake is ${mine.status}; it must be inactive before withdrawing`);
      const tx = await buildStakeWithdraw(owner, acct, mine.lamports);
      return propose(
        ctx,
        { kind: "stake", title: `Withdraw ${mine.sol} SOL from stake`, lines: [{ k: "Stake account", v: a.stake_account }, { k: "Amount", v: `${mine.sol} SOL` }], exec: { mode: "send", txs: [{ label: "Withdraw", base64: tx }] } },
        tx
      );
    },
  },
  {
    name: "create_dca",
    label: "Setting up recurring buy",
    description:
      "Create a recurring buy (DCA) order on Jupiter: spend a total amount of one token across N orders at a fixed interval. Runs automatically on-chain after approval; funds are escrowed in the order. Minimum $10 per order, 2+ orders, interval 60s to 1 year.",
    input_schema: {
      type: "object",
      properties: {
        from_token: { type: "string" },
        to_token: { type: "string" },
        total_amount: { type: "string", description: "Total from_token to spend across all orders" },
        order_count: { type: "number" },
        interval: { type: "string", enum: ["hourly", "daily", "weekly", "monthly"] },
      },
      required: ["from_token", "to_token", "total_amount", "order_count", "interval"],
    },
    run: async (i, ctx) => {
      const a = z
        .object({ from_token: z.string(), to_token: z.string(), total_amount: amountStr, order_count: z.number().int().min(2), interval: z.enum(["hourly", "daily", "weekly", "monthly"]) })
        .parse(i);
      const [from, to] = await Promise.all([resolveToken(a.from_token), resolveToken(a.to_token)]);
      const raw = toBase(a.total_amount, from.decimals);
      const perOrderUsd = from.usdPrice ? (Number(a.total_amount) * from.usdPrice) / a.order_count : undefined;
      if (perOrderUsd !== undefined && perOrderUsd < 10) throw new Error(`Each order must be at least $10 (this would be ~${usd(perOrderUsd)}). Reduce the order count or increase the amount.`);
      const secs = { hourly: 3600, daily: 86400, weekly: 604800, monthly: 2592000 }[a.interval];
      const each = Number(a.total_amount) / a.order_count;
      return propose(ctx, {
        kind: "dca",
        title: `Buy ${to.symbol} with ${from.symbol} — ${a.interval}`,
        lines: [
          { k: "Total spend", v: `${a.total_amount} ${from.symbol}` },
          { k: "Orders", v: `${a.order_count} × ${each.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${from.symbol}` },
          { k: "Every", v: a.interval === "hourly" ? "hour" : a.interval.replace("ly", "") === "dai" ? "day" : a.interval === "weekly" ? "week" : "30 days" },
          ...(perOrderUsd !== undefined ? [{ k: "Per order", v: `≈ ${usd(perOrderUsd)}` }] : []),
        ],
        warnings: [to.isVerified ? "" : `${to.symbol} is not verified by Jupiter`, "You will be asked to sign a login message and a deposit transaction."].filter(Boolean),
        exec: {
          mode: "trigger-create",
          kind: "dca",
          deposit: { inputMint: from.id, outputMint: to.id, amount: raw.toString(), orderType: "dca" },
          body: {
            userPubkey: ctx.wallet,
            inputMint: from.id,
            outputMint: to.id,
            inputAmount: raw.toString(),
            orderCount: a.order_count,
            intervalSeconds: secs,
            orderType: "time_based",
          },
        },
      });
    },
  },
  {
    name: "create_price_order",
    label: "Setting up price order",
    description:
      "Create a price-triggered order on Jupiter that executes automatically on-chain. Types: limit_sell (sell input when watch token price >= trigger), limit_buy (spend input to buy output when price <= trigger), take_profit, stop_loss, oco (take-profit + stop-loss pair; needs tp_price_usd and sl_price_usd). Minimum $10. Funds are escrowed until it fills or is cancelled.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["limit_sell", "limit_buy", "take_profit", "stop_loss", "oco"] },
        input_token: { type: "string", description: "Token being sold/spent" },
        output_token: { type: "string", description: "Token being received (e.g. USDC when selling SOL)" },
        amount: { type: "string", description: "Amount of input_token" },
        trigger_price_usd: { type: "number", description: "For non-OCO types" },
        tp_price_usd: { type: "number" },
        sl_price_usd: { type: "number" },
        watch_token: { type: "string", description: "Token whose USD price is monitored. Defaults to the non-stablecoin side." },
        expires_in_days: { type: "number", description: "Default 30" },
      },
      required: ["type", "input_token", "output_token", "amount"],
    },
    run: async (i, ctx) => {
      const a = z
        .object({
          type: z.enum(["limit_sell", "limit_buy", "take_profit", "stop_loss", "oco"]),
          input_token: z.string(),
          output_token: z.string(),
          amount: amountStr,
          trigger_price_usd: z.number().positive().optional(),
          tp_price_usd: z.number().positive().optional(),
          sl_price_usd: z.number().positive().optional(),
          watch_token: z.string().optional(),
          expires_in_days: z.number().min(1).max(365).default(30),
        })
        .parse(i);
      const [inp, out] = await Promise.all([resolveToken(a.input_token), resolveToken(a.output_token)]);
      const raw = toBase(a.amount, inp.decimals);
      const usdValue = inp.usdPrice ? Number(a.amount) * inp.usdPrice : undefined;
      if (usdValue !== undefined && usdValue < 10) throw new Error(`Minimum order size is $10 (this is ~${usd(usdValue)})`);

      const watch = a.watch_token
        ? await resolveToken(a.watch_token)
        : STABLES.has(inp.id)
          ? out
          : STABLES.has(out.id)
            ? inp
            : a.type === "limit_buy"
              ? out
              : inp;
      const expiresAt = Date.now() + a.expires_in_days * 86_400_000;

      const common = {
        userPubkey: ctx.wallet,
        inputMint: inp.id,
        outputMint: out.id,
        inputAmount: raw.toString(),
        triggerMint: watch.id,
        expiresAt,
      };
      let body: Record<string, unknown>;
      let sub: "single" | "oco";
      const lines = [
        { k: "Sell/spend", v: `${a.amount} ${inp.symbol}` },
        { k: "Receive", v: out.symbol },
      ];
      if (a.type === "oco") {
        if (!a.tp_price_usd || !a.sl_price_usd) throw new Error("OCO needs tp_price_usd and sl_price_usd");
        if (a.tp_price_usd <= a.sl_price_usd) throw new Error("Take-profit price must be higher than stop-loss price");
        sub = "oco";
        body = { ...common, orderType: "oco", tpPriceUsd: a.tp_price_usd, slPriceUsd: a.sl_price_usd };
        lines.push({ k: "Take profit", v: `${watch.symbol} ≥ ${usd(a.tp_price_usd)}` }, { k: "Stop loss", v: `${watch.symbol} ≤ ${usd(a.sl_price_usd)}` });
      } else {
        if (!a.trigger_price_usd) throw new Error("trigger_price_usd is required");
        sub = "single";
        const cond = a.type === "limit_sell" || a.type === "take_profit" ? "above" : "below";
        body = { ...common, orderType: "single", triggerCondition: cond, triggerPriceUsd: a.trigger_price_usd };
        lines.push({ k: "Trigger", v: `${watch.symbol} ${cond === "above" ? "≥" : "≤"} ${usd(a.trigger_price_usd)}` });
        if (watch.usdPrice) lines.push({ k: "Current price", v: `${watch.symbol} ${usd(watch.usdPrice)}` });
      }
      lines.push({ k: "Expires", v: `${a.expires_in_days} days` });
      return propose(ctx, {
        kind: "order",
        title: `${a.type.replace(/_/g, " ")} order`,
        lines,
        warnings: ["Stop-loss and market-triggered fills can execute at a worse price in fast markets.", "You will be asked to sign a login message and a deposit transaction."],
        exec: { mode: "trigger-create", kind: "price", deposit: { inputMint: inp.id, outputMint: out.id, amount: raw.toString(), orderType: "price", orderSubType: sub }, body },
      });
    },
  },
  {
    name: "cancel_order",
    label: "Preparing order cancellation",
    description: "Cancel an open Jupiter price order by id and withdraw its escrowed funds. The order id is visible in the Orders tab.",
    input_schema: { type: "object", properties: { order_id: { type: "string" } }, required: ["order_id"] },
    run: async (i, ctx) => {
      const a = z.object({ order_id: z.string().min(8) }).parse(i);
      return propose(ctx, {
        kind: "order",
        title: "Cancel order",
        lines: [{ k: "Order", v: a.order_id }],
        warnings: ["Escrowed funds return to your wallet after you sign the withdrawal."],
        exec: { mode: "trigger-cancel", orderId: a.order_id },
      });
    },
  },
];

export const toolDefs = tools.map(({ name, description, input_schema }) => ({ name, description, input_schema }));
export const toolMap = new Map(tools.map((t) => [t.name, t]));
export { tokensByMint };
