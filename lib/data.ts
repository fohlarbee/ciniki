import { PublicKey, StakeProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { connection, SOL_MINT } from "./solana";
import { jup } from "./jup";
import { fromBase, tokensByMint } from "./tokens";

export type Holding = {
  mint: string;
  symbol: string;
  name: string;
  icon?: string;
  amount: number;
  usdPrice?: number;
  usdValue?: number;
  verified?: boolean;
};

export async function getPortfolio(wallet: string) {
  const owner = new PublicKey(wallet);
  const [lamports, std, t22] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed"),
  ]);

  const byMint = new Map<string, number>();
  for (const { account } of [...std.value, ...t22.value]) {
    const info = account.data.parsed.info;
    const ui = Number(info.tokenAmount.uiAmountString ?? info.tokenAmount.uiAmount ?? 0);
    if (ui > 0) byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + ui);
  }
  byMint.set(SOL_MINT, lamports / 1e9);

  const metas = await tokensByMint([...byMint.keys()]).catch((e) => {
    console.error("[portfolio] token metadata lookup failed:", e instanceof Error ? e.message : e);
    return [];
  });
  const metaMap = new Map(metas.map((m) => [m.id, m]));

  const holdings: Holding[] = [...byMint.entries()].map(([mint, amount]) => {
    const m = metaMap.get(mint);
    const usdPrice = m?.usdPrice;
    return {
      mint,
      symbol: mint === SOL_MINT ? "SOL" : m?.symbol ?? mint.slice(0, 4) + "…",
      name: mint === SOL_MINT ? "Solana" : m?.name ?? "Unknown token",
      icon: m?.icon,
      amount,
      usdPrice,
      usdValue: usdPrice ? amount * usdPrice : undefined,
      verified: mint === SOL_MINT ? true : m?.isVerified,
    };
  });
  holdings.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));
  const totalUsd = holdings.reduce((s, h) => s + (h.usdValue ?? 0), 0);
  return { wallet, totalUsd, holdings };
}

export async function getStakeAccounts(wallet: string) {
  const owner = new PublicKey(wallet);
  const [accounts, epochInfo] = await Promise.all([
    connection.getParsedProgramAccounts(StakeProgram.programId, {
      commitment: "confirmed",
      filters: [{ dataSize: 200 }, { memcmp: { offset: 44, bytes: owner.toBase58() } }],
    }),
    connection.getEpochInfo("confirmed"),
  ]);
  const MAX = "18446744073709551615";
  return accounts.map(({ pubkey, account }) => {
    const parsed = (account.data as any).parsed;
    const del = parsed?.info?.stake?.delegation;
    let status = "inactive";
    if (del) {
      const act = Number(del.activationEpoch);
      const deact = del.deactivationEpoch === MAX ? null : Number(del.deactivationEpoch);
      if (deact !== null) status = epochInfo.epoch > deact ? "inactive" : "deactivating";
      else status = epochInfo.epoch >= act + 1 ? "active" : "activating";
    }
    return {
      address: pubkey.toBase58(),
      lamports: account.lamports,
      sol: account.lamports / 1e9,
      validator: del?.voter as string | undefined,
      status,
    };
  });
}

export async function getLendPositions(wallet: string) {
  const [earn, borrow] = await Promise.all([
    jup<any[]>("/lend/v1/earn/positions", { query: { users: wallet } }).catch(() => []),
    jup<any[]>("/lend/v1/borrow/positions", { query: { users: wallet } }).catch(() => []),
  ]);

  const earnOut = (Array.isArray(earn) ? earn : [])
    .filter((p) => p?.shares && BigInt(p.shares) > 0n)
    .map((p) => {
      const asset = p.token?.asset ?? {};
      const dec = Number(asset.decimals ?? p.token?.decimals ?? 6);
      const underlying = fromBase(p.underlyingAssets ?? "0", dec);
      const price = Number(asset.price ?? 0);
      return {
        protocol: "Jupiter Lend",
        symbol: asset.symbol ?? p.token?.symbol,
        underlying,
        usdValue: price ? Number(underlying.replace(/,/g, "")) * price : undefined,
        apyPct: p.token?.totalRate ? Number(p.token.totalRate) / 100 : undefined,
      };
    });

  const borrowOut = (Array.isArray(borrow) ? borrow : [])
    .filter((p) => p && ((p.borrow && BigInt(p.borrow) > 0n) || (p.supply && BigInt(p.supply) > 0n)))
    .map((p) => {
      const v = p.vault ?? {};
      const sup = v.supplyToken ?? {};
      const bor = v.borrowToken ?? {};
      const supply = fromBase(p.supply ?? "0", Number(sup.decimals ?? 9));
      const debt = fromBase(p.borrow ?? "0", Number(bor.decimals ?? 6));
      const supplyUsd = Number(supply.replace(/,/g, "")) * Number(sup.price ?? 0);
      const debtUsd = Number(debt.replace(/,/g, "")) * Number(bor.price ?? 0);
      const liqPct = v.liquidationThreshold ? Number(v.liquidationThreshold) / 10 : undefined;
      const ltvPct = supplyUsd > 0 ? (debtUsd / supplyUsd) * 100 : 0;
      return {
        protocol: "Jupiter Lend",
        vaultId: p.vaultId,
        positionId: p.id,
        collateral: `${supply} ${sup.symbol ?? ""}`.trim(),
        debt: `${debt} ${bor.symbol ?? ""}`.trim(),
        ltvPct: Number(ltvPct.toFixed(1)),
        liquidationLtvPct: liqPct,
        isLiquidated: !!p.isLiquidated,
      };
    });

  return { earn: earnOut, borrow: borrowOut };
}

export async function getYields(opts: { stablecoinOnly?: boolean; minTvlUsd?: number; limit?: number; project?: string }) {
  const [llama, jlend] = await Promise.all([
    fetch("https://yields.llama.fi/pools", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ data: [] })),
    jup<any[]>("/lend/v1/earn/tokens").catch(() => []),
  ]);

  const rows: { project: string; asset: string; apyPct: number; tvlUsd: number; stable: boolean; note?: string }[] = [];

  for (const t of Array.isArray(jlend) ? jlend : []) {
    const dec = Number(t.asset?.decimals ?? t.decimals ?? 6);
    const price = Number(t.asset?.price ?? 0);
    const tvl = Number(fromBase(t.totalAssets ?? "0", dec, 2).replace(/,/g, "")) * price;
    rows.push({
      project: "jupiter-lend",
      asset: t.asset?.symbol ?? t.symbol,
      apyPct: Number(t.totalRate ?? 0) / 100,
      tvlUsd: tvl,
      stable: /usd|usdc|usdt|jupusd/i.test(t.asset?.symbol ?? ""),
      note: "executable here",
    });
  }
  for (const p of llama.data ?? []) {
    if (p.chain !== "Solana" || !p.apy || p.outlier) continue;
    if (["jupiter-lend"].includes(p.project)) continue;
    rows.push({ project: p.project, asset: p.symbol, apyPct: p.apy, tvlUsd: p.tvlUsd, stable: !!p.stablecoin, note: "info only" });
  }

  let out = rows.filter((r) => r.tvlUsd >= (opts.minTvlUsd ?? 1_000_000));
  if (opts.stablecoinOnly) out = out.filter((r) => r.stable);
  if (opts.project) out = out.filter((r) => r.project.includes(opts.project!.toLowerCase()));
  out.sort((a, b) => b.apyPct - a.apyPct);
  return out.slice(0, opts.limit ?? 12).map((r) => ({ ...r, apyPct: Number(r.apyPct.toFixed(2)), tvlUsd: Math.round(r.tvlUsd) }));
}

export async function dexScreener(mint: string) {
  const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, { cache: "no-store" }).then((r) => r.json()).catch(() => []);
  const pairs = (Array.isArray(res) ? res : []).slice(0, 3).map((p: any) => ({
    dex: p.dexId,
    pair: `${p.baseToken?.symbol}/${p.quoteToken?.symbol}`,
    priceUsd: p.priceUsd,
    liquidityUsd: p.liquidity?.usd,
    volume24h: p.volume?.h24,
    change24hPct: p.priceChange?.h24,
    ageHours: p.pairCreatedAt ? Math.round((Date.now() - p.pairCreatedAt) / 36e5) : undefined,
    buys24h: p.txns?.h24?.buys,
    sells24h: p.txns?.h24?.sells,
    url: p.url,
  }));
  return pairs;
}
