// Per-wallet daily message cap. In-memory: swap for Redis/Upstash when running more than one instance.
const store = new Map<string, number>();

export function consume(wallet: string): { ok: boolean; remaining: number; limit: number } {
  const limit = Number(process.env.DAILY_FREE_MESSAGES ?? 25);
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${wallet}`;
  const used = store.get(key) ?? 0;
  if (used >= limit) return { ok: false, remaining: 0, limit };
  store.set(key, used + 1);
  if (store.size > 5000) for (const k of store.keys()) if (!k.startsWith(day)) store.delete(k);
  return { ok: true, remaining: limit - used - 1, limit };
}
