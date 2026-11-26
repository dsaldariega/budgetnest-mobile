export type AccountType = "cash" | "bank" | "e_wallet" | "credit_card" | "investment" | "other";
export type SourceAccountType = "cash" | "bank" | "e_wallet" | "credit" | "investment" | "other";
export type Account = {
  id: string; name: string; type: AccountType; sourceType: SourceAccountType | null;
  currencyCode: string; openingBalanceMinor: number; isArchived: boolean;
  createdAt: string; updatedAt: string;
};
export type TransactionType = "income" | "expense" | "transfer";
export type TransferDirection = "in" | "out";
export type Transaction = {
  id: string; accountId: string; categoryId: string | null; transferGroupId: string | null;
  transferDirection: TransferDirection | null; type: TransactionType; amountMinor: number;
  description: string; notes: string | null; occurredAt: string; createdAt: string; updatedAt: string;
};
export type CreateAccountInput = Pick<Account, "id" | "name" | "type" | "sourceType" | "currencyCode" | "openingBalanceMinor">;

export type BudgetPeriod = "weekly" | "monthly" | "yearly" | "custom";
export type Budget = {
  id: string; categoryId: string; accountId: string; period: BudgetPeriod;
  startDate: string; endDate: string | null; amountMinor: number; rolloverEnabled: boolean;
  createdAt: string; updatedAt: string;
};
export type SavingsGoal = {
  id: string; name: string; targetAmountMinor: number; targetDate: string | null;
  accountId: string; icon: string | null; color: string | null; isArchived: boolean;
  createdAt: string; updatedAt: string;
};
export type GoalContribution = {
  id: string; goalId: string; amountMinor: number; contributedAt: string;
  note: string | null; createdAt: string;
};

export type LoanInterestType = "flat_rate" | "reducing_balance";
export type LoanStatus = "active" | "paid" | "paused";
export type Loan = {
  id: string; name: string; principalMinor: number; monthlyInterestRateBps: number;
  interestType: LoanInterestType; termMonths: number; startDate: string; dueDate: string;
  status: LoanStatus; accountId: string | null; notes: string | null;
  createdAt: string; updatedAt: string;
};
export type LoanPayment = {
  id: string; loanId: string; amountMinor: number; interestPaidMinor: number;
  principalPaidMinor: number; paymentDate: string; notes: string | null; createdAt: string;
};

export type SubscriptionBillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";
export type Subscription = {
  id: string; name: string; amountMinor: number; billingCycle: SubscriptionBillingCycle;
  nextBillingDate: string; accountId: string | null; categoryId: string | null;
  isActive: boolean; createdAt: string; updatedAt: string;
};
export type SubscriptionPayment = {
  id: string; subscriptionId: string; amountMinor: number; billingDate: string;
  paidAt: string; notes: string | null; createdAt: string;
};
