import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("recurring frequency choices stay on one line on narrow screens", () => {
  const source = readFileSync("app/recurring.tsx", "utf8");
  assert.ok(source.includes('numberOfLines={1} style={{color:frequency===v?"#fff":p.text,fontWeight:"700",fontSize:12}}'));
  assert.match(source, /v === "weekly" \? "Week" : v === "monthly" \? "Month" : "Year"/);
});

test("activity log filter chips retain their width and trailing scroll space", () => {
  const source = readFileSync("app/activity-log.tsx", "utf8");
  assert.match(source, /filterRow: \{ flexDirection: "row", gap: 7, paddingRight: 18 \}/);
  assert.match(source, /chip: \{[^}]*flexShrink: 0/);
});
