export type HistoryKind = "income" | "expense" | "transfer" | "loan" | "subscription" | "savings";

export type HistoryFilter = "all" | HistoryKind;

export function historyKindLabel(kind: HistoryFilter): string {
  switch (kind) {
    case "all": return "All";
    case "income": return "Income";
    case "expense": return "Expenses";
    case "transfer": return "Transfers";
    case "loan": return "Loans";
    case "subscription": return "Subscriptions";
    case "savings": return "Savings";
  }
}

export function historyAmountPrefix(kind: HistoryKind): string {
  return kind === "income" ? "+" : kind === "expense" ? "−" : "";
}
