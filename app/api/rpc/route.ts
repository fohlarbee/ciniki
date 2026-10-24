import { RPC_URL } from "@/lib/solana";

export const runtime = "nodejs";

// Minimal JSON-RPC proxy so the browser never sees the private RPC URL. Only methods the app needs.
const ALLOWED = new Set([
  "sendTransaction",
  "getSignatureStatuses",
  "getLatestBlockhash",
  "getBlockHeight",
  "isBlockhashValid",
  "getBalance",
  "getAccountInfo",
  "simulateTransaction",
]);

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const calls = Array.isArray(payload) ? payload : [payload];
  if (!calls.length || calls.some((c) => !c || !ALLOWED.has(c.method))) {
    return Response.json({ jsonrpc: "2.0", error: { code: -32601, message: "Method not allowed" }, id: null }, { status: 403 });
  }
  const res = await fetch(RPC_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  return new Response(await res.text(), { status: res.status, headers: { "Content-Type": "application/json" } });
}
