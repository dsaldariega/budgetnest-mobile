import { addDays, addMonthsClamped } from "./dates";

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";

export function advanceBillingDate(dateOnly: string, cycle: BillingCycle): string {
  switch (cycle) {
    case "weekly": return addDays(dateOnly, 7);
    case "monthly": return addMonthsClamped(dateOnly, 1);
    case "quarterly": return addMonthsClamped(dateOnly, 3);
    case "yearly": return addMonthsClamped(dateOnly, 12);
  }
}
