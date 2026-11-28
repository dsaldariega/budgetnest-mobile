import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/(tabs)/index.tsx", "utf8");

test("dashboard query results are destructured in the same order as its four queries", () => {
  assert.match(source, /const\s+\[accounts,\s*budgets,\s*activity,\s*monthlyRows\]\s*=\s*await\s+Promise\.all\s*\(\s*\[/);
  assert.doesNotMatch(source, /\[accounts,\s*budgets,\s*goals,\s*subscriptions,\s*loans,\s*activity,\s*monthlyRows\]/);
});

test("dashboard month navigation drives monthly cash-flow and recent activity filters", () => {
  assert.match(source, /setSelectedMonth\(value => shiftMonth\(value, -1\)\)/);
  assert.match(source, /setSelectedMonth\(value => shiftMonth\(value, 1\)\)/);
  assert.match(source, /substr\(t\.occurred_at, 1, 7\) = \?/);
  assert.match(source, /fromDate: bounds\.start, toDate: bounds\.end/);
  assert.match(source, /item\.incomeMinor - item\.expenseMinor/);
});

test("dashboard exposes income, expense, and transfer shortcuts without a duplicate expense CTA", () => {
  assert.match(source, /quick=income/);
  assert.match(source, /quick=expense/);
  assert.match(source, /quick=transfer/);
  assert.equal((source.match(/label="Expense"/g) ?? []).length, 1);
});

test("dashboard keeps balances grouped by currency and uses active budgets", () => {
  assert.match(source, /new Set\(\[\.\.\.safeAccounts\.map\(a => a\.currencyCode\)/);
  assert.match(source, /createBudgetRepository\(db\)\.list\(date\)/);
  assert.match(source, /\.filter\(item => item\.startDate <= date/);
});
