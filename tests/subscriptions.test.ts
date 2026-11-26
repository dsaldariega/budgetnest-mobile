import test from "node:test";
import assert from "node:assert/strict";
import { addMonthsClamped } from "@/domain/dates";
import { advanceBillingDate, billingCycleLabel } from "@/domain/subscriptions";

test("subscription billing dates advance weekly", () => {
  assert.equal(advanceBillingDate("2026-01-05", "weekly"), "2026-01-12");
});

test("subscription billing dates clamp month end", () => {
  assert.equal(advanceBillingDate("2026-01-31", "monthly"), "2026-02-28");
  assert.equal(advanceBillingDate("2024-02-29", "yearly"), "2025-02-28");
});

test("quarterly billing preserves a valid day", () => {
  assert.equal(advanceBillingDate("2026-01-31", "quarterly"), "2026-04-30");
});

test("subscription billing cycle labels are readable", () => {
  assert.equal(billingCycleLabel("weekly"), "Weekly");
  assert.equal(billingCycleLabel("monthly"), "Monthly");
  assert.equal(billingCycleLabel("quarterly"), "Quarterly");
  assert.equal(billingCycleLabel("yearly"), "Yearly");
});

test("date helper remains clamped for subscription use", () => {
  assert.equal(addMonthsClamped("2026-03-31", 1), "2026-04-30");
});
