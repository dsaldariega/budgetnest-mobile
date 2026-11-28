export type SystemCategorySeed = {
  id: string;
  name: string;
  type: "income" | "expense";
  icon: string;
  isSystem: 1;
  sourceName?: string | null;
};

export const SYSTEM_CATEGORIES: SystemCategorySeed[] = [
  { id: "cat-income-salary", name: "Salary", type: "income", icon: "wallet", isSystem: 1 },
  { id: "cat-income-business", name: "Business", type: "income", icon: "briefcase", isSystem: 1 },
  { id: "cat-income-investment", name: "Investment", type: "income", icon: "trending-up", isSystem: 1 },
  { id: "cat-income-other", name: "Other income", type: "income", icon: "plus-circle", isSystem: 1 },
  { id: "cat-expense-food", name: "Food & drinks", type: "expense", icon: "utensils", isSystem: 1 },
  { id: "cat-expense-transport", name: "Transportation", type: "expense", icon: "car", isSystem: 1 },
  { id: "cat-expense-bills", name: "Bills & utilities", type: "expense", icon: "receipt", isSystem: 1 },
  { id: "cat-expense-shopping", name: "Shopping", type: "expense", icon: "shopping-bag", isSystem: 1 },
  { id: "cat-expense-health", name: "Health", type: "expense", icon: "heart-pulse", isSystem: 1 },
  { id: "cat-expense-home", name: "Home", type: "expense", icon: "house", isSystem: 1 },
  { id: "cat-expense-other", name: "Other expense", type: "expense", icon: "more-horizontal", isSystem: 1 },
  { id: "cat-income-loan", name: "Loans", type: "income", icon: "bank", isSystem: 1 },
  { id: "cat-expense-savings", name: "Savings", type: "expense", icon: "piggy-bank", isSystem: 1 },
  { id: "cat-expense-loan-payment", name: "Loan payments", type: "expense", icon: "cash-minus", isSystem: 1, sourceName: null },
  { id: "cat-sub-cloud", name: "Cloud Services", type: "expense", icon: "cloud-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-entertainment", name: "Entertainment", type: "expense", icon: "movie-open-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-software", name: "Software and Applications", type: "expense", icon: "application-brackets-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-gym", name: "Gym and Fitness", type: "expense", icon: "dumbbell", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-music", name: "Music and Streaming", type: "expense", icon: "music-note-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-productivity", name: "Productivity", type: "expense", icon: "calendar-check-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-education", name: "Education", type: "expense", icon: "school-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-other", name: "Other", type: "expense", icon: "dots-horizontal-circle-outline", isSystem: 1, sourceName: "subscription" },
  { id: "cat-sub-general", name: "General", type: "expense", icon: "tag-outline", isSystem: 1, sourceName: "subscription" },
];
