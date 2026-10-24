import { Connection, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { PendingAction } from "./types";

export type WalletLike = {
  publicKey: { toBase58(): string } | null;
  signTransaction?: <T extends VersionedTransaction>(tx: T) => Promise<T>;
  signMessage?: (msg: Uint8Array) => Promise<Uint8Array>;
};

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

let conn: Connection | null = null;
export function rpc() {
  if (!conn) conn = new Connection(`${window.location.origin}/api/rpc`, { commitment: "confirmed", disableRetryOnRateLimit: true });
  return conn;
}

async function signB64(wallet: WalletLike, b64: string): Promise<string> {
  if (!wallet.signTransaction) throw new Error("This wallet cannot sign transactions");
  const tx = VersionedTransaction.deserialize(b64ToBytes(b64));
  const signed = await wallet.signTransaction(tx);
  return bytesToB64(signed.serialize());
}

async function confirm(sig: string, timeoutMs = 75_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { value } = await rpc().getSignatureStatuses([sig]);
    const s = value[0];
    if (s?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(s.err)}`);
    if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for confirmation. Check the signature on Solscan before retrying.");
}

async function api<T = any>(url: string, init?: { method?: string; body?: unknown; jwt?: string }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.jwt ? { Authorization: `Bearer ${init.jwt}` } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

const jwtKey = (w: string) => `trigger-jwt:${w}`;

export function cachedJwt(wallet: string): string | null {
  try {
    const raw = sessionStorage.getItem(jwtKey(wallet));
    if (!raw) return null;
    const { token, exp } = JSON.parse(raw);
    return exp > Date.now() ? token : null;
  } catch {
    return null;
  }
}

export async function ensureJwt(wallet: WalletLike): Promise<string> {
  const addr = wallet.publicKey?.toBase58();
  if (!addr) throw new Error("Connect a wallet first");
  const cached = cachedJwt(addr);
  if (cached) return cached;
  if (!wallet.signMessage) throw new Error("This wallet cannot sign messages, which Jupiter order login requires");
  const { challenge } = await api<{ challenge: string }>("/api/trigger/auth/challenge", { body: { walletPubkey: addr, type: "message" } });
  const sig = await wallet.signMessage(new TextEncoder().encode(challenge));
  const { token } = await api<{ token: string }>("/api/trigger/auth/verify", {
    body: { type: "message", walletPubkey: addr, signature: bs58.encode(sig) },
  });
  try {
    sessionStorage.setItem(jwtKey(addr), JSON.stringify({ token, exp: Date.now() + 23 * 3600_000 }));
  } catch {}
  return token;
}

export async function fetchOrders(wallet: WalletLike, state: "active" | "past" = "active") {
  const jwt = await ensureJwt(wallet);
  return api<{ orders: any[] }>(`/api/trigger/orders/history?state=${state}&limit=30`, { jwt });
}

export type StepCb = (msg: string) => void;

export async function executeAction(action: PendingAction, wallet: WalletLike, onStep: StepCb): Promise<{ signature?: string; id?: string }> {
  const addr = wallet.publicKey?.toBase58();
  if (!addr) throw new Error("Connect a wallet first");
  const ex = action.exec;

  if (ex.mode === "send") {
    let last = "";
    for (let i = 0; i < ex.txs.length; i++) {
      onStep(ex.txs.length > 1 ? `Approve step ${i + 1} of ${ex.txs.length} in your wallet` : "Approve in your wallet");
      const signed = await signB64(wallet, ex.txs[i].base64);
      onStep("Sending");
      last = await rpc().sendRawTransaction(b64ToBytes(signed), { skipPreflight: false, maxRetries: 3 });
      onStep("Confirming");
      await confirm(last);
    }
    return { signature: last };
  }

  if (ex.mode === "jup-swap") {
    onStep("Approve in your wallet");
    const signed = await signB64(wallet, ex.tx);
    onStep("Landing transaction");
    const res = await api<{ status: string; signature?: string; error?: string }>("/api/swap/execute", {
      body: { signedTransaction: signed, requestId: ex.requestId },
    });
    if (res.status !== "Success") throw new Error(res.error || "Swap failed to land. No funds moved; you can ask again for a fresh quote.");
    return { signature: res.signature };
  }

  if (ex.mode === "trigger-create") {
    onStep("Sign in to Jupiter orders");
    const jwt = await ensureJwt(wallet);
    onStep("Preparing escrow");
    try {
      await api("/api/trigger/vault", { jwt });
    } catch {
      await api("/api/trigger/vault/register", { body: {}, jwt });
    }
    const craft = await api<{ requestId: string; transaction: string }>("/api/trigger/deposit/craft", {
      body: { ...ex.deposit, userAddress: addr },
      jwt,
    });
    onStep("Approve deposit in your wallet");
    const signed = await signB64(wallet, craft.transaction);
    onStep("Creating order");
    const res = await api<{ id: string; txSignature?: string }>(ex.kind === "dca" ? "/api/trigger/orders/dca" : "/api/trigger/orders/price", {
      body: { ...ex.body, depositRequestId: craft.requestId, depositSignedTx: signed },
      jwt,
    });
    return { signature: res.txSignature, id: res.id };
  }

  if (ex.mode === "trigger-cancel") {
    onStep("Sign in to Jupiter orders");
    const jwt = await ensureJwt(wallet);
    const init = await api<{ transaction: string; requestId: string }>(`/api/trigger/orders/price/cancel/${ex.orderId}`, { body: {}, jwt });
    onStep("Approve withdrawal in your wallet");
    const signed = await signB64(wallet, init.transaction);
    onStep("Confirming cancellation");
    const res = await api<{ txSignature?: string }>(`/api/trigger/orders/price/confirm-cancel/${ex.orderId}`, {
      body: { signedTransaction: signed, cancelRequestId: init.requestId },
      jwt,
    });
    return { signature: res.txSignature, id: ex.orderId };
  }

  throw new Error("Unsupported action");
}
