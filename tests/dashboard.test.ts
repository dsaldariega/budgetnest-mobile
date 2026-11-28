import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard query results are destructured in the same order as its four queries", () => {
  const source = readFileSync("app/(tabs)/index.tsx", "utf8");
  assert.match(
    source,
    /const\s+\[accounts,\s*budgets,\s*activity,\s*monthlyRows\]\s*=\s*await\s+Promise\.all\s*\(\s*\[/,
  );
  assert.doesNotMatch(source, /\[accounts,\s*budgets,\s*goals,\s*subscriptions,\s*loans,\s*activity,\s*monthlyRows\]/);
});