import { addDays, addMonthsClamped, compareDates } from "./dates";

export type BudgetPeriod = "weekly" | "monthly" | "yearly" | "custom";

export function getBudgetWindow(input: {
  period: BudgetPeriod;
  startDate: string;
  endDate?: string | null;
  referenceDate: string;
}): { startDate: string; endDate: string } {
  if (compareDates(input.referenceDate, input.startDate) < 0) {
    throw new Error("Reference date is before the budget start date.");
  }
  if (input.period === "custom") {
    if (!input.endDate || compareDates(input.endDate, input.startDate) < 0) {
      throw new Error("A custom budget requires a valid end date.");
    }
    return { startDate: input.startDate, endDate: input.endDate };
  }
  if (input.period === "weekly") {
    const elapsed = Date.parse(input.referenceDate + "T00:00:00Z") - Date.parse(input.startDate + "T00:00:00Z");
    const start = addDays(input.startDate, Math.floor(elapsed / 604800000) * 7);
    return { startDate: start, endDate: addDays(start, 6) };
  }
  const step = input.period === "monthly" ? 1 : 12;
  let index = Math.max(0, (new Date(input.referenceDate).getUTCFullYear() - new Date(input.startDate).getUTCFullYear()) * 12 / step | 0);
  while (index > 0 && compareDates(addMonthsClamped(input.startDate, index * step), input.referenceDate) > 0) index--;
  while (compareDates(addMonthsClamped(input.startDate, (index + 1) * step), input.referenceDate) <= 0) index++;
  const start = addMonthsClamped(input.startDate, index * step);
  const next = addMonthsClamped(input.startDate, (index + 1) * step);
  return { startDate: start, endDate: addDays(next, -1) };
}
