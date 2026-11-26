import assert from "node:assert/strict";
import test from "node:test";
import { getExportDateRange, makeTransactionCsv, normalizeImportCsv, parseCsv } from "@/services/csv/transaction-csv";

test("CSV parser handles quoted commas, quotes, and line breaks", () => {
  const rows = parseCsv('name,description\r\nWallet,"Coffee, tea"\r\nBank,"Said ""hello"""');
  assert.deepEqual(rows, [
    ["name", "description"],
    ["Wallet", "Coffee, tea"],
    ["Bank", 'Said "hello"'],
  ]);
});

test("CSV import normalizes dates and amounts", () => {
  const rows = normalizeImportCsv(
    "account_name,currency,transaction_type,amount,category,description,transaction_date\n" +
    'Main Wallet,php,expense,125.50,Food,"Lunch, snacks",11/26/2026',
  );
  assert.equal(rows[0].currency, "PHP");
  assert.equal(rows[0].amountMinor, 12550);
  assert.equal(rows[0].occurredAt, "2026-11-26");
  assert.equal(rows[0].description, "Lunch, snacks");
});

test("CSV import rejects unsupported transaction types and malformed dates", () => {
  assert.throws(
    () => normalizeImportCsv(
      "account_name,currency,transaction_type,amount,category,description,transaction_date\n" +
      "Wallet,PHP,transfer,10,Other,,2026-02-30",
    ),
    /transaction type|real date/,
  );
});

test("CSV export includes the compatible web-app header order", () => {
  const csv = makeTransactionCsv([{
    accountName: "Main Wallet",
    currencyCode: "PHP",
    type: "income",
    amountMinor: 25000,
    categoryName: "Salary",
    description: "Payday",
    occurredAt: "2026-11-26",
  }]);
  assert.match(csv, /account_name,currency,transaction_type,amount,category,description,transaction_date/);
  assert.match(csv, /Main Wallet,PHP,income,250\.00,Salary,Payday,2026-11-26/);
});

test("custom export date range is preserved", () => {
  assert.deepEqual(getExportDateRange("custom", "2026-01-01", "2026-01-31"), {
    start: "2026-01-01",
    end: "2026-01-31",
  });
});
