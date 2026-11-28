import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accounts = readFileSync("app/(tabs)/accounts.tsx", "utf8");
const transactions = readFileSync("app/(tabs)/transactions.tsx", "utf8");

test("accounts show per-currency totals without combining unlike currencies", () => {
  assert.match(accounts, /new Map<string, number>\(\)/);
  assert.match(accounts, /formatMoney\(total, currencyCode\)/);
  assert.doesNotMatch(accounts, /Multiple currencies/);
});

test("account actions are discoverable and account form uses shared controls", () => {
  assert.match(accounts, /Edit \$\{account\.name\}/);
  assert.match(accounts, /<TextField label="Account name"/);
  assert.match(accounts, /<ChipGroup/);
  assert.match(accounts, /<Button label=\{editing \? "Save changes" : "Save account"\}/);
  assert.match(accounts, /KeyboardAvoidingView/);
});

test("account currency is validated for new accounts and preserved on edit", () => {
  assert.match(accounts, /\^\[A-Za-z\]\{3\}\$/);
  assert.match(accounts, /editing\?\.currencyCode \?\? currency\.trim\(\)\.toUpperCase\(\)/);
  assert.match(accounts, /editable=\{!editing\}/);
});

test("transaction form keeps amount-first entry and shared controls", () => {
  assert.match(transactions, /<TextField label="Amount"/);
  assert.match(transactions, /<ChipGroup/);
  assert.match(transactions, /<Button label=\{saving \? "Saving…" : editing \? "Save changes" : "Save transaction"\}/);
  assert.match(transactions, /KeyboardAvoidingView/);
  assert.match(transactions, /\[50, 100, 200, 500\]/);
});

test("transfer form asks for amount before choosing the two accounts", () => {
  const amountIndex = transactions.indexOf('<TextField label="Amount"');
  const sourceIndex = transactions.indexOf('<SelectField label="From account"');
  const destinationIndex = transactions.indexOf('<SelectField label="To account"');
  assert.ok(amountIndex >= 0 && amountIndex < sourceIndex && sourceIndex < destinationIndex);
});

test("transaction form retains transfer source and destination persistence", () => {
  assert.match(transactions, /txRepo\.createTransfer/);
  assert.match(transactions, /txRepo\.updateTransfer/);
  assert.match(transactions, /getTransferDestinationAccountId/);
});

test("quick action routes still open the requested transaction type", () => {
  assert.match(transactions, /if \(quick === "income" \|\| quick === "expense" \|\| quick === "transfer"\)/);
  assert.match(transactions, /void openNew\(quick\)/);
});
