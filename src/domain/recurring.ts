import { addDays, addMonthsClamped, compareDates } from "./dates";
export type RecurringFrequency = "weekly" | "monthly" | "yearly";
export function advanceRecurringDate(dateOnly: string, frequency: RecurringFrequency, intervalCount = 1): string {
  compareDates(dateOnly, dateOnly);
  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 120) throw new Error("Repeat interval must be between 1 and 120.");
  switch (frequency) {
    case "weekly": return addDays(dateOnly, intervalCount * 7);
    case "monthly": return addMonthsClamped(dateOnly, intervalCount);
    case "yearly": return addMonthsClamped(dateOnly, intervalCount * 12);
  }
}
export function getDueRecurringDates(input: { nextOccurrenceDate: string; frequency: RecurringFrequency; intervalCount: number; throughDate: string; endDate?: string | null; maxOccurrences?: number }): string[] {
  compareDates(input.nextOccurrenceDate, input.throughDate);
  if (input.endDate) compareDates(input.endDate, input.nextOccurrenceDate);
  const max = input.maxOccurrences ?? 500;
  if (!Number.isInteger(max) || max < 1 || max > 5000) throw new Error("Occurrence limit is invalid.");
  const dates: string[] = [];
  let cursor = input.nextOccurrenceDate;
  while (compareDates(cursor, input.throughDate) <= 0 && (!input.endDate || compareDates(cursor, input.endDate) <= 0)) {
    if (dates.length >= max) throw new Error("Too many recurring entries are due. Generate a smaller date range first.");
    dates.push(cursor);
    cursor = advanceRecurringDate(cursor, input.frequency, input.intervalCount);
  }
  return dates;
}
