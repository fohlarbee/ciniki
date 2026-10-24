const BASE = "https://api.jup.ag";

type Opts = {
  method?: "GET" | "POST";
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  jwt?: string;
};

export async function jup<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(opts.query || {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
  if (opts.jwt) headers["Authorization"] = `Bearer ${opts.jwt}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const init: RequestInit = {
    method: opts.method || (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  };
  // The free Jupiter tier rate limits bursts (HTTP 429); back off briefly and retry.
  let res = await fetch(url, init);
  for (let attempt = 1; res.status === 429 && attempt <= 3; attempt++) {
    await new Promise((r) => setTimeout(r, 700 * attempt));
    res = await fetch(url, init);
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Jupiter ${res.status} on ${path}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export function extractTx(res: unknown): string {
  if (typeof res === "string") return res;
  const r = res as Record<string, unknown>;
  const tx = (r?.transaction ?? r?.tx) as string | undefined;
  if (!tx) throw new Error("Jupiter did not return a transaction");
  return tx;
}
