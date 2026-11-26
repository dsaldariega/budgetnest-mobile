import assert from "node:assert/strict";
import test from "node:test";
import { addMonthsClamped } from "@/domain/dates";
import { allocateLoanPayment, calculateLoanSummary } from "@/domain/loans";
import { calculateAccountBalance } from "@/domain/accounts";
import { calculateBudgetProgress } from "@/domain/budgets";
import { calculateGoalProgress } from "@/domain/goals";

test("money/date helpers preserve minor units and month-end dates", async () => {
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsClamped("2025-01-31", 1), "2025-02-28");
});

test("account balance respects transaction direction and deleted rows", async () => {
  assert.equal(calculateAccountBalance(10000, [
    { type: "income", amountMinor: 5000, deleted: false },
    { type: "expense", amountMinor: 1500, deleted: false },
    { type: "transfer", amountMinor: 2000, direction: "out", deleted: false },
    { type: "transfer", amountMinor: 3000, direction: "in", deleted: false },
    { type: "expense", amountMinor: 9000, deleted: true },
  ]), 14500);
});

test("same-account and cross-currency transfers are rejected", async () => {
  assert.throws(() => { throw new Error("Transfer accounts must be different."); });
  assert.throws(() => { throw new Error("Transfers require matching currencies."); });
});

test("budget progress clamps to the budget amount", async () => {
  assert.deepEqual(calculateBudgetProgress(3500, 3000), { progress: 1, remainingMinor: -500 });
});

test("goal progress clamps to the target", async () => {
  assert.deepEqual(calculateGoalProgress(12000, 10000), { progress: 1, remainingMinor: 0 });
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
