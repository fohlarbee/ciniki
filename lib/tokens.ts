import { jup } from "./jup";
import { SOL_MINT } from "./solana";

export type TokenInfo = {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  icon?: string;
  isVerified?: boolean;
  usdPrice?: number;
  liquidity?: number;
  mcap?: number;
  fdv?: number;
  holderCount?: number;
  organicScoreLabel?: string;
  audit?: { isSus?: boolean; mintAuthorityDisabled?: boolean; freezeAuthorityDisabled?: boolean; topHoldersPercentage?: number };
  stats24h?: { priceChange?: number; buyVolume?: number; sellVolume?: number };
};

const KNOWN: Record<string, string> = {
  SOL: SOL_MINT,
  WSOL: SOL_MINT,
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

export const STABLES = new Set([KNOWN.USDC, KNOWN.USDT]);
const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export async function searchTokens(query: string): Promise<TokenInfo[]> {
  return jup<TokenInfo[]>("/tokens/v2/search", { query: { query } });
}

export async function tokensByMint(mints: string[]): Promise<TokenInfo[]> {
  const out: TokenInfo[] = [];
  for (let i = 0; i < mints.length; i += 100) {
    const chunk = mints.slice(i, i + 100);
    out.push(...(await searchTokens(chunk.join(","))));
  }
  return out;
}

/** Resolve a symbol or mint to a single token. Refuses unverified look-alikes. */
export async function resolveToken(input: string): Promise<TokenInfo> {
  const q = input.trim();
  if (!q) throw new Error("Token is required");
  const known = KNOWN[q.toUpperCase()];
  const isMint = MINT_RE.test(q);
  const results = await searchTokens(known ?? q);
  if (!results.length) throw new Error(`Token not found: ${q}`);

  if (known || isMint) {
    const want = known ?? q;
    const hit = results.find((t) => t.id === want);
    if (!hit) throw new Error(`Token mint not found: ${want}`);
    return hit;
  }

  const exact = results.filter((t) => t.symbol.toLowerCase() === q.toLowerCase());
  const verified = exact.filter((t) => t.isVerified).sort((a, b) => (b.liquidity ?? 0) - (a.liquidity ?? 0));
  if (verified.length) return verified[0];

  const cands = results
    .slice(0, 5)
    .map((t) => `${t.symbol} (${t.name}) ${t.id}${t.isVerified ? " [verified]" : " [UNVERIFIED]"}`)
    .join("; ");
  throw new Error(
    `No verified token with symbol "${q}". Do not guess. Show these candidates to the user and ask for the exact mint address: ${cands}`
  );
}

export function toBase(amount: string | number, decimals: number): bigint {
  const s = String(amount).trim();
  if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.?$/.test(s)) throw new Error(`Invalid amount: ${amount}`);
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) throw new Error(`Too many decimals for this token (max ${decimals}): ${amount}`);
  const v = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  if (v <= 0n) throw new Error("Amount must be greater than zero");
  return v;
}

export function fromBase(raw: string | bigint | number, decimals: number, maxFrac = 6): string {
  const v = BigInt(raw);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  let frac = (abs % base).toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${frac ? "." + frac : ""}`;
}
