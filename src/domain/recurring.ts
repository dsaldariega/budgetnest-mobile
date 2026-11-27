import { addDays, addMonthsClamped, compareDates } from "./dates";
export type RecurringFrequency = "weekly" | "monthly" | "yearly";

function advanceRecurringPeriods(dateOnly: string, frequency: RecurringFrequency, periods: number): string {
  if (!Number.isInteger(periods) || periods < 0) throw new Error("Recurring periods must be a non-negative integer.");
  switch (frequency) {
    case "weekly": return addDays(dateOnly, periods * 7);
    case "monthly": return addMonthsClamped(dateOnly, periods);
    case "yearly": return addMonthsClamped(dateOnly, periods * 12);
  }
}

export function advanceRecurringDate(dateOnly: string, frequency: RecurringFrequency, intervalCount = 1): string {
  compareDates(dateOnly, dateOnly);
  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 120) throw new Error("Repeat interval must be between 1 and 120.");
  return advanceRecurringPeriods(dateOnly, frequency, intervalCount);
}

export function advanceRecurringDateFromAnchor(
  anchorDate: string,
  currentDate: string,
  frequency: RecurringFrequency,
  intervalCount = 1,
): string {
  compareDates(anchorDate, currentDate);
  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 120) throw new Error("Repeat interval must be between 1 and 120.");

  let occurrenceIndex = 0;
  let candidate = anchorDate;
  while (compareDates(candidate, currentDate) < 0) {
    occurrenceIndex += intervalCount;
    candidate = advanceRecurringPeriods(anchorDate, frequency, occurrenceIndex);
    if (occurrenceIndex > 5000) throw new Error("Recurring schedule has too many periods to calculate.");
  }

  if (compareDates(candidate, currentDate) === 0) {
    occurrenceIndex += intervalCount;
  }

  return advanceRecurringPeriods(anchorDate, frequency, occurrenceIndex);
}

export function getDueRecurringDates(input: {
  nextOccurrenceDate: string;
  frequency: RecurringFrequency;
  intervalCount: number;
  throughDate: string;
  endDate?: string | null;
  anchorDate?: string;
  maxOccurrences?: number;
}): string[] {
  compareDates(input.nextOccurrenceDate, input.throughDate);
  if (input.endDate) compareDates(input.endDate, input.nextOccurrenceDate);
  const max = input.maxOccurrences ?? 500;
  if (!Number.isInteger(max) || max < 1 || max > 5000) throw new Error("Occurrence limit is invalid.");

  const anchorDate = input.anchorDate ?? input.nextOccurrenceDate;
  compareDates(anchorDate, anchorDate);

  let cursor = input.nextOccurrenceDate;
  if (compareDates(cursor, anchorDate) < 0) {
    throw new Error("Next recurring date cannot be before the schedule start date.");
  }

  if (input.anchorDate) {
    let occurrenceIndex = 0;
    let candidate = anchorDate;
    while (compareDates(candidate, cursor) < 0) {
      occurrenceIndex += input.intervalCount;
      candidate = advanceRecurringPeriods(anchorDate, input.frequency, occurrenceIndex);
      if (occurrenceIndex > 5000) throw new Error("Recurring schedule has too many periods to calculate.");
    }
    cursor = candidate;
  }

  const dates: string[] = [];
  while (compareDates(cursor, input.throughDate) <= 0 && (!input.endDate || compareDates(cursor, input.endDate) <= 0)) {
    if (dates.length >= max) throw new Error("Too many recurring entries are due. Generate a smaller date range first.");
    dates.push(cursor);
    cursor = input.anchorDate
      ? advanceRecurringDateFromAnchor(anchorDate, cursor, input.frequency, input.intervalCount)
      : advanceRecurringDate(cursor, input.frequency, input.intervalCount);
  }
  return dates;
}
