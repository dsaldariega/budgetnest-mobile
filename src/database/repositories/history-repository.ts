import type { SQLiteDatabase } from "expo-sqlite";

export type HistoryKind = "income" | "expense" | "transfer" | "loan" | "subscription" | "savings";

export type HistoryItem = {
  id: string;
  kind: HistoryKind;
  title: string;
  subtitle: string;
  amountMinor: number;
  currencyCode: string;
  occurredAt: string;
  accountName: string | null;
  categoryName: string | null;
  notes: string | null;
  interestPaidMinor: number | null;
  principalPaidMinor: number | null;
};

type HistoryRow = {
  id: string;
  kind: HistoryKind;
  title: string;
  subtitle: string;
  amount_minor: number;
  currency_code: string;
  occurred_at: string;
  account_name: string | null;
  category_name: string | null;
  notes: string | null;
  interest_paid_minor: number | null;
  principal_paid_minor: number | null;
};

export type HistoryFilter = "all" | HistoryKind;

export function createHistoryRepository(db: SQLiteDatabase) {
  const sql = `
    SELECT *
    FROM (
      SELECT
        t.id,
        t.type AS kind,
        CASE
          WHEN t.type = 'income' THEN COALESCE(NULLIF(t.description, ''), c.name, 'Income')
          ELSE COALESCE(NULLIF(t.description, ''), c.name, 'Expense')
        END AS title,
        CASE
          WHEN t.type = 'transfer' THEN 'Transfer'
          ELSE COALESCE(c.name, t.type)
        END AS subtitle,
        t.amount_minor,
        a.currency_code,
        t.occurred_at,
        a.name AS account_name,
        c.name AS category_name,
        t.notes,
        NULL AS interest_paid_minor,
        NULL AS principal_paid_minor
      FROM transactions t
      JOIN accounts a ON a.id = t.account_id
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.deleted_at IS NULL AND t.type IN ('income', 'expense')

      UNION ALL

      SELECT
        t.transfer_group_id AS id,
        'transfer' AS kind,
        COALESCE(NULLIF(t.description, ''), 'Transfer') AS title,
        'To ' || COALESCE(destination.name, 'another account') AS subtitle,
        t.amount_minor,
        source.currency_code,
        t.occurred_at,
        source.name AS account_name,
        NULL AS category_name,
        t.notes,
        NULL AS interest_paid_minor,
        NULL AS principal_paid_minor
      FROM transactions t
      JOIN accounts source ON source.id = t.account_id
      LEFT JOIN transactions incoming
        ON incoming.transfer_group_id = t.transfer_group_id
        AND incoming.transfer_direction = 'in'
        AND incoming.deleted_at IS NULL
      LEFT JOIN accounts destination ON destination.id = incoming.account_id
      WHERE t.deleted_at IS NULL
        AND t.type = 'transfer'
        AND t.transfer_direction = 'out'

      UNION ALL

      SELECT
        lp.id,
        'loan' AS kind,
        COALESCE(NULLIF(l.name, ''), 'Loan payment') AS title,
        'Loan payment' AS subtitle,
        lp.amount_minor,
        COALESCE(a.currency_code, 'PHP') AS currency_code,
        lp.payment_date AS occurred_at,
        a.name AS account_name,
        NULL AS category_name,
        lp.notes,
        lp.interest_paid_minor,
        lp.principal_paid_minor
      FROM loan_payments lp
      JOIN loans l ON l.id = lp.loan_id
      LEFT JOIN accounts a ON a.id = l.account_id

      UNION ALL

      SELECT
        sp.id,
        'subscription' AS kind,
        COALESCE(NULLIF(s.name, ''), 'Subscription payment') AS title,
        'Subscription payment' AS subtitle,
        sp.amount_minor,
        COALESCE(a.currency_code, 'PHP') AS currency_code,
        sp.billing_date AS occurred_at,
        a.name AS account_name,
        c.name AS category_name,
        sp.notes,
        NULL AS interest_paid_minor,
        NULL AS principal_paid_minor
      FROM subscription_payments sp
      JOIN subscriptions s ON s.id = sp.subscription_id
      LEFT JOIN accounts a ON a.id = s.account_id
      LEFT JOIN categories c ON c.id = s.category_id

      UNION ALL

      SELECT
        gc.id,
        'savings' AS kind,
        COALESCE(NULLIF(g.name, ''), 'Savings contribution') AS title,
        'Savings contribution' AS subtitle,
        gc.amount_minor,
        a.currency_code,
        gc.contributed_at AS occurred_at,
        a.name AS account_name,
        NULL AS category_name,
        gc.note AS notes,
        NULL AS interest_paid_minor,
        NULL AS principal_paid_minor
      FROM goal_contributions gc
      JOIN savings_goals g ON g.id = gc.goal_id
      JOIN accounts a ON a.id = g.account_id
    )
    WHERE 1 = 1
  `;

  return {
    async list(options: {
      filter?: HistoryFilter;
      search?: string;
      fromDate?: string;
      toDate?: string;
      limit?: number;
      accountName?: string;
      categoryName?: string;
    } = {}): Promise<HistoryItem[]> {
      const conditions: string[] = [];
      const values: (string | number)[] = [];

      if (options.filter && options.filter !== "all") {
        conditions.push("kind = ?");
        values.push(options.filter);
      }
      if (options.search?.trim()) {
        conditions.push("(title LIKE ? OR subtitle LIKE ? OR account_name LIKE ? OR category_name LIKE ?)");
        const term = "%" + options.search.trim() + "%";
        values.push(term, term, term, term);
      }
      if (options.accountName?.trim()) { conditions.push("account_name LIKE ?"); values.push("%" + options.accountName.trim() + "%"); }
      if (options.categoryName?.trim()) { conditions.push("category_name LIKE ?"); values.push("%" + options.categoryName.trim() + "%"); }
      if (options.fromDate) {
        conditions.push("occurred_at >= ?");
        values.push(options.fromDate);
      }
      if (options.toDate) {
        conditions.push("occurred_at <= ?");
        values.push(options.toDate);
      }

      const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 200), 500));
      const where = conditions.length ? " AND " + conditions.join(" AND ") : "";

      return db.getAllAsync<HistoryRow>(
        sql + where + " ORDER BY occurred_at DESC, id DESC LIMIT ?",
        ...values,
        limit,
      ).then(rows => rows.map(row => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        subtitle: row.subtitle,
        amountMinor: row.amount_minor,
        currencyCode: row.currency_code,
        occurredAt: row.occurred_at,
        accountName: row.account_name,
        categoryName: row.category_name,
        notes: row.notes,
        interestPaidMinor: row.interest_paid_minor,
        principalPaidMinor: row.principal_paid_minor,
      })));
    },
  };
}
