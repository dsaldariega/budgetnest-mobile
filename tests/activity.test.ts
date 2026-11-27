import assert from "node:assert/strict";
import test from "node:test";
import { activityActionLabel, activityEntityLabel, activityIconName } from "@/domain/activity";

test("activity log uses readable action labels", () => {
  assert.equal(activityActionLabel("account.created"), "Created an account");
  assert.equal(activityActionLabel("loan.payment_recorded"), "Recorded a loan payment");
});

test("activity log has readable entity names and icons", () => {
  assert.equal(activityEntityLabel("recurring"), "Recurring schedule");
  assert.equal(activityIconName("subscription"), "calendar-clock");
  assert.equal(activityIconName("unknown"), "history");
});
