export type ActivityEntity =
  | "account"
  | "transaction"
  | "budget"
  | "goal"
  | "loan"
  | "subscription"
  | "recurring";

const ACTION_LABELS: Record<string, string> = {
  "account.created": "Created an account",
  "account.updated": "Updated an account",
  "account.archived": "Archived an account",
  "account.restored": "Restored an account",
  "account.deleted": "Deleted an account",
  "transaction.created": "Added a transaction",
  "transaction.updated": "Updated a transaction",
  "transaction.deleted": "Deleted a transaction",
  "budget.created": "Created a budget",
  "budget.updated": "Updated a budget",
  "budget.deleted": "Deleted a budget",
  "goal.created": "Created a savings goal",
  "goal.updated": "Updated a savings goal",
  "goal.status_updated": "Changed a savings goal status",
  "goal.deleted": "Deleted a savings goal",
  "goal.contribution_recorded": "Recorded a savings contribution",
  "loan.created": "Created a loan",
  "loan.updated": "Updated a loan",
  "loan.deleted": "Deleted a loan",
  "loan.status_updated": "Changed a loan status",
  "loan.payment_recorded": "Recorded a loan payment",
  "loan.payment_deleted": "Deleted a loan payment",
  "subscription.created": "Created a subscription",
  "subscription.updated": "Updated a subscription",
  "subscription.deleted": "Deleted a subscription",
  "subscription.status_updated": "Changed a subscription status",
  "subscription.payment_recorded": "Recorded a subscription payment",
  "subscription.payment_deleted": "Deleted a subscription payment",
  "recurring.created": "Created a recurring schedule",
  "recurring.updated": "Updated a recurring schedule",
  "recurring.deleted": "Deleted a recurring schedule",
  "recurring.status_updated": "Changed a recurring schedule status",
};

export function activityActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function activityEntityLabel(entityType: string): string {
  const labels: Record<string, string> = {
    account: "Account",
    transaction: "Transaction",
    budget: "Budget",
    goal: "Savings goal",
    loan: "Loan",
    subscription: "Subscription",
    recurring: "Recurring schedule",
  };
  return labels[entityType] ?? entityType.replace(/[._-]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function activityIconName(entityType: string): string {
  const icons: Record<string, string> = {
    account: "wallet-outline",
    transaction: "swap-horizontal",
    budget: "chart-donut",
    goal: "target",
    loan: "bank-outline",
    subscription: "calendar-clock",
    recurring: "repeat",
  };
  return icons[entityType] ?? "history";
}
