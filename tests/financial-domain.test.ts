import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  calculateAccountBalance,
  assertTransferAllowed,
} from "../src/domain/accounts";
import {
  toMinorUnits,
  fromMinorUnits,
  assertPositiveMinorUnits,
} from "../src/domain/money";
import {
  addDays,
  addMonthsClamped,
  compareDates,
  daysInMonth,
} from "../src/domain/dates";
import {
  allocateLoanPayment,
  calculateLoanSummary,
} from "../src/domain/loans";
import {
  advanceRecurringDate,
  getDueRecurringDates,
} from "../src/domain/recurring";

describe("money domain", () => {
  it("converts major units to minor units without floating point drift", () => {
    assert.equal(toMinorUnits(10.01), 1001);
    assert.equal(toMinorUnits(0.1 + 0.2), 30);
    assert.equal(fromMinorUnits(12345), 123.45);
  });

  it("rejects invalid monetary values", () => {
    assert.throws(() => toMinorUnits(Number.NaN), /finite number/);
    assert.throws(() => assertPositiveMinorUnits(0), /positive/);
    assert.throws(() => assertPositiveMinorUnits(-1), /positive/);
    assert.throws(() => assertPositiveMinorUnits(1.5), /positive whole number/);
  });
});

describe("account balance domain", () => {
  it("calculates balance from opening balance and financial entries", () => {
    const balance = calculateAccountBalance(10_000, [
      { type: "income", amountMinor: 5_000 },
      { type: "expense", amountMinor: 2_000 },
      { type: "transfer", amountMinor: 1_500, transferDirection: "out" },
      { type: "transfer", amountMinor: 750, transferDirection: "in" },
    ]);

    assert.equal(balance, 12_250);
  });

  it("ignores soft-deleted entries", () => {
    const balance = calculateAccountBalance(10_000, [
      { type: "expense", amountMinor: 2_000, deletedAt: "2026-01-02T00:00:00.000Z" },
      { type: "income", amountMinor: 500 },
    ]);

    assert.equal(balance, 10_500);
  });

  it("rejects malformed transfer entries", () => {
    assert.throws(
      () => calculateAccountBalance(10_000, [
        { type: "transfer", amountMinor: 1_000 },
      ]),
      /direction/,
    );
  });
});

describe("transfer rules", () => {
  const baseTransfer = {
    sourceAccountId: "account-a",
    destinationAccountId: "account-b",
    sourceCurrency: "PHP",
    destinationCurrency: "PHP",
  };

  it("allows transfers between distinct active accounts in the same currency", () => {
    assert.doesNotThrow(() => assertTransferAllowed(baseTransfer));
  });

  it("rejects self-transfers, currency mismatches, and archived accounts", () => {
    assert.throws(
      () => assertTransferAllowed({
        ...baseTransfer,
        destinationAccountId: "account-a",
      }),
      /different/,
    );

    assert.throws(
      () => assertTransferAllowed({
        ...baseTransfer,
        destinationCurrency: "USD",
      }),
      /different currencies/,
    );

    assert.throws(
      () => assertTransferAllowed({
        ...baseTransfer,
        sourceArchived: true,
      }),
      /Archived accounts/,
    );
  });
});

describe("calendar domain", () => {
  it("handles month boundaries and leap years", () => {
    assert.equal(addDays("2026-01-31", 1), "2026-02-01");
    assert.equal(addMonthsClamped("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
    assert.equal(daysInMonth("2024-02-01"), 29);
    assert.equal(compareDates("2026-03-01", "2026-02-28"), 1);
    assert.equal(compareDates("2026-02-28", "2026-02-28"), 0);
  });

  it("rejects invalid calendar dates", () => {
    assert.throws(() => addDays("2026-02-30", 1), /Invalid calendar date/);
    assert.throws(() => addMonthsClamped("not-a-date", 1), /Invalid calendar date/);
  });
});

describe("flat-rate loans", () => {
  const terms = {
    principalMinor: 100_000,
    monthlyRateBps: 100,
    termMonths: 10,
    interestType: "flat_rate" as const,
  };

  it("calculates total interest and scheduled payment", () => {
    const summary = calculateLoanSummary(terms, "2026-01-31");

    assert.equal(summary.totalInterestMinor, 10_000);
    assert.equal(summary.totalPayableMinor, 110_000);
    assert.equal(summary.scheduledPaymentMinor, 11_000);
    assert.equal(summary.dueDate, "2026-11-30");
  });

  it("allocates a regular payment to interest then principal", () => {
    const allocation = allocateLoanPayment({
      terms,
      previousPaymentDate: "2026-01-31",
      payment: { amountMinor: 11_000, paymentDate: "2026-02-28" },
      remainingPrincipalMinor: 100_000,
      remainingInterestMinor: 10_000,
    });

    assert.equal(allocation.interestPaidMinor, 1_000);
    assert.equal(allocation.principalPaidMinor, 10_000);
    assert.equal(allocation.remainingInterestMinor, 9_000);
    assert.equal(allocation.remainingPrincipalMinor, 90_000);
  });

  it("rejects payments that exceed the remaining obligation", () => {
    assert.throws(
      () => allocateLoanPayment({
        terms,
        previousPaymentDate: "2026-01-31",
        payment: { amountMinor: 110_001, paymentDate: "2026-02-28" },
        remainingPrincipalMinor: 100_000,
        remainingInterestMinor: 10_000,
      }),
      /exceeds the remaining loan obligation/,
    );
  });
});

describe("recurring dates", () => {
  it("advances weekly, monthly, and yearly schedules", () => {
    assert.equal(advanceRecurringDate("2026-01-31", "weekly"), "2026-02-07");
    assert.equal(advanceRecurringDate("2026-01-31", "monthly"), "2026-02-28");
    assert.equal(advanceRecurringDate("2024-02-29", "yearly"), "2025-02-28");
  });

  it("generates due dates without exceeding the requested range", () => {
    assert.deepEqual(
      getDueRecurringDates({
        nextOccurrenceDate: "2026-01-01",
        frequency: "monthly",
        intervalCount: 1,
        throughDate: "2026-04-15",
      }),
      ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"],
    );
  });

  it("respects an end date", () => {
    assert.deepEqual(
      getDueRecurringDates({
        nextOccurrenceDate: "2026-01-01",
        frequency: "monthly",
        intervalCount: 1,
        throughDate: "2026-12-31",
        endDate: "2026-03-01",
      }),
      ["2026-01-01", "2026-02-01", "2026-03-01"],
    );
  });


  it("supports interval schedules and stops at the configured end date", () => {
    assert.deepEqual(
      getDueRecurringDates({
        nextOccurrenceDate: "2026-01-01",
        frequency: "weekly",
        intervalCount: 2,
        throughDate: "2026-02-01",
        endDate: "2026-01-29",
      }),
      ["2026-01-01", "2026-01-15", "2026-01-29"],
    );
  });

  it("rejects an occurrence batch that exceeds its safety limit", () => {
    assert.throws(
      () => getDueRecurringDates({
        nextOccurrenceDate: "2026-01-01",
        frequency: "weekly",
        intervalCount: 1,
        throughDate: "2026-12-31",
        maxOccurrences: 2,
      }),
      /Too many recurring entries/,
    );
  });

  it("handles elapsed end dates and rejects invalid occurrence limits", () => {
    assert.deepEqual(
      getDueRecurringDates({
        nextOccurrenceDate: "2026-03-01",
        frequency: "monthly",
        intervalCount: 1,
        throughDate: "2026-04-01",
        endDate: "2026-02-28",
      }),
      [],
    );
    assert.throws(
      () => getDueRecurringDates({
        nextOccurrenceDate: "2026-01-01",
        frequency: "monthly",
        intervalCount: 1,
        throughDate: "2026-02-01",
        maxOccurrences: 0,
      }),
      /Occurrence limit is invalid/,
    );
  });

  it("rejects invalid occurrence intervals", () => {
    assert.throws(
      () => advanceRecurringDate("2026-01-01", "monthly", 0),
      /between 1 and 120/,
    );
  });
});
