export type AccountType = "cash" | "bank" | "e_wallet" | "credit_card" | "other";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  currencyCode: string;
  openingBalanceMinor: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  accountId: string;
  categoryId: string | null;
  transferGroupId: string | null;
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
  "id" | "name" | "type" | "currencyCode" | "openingBalanceMinor"
>;

export type CreateTransactionInput = Pick<
  Transaction,
  | "id"
  | "accountId"
  | "categoryId"
  | "transferGroupId"
  | "type"
  | "amountMinor"
  | "description"
  | "notes"
  | "occurredAt"
>;
