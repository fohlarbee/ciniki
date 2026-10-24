import { PublicKey } from "@solana/web3.js";
import { runAgent } from "@/lib/agent";
import { consume } from "@/lib/limits";
import type { ChatEvent, HistoryMsg } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  let body: { wallet?: string; messages?: HistoryMsg[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const { wallet, messages } = body;
  try {
    new PublicKey(wallet ?? "");
  } catch {
    return new Response("Connect a wallet first", { status: 400 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return new Response("ANTHROPIC_API_KEY is not set on the server", { status: 500 });

  const history = (messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-24)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length || history[history.length - 1].role !== "user") return new Response("Nothing to answer", { status: 400 });

  const quota = consume(wallet!);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: ChatEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      if (!quota.ok) {
        send({ type: "error", message: `Daily free limit reached (${quota.limit} messages). It resets at 00:00 UTC.` });
        send({ type: "done" });
        controller.close();
        return;
      }
      send({ type: "limit", remaining: quota.remaining });
      try {
        await runAgent({ wallet: wallet!, history, send, signal: req.signal });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "Something went wrong" });
      }
      send({ type: "done" });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" } });
}
