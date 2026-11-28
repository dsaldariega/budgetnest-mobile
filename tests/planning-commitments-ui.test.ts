import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const screens = [
  "app/budgets.tsx",
  "app/goals.tsx",
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


test("Phase 6 uses the stronger BudgetNest red palette and shared spacing contract", () => {
  const colors = readFileSync("src/theme/colors.ts", "utf8");
  const tokens = readFileSync("src/theme/tokens.ts", "utf8");
  assert.match(colors, /primary: "#D32F2F"/);
  assert.match(colors, /primary: "#EF5350"/);
  assert.match(colors, /light:[\s\S]*onPrimary: "#FFFFFF"/);\n  assert.match(colors, /dark:[\s\S]*onPrimary: "#1A1A1A"/);
  assert.match(tokens, /page: 20/);
  assert.match(tokens, /section: 16/);
  assert.match(tokens, /card: 14/);
});

test("Goals is a dedicated root screen reachable from More without becoming a bottom tab", () => {
  const tabs = readFileSync("app/(tabs)/_layout.tsx", "utf8");
  const more = readFileSync("app/(tabs)/more.tsx", "utf8");
  const goals = readFileSync("app/goals.tsx", "utf8");
  assert.doesNotMatch(tabs, /name="goals"/);
  assert.match(more, /label: "Goals"[^\n]*route: "\/goals"/);
  assert.match(goals, /Goals/);
  assert.match(goals, /Create a goal/);
});
