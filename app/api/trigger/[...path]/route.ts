import { jup } from "@/lib/jup";

export const runtime = "nodejs";

// Thin proxy to Jupiter Trigger v2 that adds the server-side API key. Path allow-list keeps it narrow.
const ALLOWED = [
  /^auth\/challenge$/,
  /^auth\/verify$/,
  /^vault$/,
  /^vault\/register$/,
  /^deposit\/craft$/,
  /^orders\/dca$/,
  /^orders\/price$/,
  /^orders\/history$/,
  /^orders\/price\/cancel\/[\w-]+$/,
  /^orders\/price\/confirm-cancel\/[\w-]+$/,
];

async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const p = path.join("/");
  if (!ALLOWED.some((r) => r.test(p))) return Response.json({ error: "Not allowed" }, { status: 403 });
  const auth = req.headers.get("authorization") ?? "";
  const jwt = auth.startsWith("Bearer ") ? auth.slice(7) : undefined;
  const url = new URL(req.url);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : undefined;
    const out = await jup(`/trigger/v2/${p}`, { method: req.method as "GET" | "POST", query, body, jwt });
    return Response.json(out);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const status = /Jupiter (\d{3})/.exec(msg)?.[1];
    return Response.json({ error: msg }, { status: status ? Number(status) : 502 });
  }
}

export const GET = handle;
export const POST = handle;
