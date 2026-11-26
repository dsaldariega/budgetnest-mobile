import { addDays, addMonthsClamped, compareDates } from "./dates";

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";

export function advanceBillingDate(dateOnly: string, cycle: BillingCycle): string {
  compareDates(dateOnly, dateOnly);
  switch (cycle) {
    case "weekly": return addDays(dateOnly, 7);
    case "monthly": return addMonthsClamped(dateOnly, 1);
    case "quarterly": return addMonthsClamped(dateOnly, 3);
    case "yearly": return addMonthsClamped(dateOnly, 12);
  }
}

export function billingCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case "weekly": return "Weekly";
    case "monthly": return "Monthly";
    case "quarterly": return "Quarterly";
    case "yearly": return "Yearly";
  }
}
