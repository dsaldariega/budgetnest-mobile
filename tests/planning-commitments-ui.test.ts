import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screens = [
  "app/(tabs)/budgets.tsx",
  "app/(tabs)/goals.tsx",
  "app/loans.tsx",
  "app/subscriptions.tsx",
  "app/recurring.tsx",
];

for (const path of screens) {
  test(`${path} keeps modal forms keyboard-aware and touch-friendly`, () => {
    const source = readFileSync(path, "utf8");
    const modalCount = (source.match(/<Modal\b/g) ?? []).length;
    const wrapperCount = (source.match(/<KeyboardAvoidingView\b/g) ?? []).length;
    const closeCount = (source.match(/<\/KeyboardAvoidingView>/g) ?? []).length;
    assert.ok(modalCount > 0);
    assert.equal(wrapperCount, modalCount);
    assert.equal(closeCount, modalCount);
    assert.match(source, /behavior={Platform\.OS === "ios" \? "padding" : "height"}/);
    assert.match(source, /primary:\s*\{\s*minHeight:\s*48/);
  });
}

test("date-driven planning screens use local calendar dates instead of UTC slicing", () => {
  for (const path of ["app/loans.tsx", "app/subscriptions.tsx", "app/recurring.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.match(source, /todayLocalDate/);
    assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  }
});
