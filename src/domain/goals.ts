import { compareDates } from "./dates.js";

export function validateGoalTargetDate(targetDate: string | null | undefined): void {
  if (targetDate) compareDates(targetDate, targetDate);
}

export function getGoalProgress(currentAmountMinor: number, targetAmountMinor: number): number {
  if (!Number.isSafeInteger(currentAmountMinor) || !Number.isSafeInteger(targetAmountMinor) || targetAmountMinor <= 0) {
    throw new Error("Goal amounts are invalid.");
  }
  return Math.min(1, Math.max(0, currentAmountMinor / targetAmountMinor));
}
