function parseDate(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateOnly: string, days: number): string {
  if (!Number.isInteger(days)) throw new Error("Days must be an integer.");
  const date = parseDate(dateOnly);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

export function addMonthsClamped(dateOnly: string, months: number): string {
  if (!Number.isInteger(months)) throw new Error("Months must be an integer.");
  const source = parseDate(dateOnly);
  const targetMonth = source.getUTCMonth() + months;
  const year = source.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const day = Math.min(source.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return formatDate(new Date(Date.UTC(year, month, day)));
}

export function daysInMonth(dateOnly: string): number {
  const date = parseDate(dateOnly);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
}

export function todayLocalDate(): string {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function compareDates(left: string, right: string): number {
  const a = parseDate(left).getTime();
  const b = parseDate(right).getTime();
  return Math.sign(a - b);
}
