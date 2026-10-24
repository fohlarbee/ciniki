import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

export const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
export const connection = new Connection(RPC_URL, "confirmed");

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const LAMPORTS = 1_000_000_000n;

export function parsePubkey(value: string, label = "address"): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Invalid Solana ${label}: ${value}`);
  }
}

export async function simulateBase64(base64: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const tx = VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
    const res = await connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
    });
    if (res.value.err) {
      const logs = (res.value.logs || []).slice(-3).join(" | ");
      return { ok: false, error: `${JSON.stringify(res.value.err)}${logs ? ` — ${logs}` : ""}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
