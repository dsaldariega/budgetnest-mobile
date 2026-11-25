export type AccountType = "cash" | "bank" | "e_wallet" | "credit_card" | "investment" | "other";
export type SourceAccountType = "cash" | "bank" | "e_wallet" | "credit" | "investment" | "other";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  sourceType: SourceAccountType | null;
  currencyCode: string;
  openingBalanceMinor: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TransactionType = "income" | "expense" | "transfer";
export type TransferDirection = "in" | "out";

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string | null;
  transferGroupId: string | null;
  transferDirection: TransferDirection | null;
  type: TransactionType;
  amountMinor: number;
  description: string;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAccountInput = Pick<
  Account,
  "id" | "name" | "type" | "sourceType" | "currencyCode" | "openingBalanceMinor"
>;

export type CreateTransactionInput = Pick<
  Transaction,
  | "id" | "accountId" | "categoryId" | "transferGroupId" | "transferDirection"
  | "type" | "amountMinor" | "description" | "notes" | "occurredAt"
>;
