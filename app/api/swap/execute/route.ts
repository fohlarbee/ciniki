import { jup } from "@/lib/jup";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { signedTransaction, requestId } = await req.json().catch(() => ({}));
  if (typeof signedTransaction !== "string" || typeof requestId !== "string") {
    return Response.json({ error: "signedTransaction and requestId are required" }, { status: 400 });
  }
  try {
    return Response.json(await jup("/swap/v2/execute", { body: { signedTransaction, requestId } }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Execute failed" }, { status: 502 });
  }
}
