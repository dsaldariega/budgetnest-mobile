import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("dashboard quick actions open the matching transaction form", () => {
  const source = readFileSync("app/(tabs)/transactions.tsx", "utf8");
  assert.match(source, /const openNew = async \(kind: FormKind = "expense"\)/);
  assert.match(source, /if \(quick === "income" \|\| quick === "expense" \|\| quick === "transfer"\)/);
  assert.match(source, /void openNew\(quick\)/);
  assert.match(source, /void loadCategories\(kind\)/);
});
