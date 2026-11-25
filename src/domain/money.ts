export function toMinorUnits(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error("Amount must be a finite number.");
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromMinorUnits(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor)) throw new Error("Minor-unit amount must be a safe integer.");
  return amountMinor / 100;
}

export function assertPositiveMinorUnits(amountMinor: number): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Amount must be a positive whole number of minor units.");
  }
}
