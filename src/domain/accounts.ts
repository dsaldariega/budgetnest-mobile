export type BalanceEntry = {
  type: "income" | "expense" | "transfer";
  amountMinor: number;
  transferDirection?: "in" | "out" | null;
  deletedAt?: string | null;
};

export function calculateAccountBalance(
  openingBalanceMinor: number,
  entries: BalanceEntry[],
): number {
  if (!Number.isSafeInteger(openingBalanceMinor)) throw new Error("Opening balance must be a safe integer.");
  return entries.reduce((balance, entry) => {
    if (entry.deletedAt) return balance;
    if (!Number.isSafeInteger(entry.amountMinor) || entry.amountMinor <= 0) {
      throw new Error("Transaction amounts must be positive safe integers.");
    }
    if (entry.type === "income" || (entry.type === "transfer" && entry.transferDirection === "in")) {
      return balance + entry.amountMinor;
    }
    if (entry.type === "expense" || (entry.type === "transfer" && entry.transferDirection === "out")) {
      return balance - entry.amountMinor;
    }
    if (entry.type === "transfer") throw new Error("Transfers require an in/out direction.");
    throw new Error("Unsupported transaction type.");
  }, openingBalanceMinor);
}

export function assertTransferAllowed(input: {
  sourceAccountId: string;
  destinationAccountId: string;
  sourceCurrency: string;
  destinationCurrency: string;
  sourceArchived?: boolean;
  destinationArchived?: boolean;
}): void {
  if (input.sourceAccountId === input.destinationAccountId) throw new Error("Transfer accounts must be different.");
  if (input.sourceCurrency.toUpperCase() !== input.destinationCurrency.toUpperCase()) {
    throw new Error("Transfers between different currencies are not supported.");
  }
  if (input.sourceArchived || input.destinationArchived) throw new Error("Archived accounts cannot be used for transfers.");
}

export type TransferPairEntry = {
  accountId: string;
  amountMinor: number;
  transferDirection: "in" | "out" | null;
};

export function assertTransferPairIntegrity(entries: TransferPairEntry[]): void {
  if (entries.length !== 2) {
    throw new Error("Transfer must contain exactly one outgoing and one incoming entry.");
  }

  const outgoing = entries.filter(entry => entry.transferDirection === "out");
  const incoming = entries.filter(entry => entry.transferDirection === "in");

  if (outgoing.length !== 1 || incoming.length !== 1) {
    throw new Error("Transfer must contain exactly one outgoing and one incoming entry.");
  }

  const [source] = outgoing;
  const [destination] = incoming;

  if (source.accountId === destination.accountId) {
    throw new Error("Transfer entries must belong to different accounts.");
  }
  if (
    !Number.isSafeInteger(source.amountMinor) ||
    source.amountMinor <= 0 ||
    source.amountMinor !== destination.amountMinor
  ) {
    throw new Error("Transfer entries must have the same positive amount.");
  }
}
