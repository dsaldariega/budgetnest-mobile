import type { SQLiteDatabase } from "expo-sqlite";
import { allocateLoanPayment, calculateLoanSummary, type LoanInterestType } from "@/domain/loans";
import { assertPositiveMinorUnits } from "@/domain/money";
import { addMonthsClamped, compareDates } from "@/domain/dates";

export type LoanListItem = {
  id: string; name: string; principalMinor: number; monthlyInterestRateBps: number;
  interestType: LoanInterestType; termMonths: number; startDate: string; dueDate: string;
  status: "active" | "paid" | "paused"; accountId: string | null; accountName: string | null;
  currencyCode: string; notes: string | null; totalInterestMinor: number; totalPayableMinor: number;
  scheduledPaymentMinor: number; paidMinor: number; remainingMinor: number;
};

export type LoanPaymentListItem = {
  id: string; amountMinor: number; interestPaidMinor: number; principalPaidMinor: number;
  paymentDate: string; notes: string | null; createdAt: string;
};

export type CreateLoanInput = {
  id: string; name: string; principalMinor: number; monthlyInterestRateBps: number;
  interestType: LoanInterestType; termMonths: number; startDate: string;
  accountId?: string | null; notes?: string | null;
};

export type CreateLoanPaymentInput = {
  id: string; loanId: string; amountMinor: number; paymentDate: string; notes?: string | null;
};

export function createLoanRepository(db: SQLiteDatabase) {
  async function getLoanRow(id: string) {
    return db.getFirstAsync<{
      id: string; name: string; principal_minor: number; monthly_interest_rate_bps: number;
      interest_type: LoanInterestType; term_months: number; start_date: string; due_date: string;
      status: "active" | "paid" | "paused"; account_id: string | null; account_name: string | null;
      currency_code: string; notes: string | null;
    }>(
      "SELECT l.*, a.name AS account_name, COALESCE(a.currency_code, 'PHP') AS currency_code " +
      "FROM loans l LEFT JOIN accounts a ON a.id = l.account_id WHERE l.id = ?",
      id,
    );
  }

  async function calculateRemaining(loanId: string) {
    const loan = await getLoanRow(loanId);
    if (!loan) throw new Error("Loan was not found.");
    const terms = {
      principalMinor: loan.principal_minor,
      monthlyRateBps: loan.monthly_interest_rate_bps,
      termMonths: loan.term_months,
      interestType: loan.interest_type,
    };
    const summary = calculateLoanSummary(terms, loan.start_date);
    const payments = await db.getAllAsync<{ amount_minor: number; payment_date: string; created_at: string }>(
      "SELECT amount_minor, payment_date, created_at FROM loan_payments WHERE loan_id = ? ORDER BY payment_date ASC, created_at ASC",
      loanId,
    );
    let remainingPrincipalMinor = loan.principal_minor;
    let remainingInterestMinor = summary.totalInterestMinor;
    let previousPaymentDate = loan.start_date;
    let paidMinor = 0;

    for (const payment of payments) {
      const allocation = allocateLoanPayment({
        terms,
        previousPaymentDate,
        payment: { amountMinor: payment.amount_minor, paymentDate: payment.payment_date },
        remainingPrincipalMinor,
        remainingInterestMinor,
      });
      remainingPrincipalMinor = allocation.remainingPrincipalMinor;
      remainingInterestMinor = allocation.remainingInterestMinor;
      previousPaymentDate = payment.payment_date;
      paidMinor += payment.amount_minor;
    }
    return { summary, paidMinor, remainingPrincipalMinor, remainingInterestMinor, previousPaymentDate };
  }

  async function list(): Promise<LoanListItem[]> {
    const rows = await db.getAllAsync<{
      id: string; name: string; principal_minor: number; monthly_interest_rate_bps: number;
      interest_type: LoanInterestType; term_months: number; start_date: string; due_date: string;
      status: "active" | "paid" | "paused"; account_id: string | null; account_name: string | null;
      currency_code: string; notes: string | null;
    }>(
      "SELECT l.*, a.name AS account_name, COALESCE(a.currency_code, 'PHP') AS currency_code " +
      "FROM loans l LEFT JOIN accounts a ON a.id = l.account_id " +
      "ORDER BY CASE l.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, l.due_date ASC",
    );
    return Promise.all(rows.map(async row => {
      const summary = calculateLoanSummary({
        principalMinor: row.principal_minor,
        monthlyRateBps: row.monthly_interest_rate_bps,
        termMonths: row.term_months,
        interestType: row.interest_type,
      }, row.start_date);
      const remaining = await calculateRemaining(row.id);
      return {
        id: row.id, name: row.name, principalMinor: row.principal_minor,
        monthlyInterestRateBps: row.monthly_interest_rate_bps, interestType: row.interest_type,
        termMonths: row.term_months, startDate: row.start_date, dueDate: row.due_date,
        status: row.status, accountId: row.account_id, accountName: row.account_name,
        currencyCode: row.currency_code, notes: row.notes, totalInterestMinor: summary.totalInterestMinor,
        totalPayableMinor: summary.totalPayableMinor, scheduledPaymentMinor: summary.scheduledPaymentMinor,
        paidMinor: remaining.paidMinor, remainingMinor: remaining.remainingPrincipalMinor + remaining.remainingInterestMinor,
      };
    }));
  }

  async function listPayments(loanId: string): Promise<LoanPaymentListItem[]> {
    return db.getAllAsync<LoanPaymentListItem>(
      "SELECT id, amount_minor AS amountMinor, interest_paid_minor AS interestPaidMinor, " +
      "principal_paid_minor AS principalPaidMinor, payment_date AS paymentDate, notes, created_at AS createdAt " +
      "FROM loan_payments WHERE loan_id = ? ORDER BY payment_date DESC, created_at DESC",
      loanId,
    );
  }

  return {
    list,
    listPayments,
    async create(input: CreateLoanInput): Promise<void> {
      assertPositiveMinorUnits(input.principalMinor);
      if (!input.name.trim()) throw new Error("Enter a loan name.");
      if (!Number.isSafeInteger(input.monthlyInterestRateBps) || input.monthlyInterestRateBps < 0) throw new Error("Enter a valid interest rate.");
      if (!Number.isInteger(input.termMonths) || input.termMonths <= 0) throw new Error("Term must be a positive number of months.");
      compareDates(input.startDate, input.startDate);
      const dueDate = addMonthsClamped(input.startDate, input.termMonths);
      if (input.accountId) {
        const account = await db.getFirstAsync<{ is_archived: number }>("SELECT is_archived FROM accounts WHERE id = ?", input.accountId);
        if (!account || account.is_archived) throw new Error("Choose an active account.");
      }
      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO loans (id, name, principal_minor, monthly_interest_rate_bps, interest_type, term_months, start_date, due_date, status, account_id, notes, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)",
        input.id, input.name.trim(), input.principalMinor, input.monthlyInterestRateBps, input.interestType,
        input.termMonths, input.startDate, dueDate, input.accountId ?? null, input.notes?.trim() || null, now, now,
      );
    },
    async recordPayment(input: CreateLoanPaymentInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      compareDates(input.paymentDate, input.paymentDate);
      const loan = await getLoanRow(input.loanId);
      if (!loan) throw new Error("Loan was not found.");
      if (loan.status === "paid") throw new Error("This loan is already paid.");
      const state = await calculateRemaining(input.loanId);
      const allocation = allocateLoanPayment({
        terms: {
          principalMinor: loan.principal_minor,
          monthlyRateBps: loan.monthly_interest_rate_bps,
          termMonths: loan.term_months,
          interestType: loan.interest_type,
        },
        previousPaymentDate: state.previousPaymentDate,
        payment: { amountMinor: input.amountMinor, paymentDate: input.paymentDate },
        remainingPrincipalMinor: state.remainingPrincipalMinor,
        remainingInterestMinor: state.remainingInterestMinor,
      });
      const nextStatus = allocation.remainingPrincipalMinor === 0 && allocation.remainingInterestMinor === 0 ? "paid" : loan.status;
      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "INSERT INTO loan_payments (id, loan_id, amount_minor, interest_paid_minor, principal_paid_minor, payment_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          input.id, input.loanId, input.amountMinor, allocation.interestPaidMinor,
          allocation.principalPaidMinor, input.paymentDate, input.notes?.trim() || null, now,
        );
        await db.runAsync("UPDATE loans SET status = ?, updated_at = ? WHERE id = ?", nextStatus, now, input.loanId);
        await db.runAsync(
          "INSERT INTO activity_logs (id, entity_type, entity_id, action, summary, metadata_json, created_at) VALUES (?, 'loan_payment', ?, 'created', ?, ?, ?)",
          "activity-" + input.id, input.loanId,
          "Recorded loan payment of " + input.amountMinor + " minor units",
          JSON.stringify({ interestPaidMinor: allocation.interestPaidMinor, principalPaidMinor: allocation.principalPaidMinor }),
          now,
        );
      });
    },
    async pause(id: string): Promise<void> {
      const result = await db.runAsync("UPDATE loans SET status = 'paused', updated_at = ? WHERE id = ? AND status = 'active'", new Date().toISOString(), id);
      if (result.changes === 0) throw new Error("Only an active loan can be paused.");
    },
    async resume(id: string): Promise<void> {
      const result = await db.runAsync("UPDATE loans SET status = 'active', updated_at = ? WHERE id = ? AND status = 'paused'", new Date().toISOString(), id);
      if (result.changes === 0) throw new Error("Only a paused loan can be resumed.");
    },
  };
}
