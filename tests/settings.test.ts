import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CURRENCY_CODE, isSupportedDefaultCurrency, SUPPORTED_DEFAULT_CURRENCIES } from "@/database/repositories/settings-repository";

test("default currency is PHP", () => {
  assert.equal(DEFAULT_CURRENCY_CODE, "PHP");
});

test("supported default currencies are unique three-letter codes", () => {
  const codes = SUPPORTED_DEFAULT_CURRENCIES.map(({ code }) => code);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[A-Z]{3}$/);
});

test("currency preference rejects unsupported values", () => {
  assert.equal(isSupportedDefaultCurrency("PHP"), true);
  assert.equal(isSupportedDefaultCurrency("USD"), true);
  assert.equal(isSupportedDefaultCurrency("BTC"), false);
  assert.equal(isSupportedDefaultCurrency(""), false);
});
