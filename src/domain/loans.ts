import { addDays, compareDates, daysInMonth } from "./dates.ts";

export type LoanInterestType = "flat_rate" | "reducing_balance";

export type LoanTerms = {
  principalMinor: number;
  monthlyRateBps: number;
  termMonths: number;
  interestType: LoanInterestType;
};

export type LoanPayment = {
  amountMinor: number;
  paymentDate: string;
};

export type LoanAllocation = {
  interestPaidMinor: number;
  principalPaidMinor: number;
  remainingInterestMinor: number;
  remainingPrincipalMinor: number;
};

function validateTerms(terms: LoanTerms): void {
  if (!Number.isSafeInteger(terms.principalMinor) || terms.principalMinor <= 0) throw new Error("Principal must be positive.");
  if (!Number.isSafeInteger(terms.monthlyRateBps) || terms.monthlyRateBps < 0) throw new Error("Interest rate must be non-negative basis points.");
  if (!Number.isInteger(terms.termMonths) || terms.termMonths <= 0) throw new Error("Term must be a positive number of months.");
}

function accruedInterest(
  balanceMinor: number,
  monthlyRateBps: number,
  fromDate: string,
  toDate: string,
): number {
  if (compareDates(toDate, fromDate) < 0) throw new Error("Payment dates must be in chronological order.");
  let cursor = fromDate;
  let interest = 0;
  while (compareDates(cursor, toDate) < 0) {
    const nextDay = addDays(cursor, 1);
    const dailyRate = monthlyRateBps / 10_000 / daysInMonth(cursor);
    interest += balanceMinor * dailyRate;
    cursor = nextDay;
  }
  return Math.round(interest);
}

export function allocateLoanPayment(input: {
  terms: LoanTerms;
  previousPaymentDate: string;
  payment: LoanPayment;
  remainingPrincipalMinor: number;
  accruedFlatInterestMinor: number;
}): LoanAllocation {
  validateTerms(input.terms);
  if (!Number.isSafeInteger(input.payment.amountMinor) || input.payment.amountMinor <= 0) throw new Error("Payment must be positive.");
  if (input.payment.amountMinor > input.remainingPrincipalMinor + input.accruedFlatInterestMinor) {
    throw new Error("Payment exceeds the remaining loan obligation.");
  }

  const principalBasis = input.terms.interestType === "flat_rate"
    ? input.terms.principalMinor
    : input.remainingPrincipalMinor;
  const accrued = input.terms.interestType === "flat_rate"
    ? accruedInterest(principalBasis, input.terms.monthlyRateBps, input.previousPaymentDate, input.payment.paymentDate)
    : accruedInterest(principalBasis, input.terms.monthlyRateBps, input.previousPaymentDate, input.payment.paymentDate);
  const interestDue = input.terms.interestType === "flat_rate"
    ? Math.min(input.accruedFlatInterestMinor, accrued)
    : accrued;
  const interestPaidMinor = Math.min(input.payment.amountMinor, interestDue);
  const principalPaidMinor = Math.min(
    input.remainingPrincipalMinor,
    input.payment.amountMinor - interestPaidMinor,
  );

  return {
    interestPaidMinor,
    principalPaidMinor,
    remainingInterestMinor: Math.max(0, input.accruedFlatInterestMinor - interestPaidMinor),
    remainingPrincipalMinor: input.remainingPrincipalMinor - principalPaidMinor,
  };
}
