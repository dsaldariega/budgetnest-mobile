import type { SQLiteDatabase } from "expo-sqlite";
import { advanceBillingDate, type BillingCycle } from "@/domain/subscriptions";
import { assertPositiveMinorUnits } from "@/domain/money";
import { compareDates } from "@/domain/dates";

export type SubscriptionListItem = {
  id: string; name: string; amountMinor: number; billingCycle: BillingCycle;
  nextBillingDate: string; accountId: string | null; accountName: string | null;
  categoryId: string | null; categoryName: string | null; currencyCode: string;
  isActive: boolean; paymentCount: number; createdAt: string; updatedAt: string;
};

export type SubscriptionPaymentListItem = {
  id: string; amountMinor: number; billingDate: string; paidAt: string;
  notes: string | null; createdAt: string;
};

export type CreateSubscriptionInput = {
  id: string; name: string; amountMinor: number; billingCycle: BillingCycle;
  nextBillingDate: string; accountId?: string | null; categoryId?: string | null;
};

export type RecordSubscriptionPaymentInput = {
  id: string; subscriptionId: string; amountMinor: number; notes?: string | null;
};

async function getSubscriptionRow(db: SQLiteDatabase, id: string) {
  return db.getFirstAsync<{
    id: string; name: string; amount_minor: number; billing_cycle: BillingCycle;
    next_billing_date: string | null; account_id: string | null; category_id: string | null;
    is_active: number;
  }>("SELECT * FROM subscriptions WHERE id = ?", id);
}

export function createSubscriptionRepository(db: SQLiteDatabase) {
  async function list(): Promise<SubscriptionListItem[]> {
    const rows = await db.getAllAsync<{
      id: string; name: string; amount_minor: number; billing_cycle: BillingCycle;
      next_billing_date: string | null; account_id: string | null; account_name: string | null;
      category_id: string | null; category_name: string | null; currency_code: string;
      is_active: number; payment_count: number; created_at: string; updated_at: string;
    }>(
      "SELECT s.*, a.name AS account_name, c.name AS category_name, " +
      "COALESCE(a.currency_code, 'PHP') AS currency_code, " +
      "(SELECT COUNT(*) FROM subscription_payments sp WHERE sp.subscription_id = s.id) AS payment_count " +
      "FROM subscriptions s LEFT JOIN accounts a ON a.id = s.account_id " +
      "LEFT JOIN categories c ON c.id = s.category_id " +
      "ORDER BY s.is_active DESC, s.next_billing_date ASC, s.name COLLATE NOCASE ASC",
    );
    return rows.map(row => ({
      id: row.id, name: row.name, amountMinor: row.amount_minor, billingCycle: row.billing_cycle,
      nextBillingDate: row.next_billing_date ?? "", accountId: row.account_id, accountName: row.account_name,
      categoryId: row.category_id, categoryName: row.category_name, currencyCode: row.currency_code,
      isActive: row.is_active === 1, paymentCount: row.payment_count,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
  }

  async function listPayments(subscriptionId: string): Promise<SubscriptionPaymentListItem[]> {
    return db.getAllAsync<SubscriptionPaymentListItem>(
      "SELECT id, amount_minor AS amountMinor, billing_date AS billingDate, paid_at AS paidAt, notes, created_at AS createdAt " +
      "FROM subscription_payments WHERE subscription_id = ? ORDER BY billing_date DESC, created_at DESC",
      subscriptionId,
    );
  }

  return {
    list,
    listPayments,

    async create(input: CreateSubscriptionInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      if (!input.name.trim()) throw new Error("Enter a subscription name.");
      compareDates(input.nextBillingDate, input.nextBillingDate);

      if (input.accountId) {
        const account = await db.getFirstAsync<{ is_archived: number }>(
          "SELECT is_archived FROM accounts WHERE id = ?", input.accountId,
        );
        if (!account || account.is_archived) throw new Error("Choose an active account.");
      }
      if (input.categoryId) {
        const category = await db.getFirstAsync<{ type: string }>(
          "SELECT type FROM categories WHERE id = ?", input.categoryId,
        );
        if (!category || category.type !== "expense") throw new Error("Choose an expense category.");
      }

      const now = new Date().toISOString();
      await db.runAsync(
        "INSERT INTO subscriptions " +
        "(id, name, amount_minor, billing_cycle, next_billing_date, account_id, category_id, is_active, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
        input.id, input.name.trim(), input.amountMinor, input.billingCycle, input.nextBillingDate,
        input.accountId ?? null, input.categoryId ?? null, now, now,
      );
    },

    async recordPayment(input: RecordSubscriptionPaymentInput): Promise<void> {
      assertPositiveMinorUnits(input.amountMinor);
      const subscription = await getSubscriptionRow(db, input.subscriptionId);
      if (!subscription) throw new Error("Subscription was not found.");
      if (!subscription.is_active) throw new Error("Resume the subscription before recording a payment.");
      if (!subscription.next_billing_date) throw new Error("This subscription has no next billing date.");

      const nextBillingDate = advanceBillingDate(subscription.next_billing_date, subscription.billing_cycle);
      const now = new Date().toISOString();

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          "INSERT INTO subscription_payments " +
          "(id, subscription_id, amount_minor, billing_date, paid_at, notes, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
          input.id, input.subscriptionId, input.amountMinor, subscription.next_billing_date,
          now, input.notes?.trim() || null, now,
        );
        await db.runAsync(
          "UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ?",
          nextBillingDate, now, input.subscriptionId,
        );
        await db.runAsync(
          "INSERT INTO activity_logs " +
          "(id, entity_type, entity_id, action, summary, metadata_json, created_at) " +
          "VALUES (?, 'subscription_payment', ?, 'created', ?, ?, ?)",
          "activity-" + input.id, input.subscriptionId,
          "Recorded subscription payment",
          JSON.stringify({ amountMinor: input.amountMinor, billingDate: subscription.next_billing_date }),
          now,
        );
      });
    },

    async deletePayment(id: string): Promise<void> {
      const payment = await db.getFirstAsync<{
        subscription_id: string; billing_date: string; billing_cycle: BillingCycle;
      }>(
        "SELECT sp.subscription_id, sp.billing_date, s.billing_cycle " +
        "FROM subscription_payments sp JOIN subscriptions s ON s.id = sp.subscription_id WHERE sp.id = ?",
        id,
      );
      if (!payment) throw new Error("Payment was not found.");

      const subscription = await getSubscriptionRow(db, payment.subscription_id);
      if (!subscription) throw new Error("Subscription was not found.");

      const immediateNextDate = advanceBillingDate(payment.billing_date, payment.billing_cycle);
      const shouldRollback = subscription.next_billing_date === immediateNextDate;
      const now = new Date().toISOString();

      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM subscription_payments WHERE id = ?", id);
        if (shouldRollback) {
          await db.runAsync(
            "UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ?",
            payment.billing_date, now, payment.subscription_id,
          );
        }
      });
    },

    async pause(id: string): Promise<void> {
      const result = await db.runAsync(
        "UPDATE subscriptions SET is_active = 0, updated_at = ? WHERE id = ? AND is_active = 1",
        new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Only an active subscription can be paused.");
    },

    async resume(id: string): Promise<void> {
      const result = await db.runAsync(
        "UPDATE subscriptions SET is_active = 1, updated_at = ? WHERE id = ? AND is_active = 0",
        new Date().toISOString(), id,
      );
      if (result.changes === 0) throw new Error("Only a paused subscription can be resumed.");
    },

    async delete(id: string): Promise<void> {
      const subscription = await getSubscriptionRow(db, id);
      if (!subscription) throw new Error("Subscription was not found.");
      await db.withTransactionAsync(async () => {
        await db.runAsync("DELETE FROM subscription_payments WHERE subscription_id = ?", id);
        const result = await db.runAsync("DELETE FROM subscriptions WHERE id = ?", id);
        if (result.changes === 0) throw new Error("Subscription was not found.");
      });
    },
  };
}
