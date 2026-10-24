import { getPortfolio } from "@/lib/data";
import { parsePubkey } from "@/lib/solana";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const wallet = new URL(req.url).searchParams.get("wallet") ?? "";
  try {
    parsePubkey(wallet, "wallet");
    return Response.json(await getPortfolio(wallet));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 400 });
  }
}
