export type TxStep = { label: string; base64: string };

export type ActionExec =
  | { mode: "send"; txs: TxStep[] }
  | { mode: "jup-swap"; tx: string; requestId: string }
  | {
      mode: "trigger-create";
      kind: "dca" | "price";
      // everything needed to craft the deposit and create the order
      deposit: { inputMint: string; outputMint: string; amount: string; orderType: "dca" | "price"; orderSubType?: string };
      body: Record<string, unknown>;
    }
  | { mode: "trigger-cancel"; orderId: string };

export type PendingAction = {
  id: string;
  kind: string;
  title: string;
  lines: { k: string; v: string }[];
  warnings?: string[];
  simulation?: { ok: boolean; error?: string };
  exec: ActionExec;
};

export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string; status: "running" | "done" | "error" }
  | { type: "action"; action: PendingAction }
  | { type: "limit"; remaining: number }
  | { type: "error"; message: string }
  | { type: "done" };

export type HistoryMsg = { role: "user" | "assistant"; content: string };
