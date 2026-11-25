import test from "node:test";
import assert from "node:assert/strict";
import { toMinorUnits, fromMinorUnits } from "../src/domain/money.ts";
import { addDays, addMonthsClamped } from "../src/domain/dates.ts";
import { calculateAccountBalance, assertTransferAllowed } from "../src/domain/accounts.ts";
import { getBudgetWindow } from "../src/domain/budgets.ts";
import { advanceBillingDate } from "../src/domain/subscriptions.ts";
import { allocateLoanPayment } from "../src/domain/loans.ts";

test("money uses integer minor units", () => {
  assert.equal(toMinorUnits(125.5), 12550);
  assert.equal(fromMinorUnits(12550), 125.5);
});
test("date helpers clamp month ends and handle leap years", () => {
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsClamped("2025-01-31", 1), "2025-02-28");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
});
test("account balance includes transfer direction and ignores deleted entries", () => {
  assert.equal(calculateAccountBalance(10000, [
    { type: "income", amountMinor: 5000 }, { type: "expense", amountMinor: 2000 },
    { type: "transfer", amountMinor: 1000, transferDirection: "out" },
    { type: "income", amountMinor: 999, deletedAt: "2026-01-01" },
  ]), 12000);
});
test("transfers reject same-account and cross-currency movement", () => {
  assert.throws(() => assertTransferAllowed({ sourceAccountId: "a", destinationAccountId: "a", sourceCurrency: "PHP", destinationCurrency: "PHP" }));
  assert.throws(() => assertTransferAllowed({ sourceAccountId: "a", destinationAccountId: "b", sourceCurrency: "PHP", destinationCurrency: "USD" }));
});
test("budget periods remain anchored to the original start date", () => {
  assert.deepEqual(getBudgetWindow({ period: "weekly", startDate: "2026-01-04", referenceDate: "2026-01-20" }), { startDate: "2026-01-18", endDate: "2026-01-24" });
  assert.deepEqual(getBudgetWindow({ period: "monthly", startDate: "2025-01-31", referenceDate: "2025-03-15" }), { startDate: "2025-02-28", endDate: "2025-03-30" });
});
test("subscription billing dates clamp at month ends", () => {
  assert.equal(advanceBillingDate("2025-01-31", "monthly"), "2025-02-28");
  assert.equal(advanceBillingDate("2024-11-30", "quarterly"), "2025-02-28");
});
test("loan payments allocate accrued interest before principal", () => {
  const result = allocateLoanPayment({
    terms: { principalMinor: 100000, monthlyRateBps: 200, termMonths: 2, interestType: "reducing_balance" },
    previousPaymentDate: "2026-01-01",
    payment: { amountMinor: 10000, paymentDate: "2026-01-16" },
    remainingPrincipalMinor: 100000, accruedFlatInterestMinor: 0,
  });
  assert.ok(result.interestPaidMinor > 0);
  assert.equal(result.interestPaidMinor + result.principalPaidMinor, 10000);
});