import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync("app/(tabs)/index.tsx", "utf8");
const transactions = readFileSync("app/(tabs)/transactions.tsx", "utf8");
const accounts = readFileSync("app/(tabs)/accounts.tsx", "utf8");
const budgets = readFileSync("app/(tabs)/budgets.tsx", "utf8");
const reports = readFileSync("app/reports.tsx", "utf8");

test("home combines total balance and selected-month cash flow in one hero", () => {
  assert.match(dashboard, /TOTAL BALANCE/);
  assert.match(dashboard, /THIS MONTH/);
  assert.match(dashboard, /cashFlowCurrency/);
  assert.match(dashboard, /monthBounds\(selectedMonth\)/);
  assert.match(dashboard, /balanceMinor: activeAccounts\.filter\(account => account\.currencyCode/);
});

test("home has one prominent Log Expense action that opens expense mode directly", () => {
  assert.match(dashboard, /Log Expense/);
  assert.match(dashboard, /transactions\?quick=expense/);
  assert.doesNotMatch(dashboard, /Quick Access|Savings Goals|Upcoming Bills|Loan Obligations/);
  assert.doesNotMatch(dashboard, /label="Income"|label="Transfer"/);
  assert.match(transactions, /if \(quick === "income" \|\| quick === "expense" \|\| quick === "transfer"\)/);
  assert.match(transactions, /void openNew\(quick\)/);
});

test("home only previews budgets and recent activity with See all navigation", () => {
  assert.match(dashboard, /SectionHeader title="Budgets" actionLabel="See all"/);
  assert.match(dashboard, /SectionHeader title="Recent Activity" actionLabel="See all"/);
  assert.doesNotMatch(dashboard, /SectionHeader title="Cash flow"/);
});

test("empty states use the shared component across home, accounts, budgets, and reports", () => {
  for (const source of [dashboard, accounts, budgets, reports]) {
    assert.match(source, /import \{ EmptyState \} from "@\/components\/EmptyState"/);
    assert.match(source, /<EmptyState/);
  }
  assert.match(reports, /transactions\?quick=expense/);
});
