import Anthropic from "@anthropic-ai/sdk";
import type { ChatEvent, HistoryMsg } from "./types";
import { toolDefs, toolMap } from "./tools";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_STEPS = 8;

export function systemPrompt(wallet: string) {
  return `You are the assistant inside a Solana-only DeFi app. You turn plain-language requests into on-chain actions the user approves in their own wallet.

Connected wallet: ${wallet}
Network: Solana mainnet. You cannot use any other chain. If asked to bridge or use another chain, explain this app is Solana-only and suggest funding the wallet through an exchange or a bridge UI they trust.

How you work:
- Use tools for anything live: balances, prices, yields, positions, token risk. Never invent numbers, rates or addresses.
- Action tools (swap, transfer, lend_*, borrow_manage, stake_sol, unstake_native, create_dca, create_price_order, cancel_order) only PREPARE a transaction. The user sees a confirmation card and signs in their wallet. Never say something was done, sent or executed; say it is ready for their approval.
- Call an action tool only when the user explicitly asked for that action with a clear token and amount. If something is missing or ambiguous (amount, which token, which vault), ask one short question first. Questions about options, rates or "what should I do" get information, not a prepared transaction.
- Tokens must be verified. If a tool says a symbol is ambiguous or unverified, show the candidates and ask for the mint address. Run analyze_token before helping the user buy an unfamiliar token and mention any risk flags.
- Before swapping or sending SOL, check there is enough left for fees (keep about 0.01 SOL) and mention it if balance is tight.
- You are not a financial advisor. Give facts, trade-offs and risks (liquidation, smart-contract risk, variable rates, slippage), not guarantees or price predictions.
- Be brief. Lead with the answer. Use short paragraphs or a compact list; no headings. Show amounts with their token symbol. Do not repeat details that are already on the confirmation card.`;
}

export async function runAgent(opts: {
  wallet: string;
  history: HistoryMsg[];
  send: (e: ChatEvent) => void;
  signal?: AbortSignal;
}) {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = opts.history.map((m) => ({ role: m.role, content: m.content }));
  const ctx = { wallet: opts.wallet, emit: (action: any) => opts.send({ type: "action", action }) };

  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream(
      {
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt(opts.wallet),
        tools: toolDefs as Anthropic.Tool[],
        messages,
      },
      { signal: opts.signal }
    );
    stream.on("text", (delta) => opts.send({ type: "text", delta }));
    const final = await stream.finalMessage();
    messages.push({ role: "assistant", content: final.content });

    if (final.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of final.content) {
      if (block.type !== "tool_use") continue;
      const tool = toolMap.get(block.name);
      if (!tool) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: `Unknown tool ${block.name}`, is_error: true });
        continue;
      }
      opts.send({ type: "tool", name: tool.name, label: tool.label, status: "running" });
      try {
        const out = await tool.run(block.input, ctx);
        opts.send({ type: "tool", name: tool.name, label: tool.label, status: "done" });
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out).slice(0, 12000) });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        opts.send({ type: "tool", name: tool.name, label: tool.label, status: "error" });
        results.push({ type: "tool_result", tool_use_id: block.id, content: `Error: ${msg}`, is_error: true });
      }
    }
    messages.push({ role: "user", content: results });
  }
}
