import { addDays, addMonthsClamped, compareDates, daysInMonth } from "./dates";

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

export type LoanSummary = {
  totalInterestMinor: number;
  totalPayableMinor: number;
  scheduledPaymentMinor: number;
  dueDate: string;
};

function validateTerms(terms: LoanTerms): void {
  if (!Number.isSafeInteger(terms.principalMinor) || terms.principalMinor <= 0) throw new Error("Principal must be positive.");
  if (!Number.isSafeInteger(terms.monthlyRateBps) || terms.monthlyRateBps < 0) throw new Error("Interest rate must be non-negative basis points.");
  if (!Number.isInteger(terms.termMonths) || terms.termMonths <= 0) throw new Error("Term must be a positive number of months.");
}

function roundMinor(value: number): number {
  return Math.max(0, Math.round(value));
}

export function calculateLoanSummary(terms: LoanTerms, startDate: string): LoanSummary {
  validateTerms(terms);
  compareDates(startDate, startDate);
  const monthlyRate = terms.monthlyRateBps / 10_000;
  let totalInterestMinor: number;
  let scheduledPaymentMinor: number;

  if (terms.interestType === "flat_rate") {
    totalInterestMinor = roundMinor(terms.principalMinor * monthlyRate * terms.termMonths);
    scheduledPaymentMinor = Math.ceil((terms.principalMinor + totalInterestMinor) / terms.termMonths);
  } else if (monthlyRate === 0) {
    totalInterestMinor = 0;
    scheduledPaymentMinor = Math.ceil(terms.principalMinor / terms.termMonths);
  } else {
    const factor = Math.pow(1 + monthlyRate, terms.termMonths);
    const payment = terms.principalMinor * (monthlyRate * factor) / (factor - 1);
    scheduledPaymentMinor = roundMinor(payment);
    totalInterestMinor = Math.max(0, scheduledPaymentMinor * terms.termMonths - terms.principalMinor);
  }

  return {
    totalInterestMinor,
    totalPayableMinor: terms.principalMinor + totalInterestMinor,
    scheduledPaymentMinor,
    dueDate: addMonthsClamped(startDate, terms.termMonths),
  };
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
  return roundMinor(interest);
}

export function allocateLoanPayment(input: {
  terms: LoanTerms;
  previousPaymentDate: string;
  payment: LoanPayment;
  remainingPrincipalMinor: number;
  remainingInterestMinor: number;
}): LoanAllocation {
  validateTerms(input.terms);
  if (!Number.isSafeInteger(input.payment.amountMinor) || input.payment.amountMinor <= 0) throw new Error("Payment must be positive.");
  if (!Number.isSafeInteger(input.remainingPrincipalMinor) || input.remainingPrincipalMinor < 0) throw new Error("Remaining principal is invalid.");
  if (!Number.isSafeInteger(input.remainingInterestMinor) || input.remainingInterestMinor < 0) throw new Error("Remaining interest is invalid.");
  if (input.payment.amountMinor > input.remainingPrincipalMinor + input.remainingInterestMinor) {
    throw new Error("Payment exceeds the remaining loan obligation.");
  }

  const principalBasis = input.terms.interestType === "flat_rate"
    ? input.terms.principalMinor
    : input.remainingPrincipalMinor;
  const accrued = accruedInterest(
    principalBasis,
    input.terms.monthlyRateBps,
    input.previousPaymentDate,
    input.payment.paymentDate,
  );
  const interestDue = input.terms.interestType === "flat_rate"
    ? Math.min(input.remainingInterestMinor, accrued)
    : Math.min(input.remainingInterestMinor, accrued);
  const interestPaidMinor = Math.min(input.payment.amountMinor, interestDue);
  const principalPaidMinor = Math.min(
    input.remainingPrincipalMinor,
    input.payment.amountMinor - interestPaidMinor,
  );

  return {
    interestPaidMinor,
    principalPaidMinor,
    remainingInterestMinor: input.remainingInterestMinor - interestPaidMinor,
    remainingPrincipalMinor: input.remainingPrincipalMinor - principalPaidMinor,
  };
}
