import assert from "node:assert/strict";
import test from "node:test";
import { addMonthsClamped } from "@/domain/dates";
import { allocateLoanPayment, calculateLoanSummary } from "@/domain/loans";
import { assertTransferAllowed, calculateAccountBalance } from "@/domain/accounts";
import { getBudgetWindow } from "@/domain/budgets";
import { getGoalProgress } from "@/domain/goals";

test("money/date helpers preserve minor units and month-end dates", async () => {
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsClamped("2025-01-31", 1), "2025-02-28");
});

test("account balance respects transaction direction and deleted rows", async () => {
  assert.equal(calculateAccountBalance(10000, [
    { type: "income", amountMinor: 5000 },
    { type: "expense", amountMinor: 1500 },
    { type: "transfer", amountMinor: 2000, transferDirection: "out" },
    { type: "transfer", amountMinor: 3000, transferDirection: "in" },
    { type: "expense", amountMinor: 9000, deletedAt: "2026-01-01T00:00:00.000Z" },
  ]), 14500);
});

test("same-account and cross-currency transfers are rejected", async () => {
  assert.throws(() => assertTransferAllowed({
    sourceAccountId: "account-1",
    destinationAccountId: "account-1",
    sourceCurrency: "PHP",
    destinationCurrency: "PHP",
  }), /Transfer accounts must be different/);

  assert.throws(() => assertTransferAllowed({
    sourceAccountId: "account-1",
    destinationAccountId: "account-2",
    sourceCurrency: "PHP",
    destinationCurrency: "USD",
  }), /different currencies/);
});

test("budget windows follow their configured period", async () => {
  assert.deepEqual(getBudgetWindow({
    period: "weekly",
    startDate: "2026-01-05",
    referenceDate: "2026-01-07",
  }), { startDate: "2026-01-05", endDate: "2026-01-11" });

  assert.deepEqual(getBudgetWindow({
    period: "monthly",
    startDate: "2026-01-31",
    referenceDate: "2026-02-15",
  }), { startDate: "2026-01-31", endDate: "2026-02-27" });

  assert.throws(() => getBudgetWindow({
    period: "custom",
    startDate: "2026-01-10",
    endDate: "2026-01-09",
    referenceDate: "2026-01-10",
  }), /valid end date/);
});

test("goal progress clamps to the target", async () => {
  assert.equal(getGoalProgress(12000, 10000), 1);
  assert.equal(getGoalProgress(2500, 10000), 0.25);
});

test("loan summaries and payment allocation handle interest first", async () => {
  const terms = { principalMinor: 100000, monthlyRateBps: 200, termMonths: 10, interestType: "flat_rate" as const };
  const summary = calculateLoanSummary(terms, "2026-01-31");
  assert.equal(summary.totalInterestMinor, 20000);
  assert.equal(summary.totalPayableMinor, 120000);
  assert.equal(summary.scheduledPaymentMinor, 12000);
  assert.equal(summary.dueDate, "2026-11-30");

  const allocation = allocateLoanPayment({
    terms,
    previousPaymentDate: "2026-01-31",
    payment: { amountMinor: 10000, paymentDate: "2026-02-28" },
    remainingPrincipalMinor: 100000,
    remainingInterestMinor: 20000,
  });
  assert.equal(allocation.interestPaidMinor, 2000);
  assert.equal(allocation.principalPaidMinor, 8000);
  assert.equal(allocation.remainingInterestMinor, 18000);
  assert.equal(allocation.remainingPrincipalMinor, 92000);
});

test("reducing-balance zero-rate loan is simple principal division", async () => {
  const summary = calculateLoanSummary({
    principalMinor: 100000,
    monthlyRateBps: 0,
    termMonths: 4,
    interestType: "reducing_balance",
  }, "2026-01-15");
  assert.equal(summary.totalInterestMinor, 0);
  assert.equal(summary.scheduledPaymentMinor, 25000);
});


test("loan payment dates must stay chronological", async () => {
  const terms = {
    principalMinor: 100000,
    monthlyRateBps: 200,
    termMonths: 10,
    interestType: "flat_rate" as const,
  };
  assert.throws(() => allocateLoanPayment({
    terms,
    previousPaymentDate: "2026-02-28",
    payment: { amountMinor: 10000, paymentDate: "2026-02-27" },
    remainingPrincipalMinor: 92000,
    remainingInterestMinor: 18000,
  }), /earlier than the previous payment/);
});

test("flat-rate payment can settle future interest after principal", async () => {
  const terms = {
    principalMinor: 100000,
    monthlyRateBps: 200,
    termMonths: 2,
    interestType: "flat_rate" as const,
  };
  const allocation = allocateLoanPayment({
    terms,
    previousPaymentDate: "2026-01-01",
    payment: { amountMinor: 104000, paymentDate: "2026-02-01" },
    remainingPrincipalMinor: 100000,
    remainingInterestMinor: 4000,
  });
  assert.equal(allocation.interestPaidMinor, 4000);
  assert.equal(allocation.principalPaidMinor, 100000);
  assert.equal(allocation.remainingInterestMinor, 0);
  assert.equal(allocation.remainingPrincipalMinor, 0);
});

import { advanceRecurringDate, getDueRecurringDates } from "@/domain/recurring";

test("recurring schedules advance by interval with month-end clamping", () => {
  assert.equal(advanceRecurringDate("2026-01-31", "monthly", 1), "2026-02-28");
  assert.equal(advanceRecurringDate("2026-01-31", "monthly", 2), "2026-03-31");
  assert.equal(advanceRecurringDate("2026-02-28", "yearly", 1), "2027-02-28");
  assert.equal(advanceRecurringDate("2026-01-01", "weekly", 2), "2026-01-15");
});

test("due recurring dates include missed occurrences once and stop at end date", () => {
  assert.deepEqual(getDueRecurringDates({
    nextOccurrenceDate: "2026-01-31",
    frequency: "monthly",
    intervalCount: 1,
    throughDate: "2026-04-30",
    endDate: "2026-03-31",
  }), ["2026-01-31", "2026-02-28", "2026-03-28"]);
});
