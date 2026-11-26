import type { SQLiteDatabase } from "expo-sqlite";
import type { CsvImportRow, CsvExportRow } from "@/services/csv/transaction-csv";

type ExistingTransactionRow = {
  account_id: string;
  type: "income" | "expense";
  amount_minor: number;
  category_name: string | null;
  description: string;
  occurred_at: string;
};

export function createTransactionCsvRepository(db: SQLiteDatabase) {
  return {
    async listForExport(): Promise<CsvExportRow[]> {
      return db.getAllAsync<CsvExportRow>(
        `SELECT a.name AS accountName, a.currency_code AS currencyCode,
                t.type AS type, t.amount_minor AS amountMinor,
                c.name AS categoryName, t.description AS description,
                t.occurred_at AS occurredAt
         FROM transactions t
         JOIN accounts a ON a.id = t.account_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.deleted_at IS NULL AND t.type IN ('income', 'expense')
         ORDER BY t.occurred_at DESC, t.created_at DESC`,
      );
    },

    async importRows(rows: CsvImportRow[]): Promise<{ imported: number; skippedDuplicates: number }> {
      const accounts = await db.getAllAsync<{
        id: string; name: string; currency_code: string; is_archived: number;
      }>("SELECT id, name, currency_code, is_archived FROM accounts");

      const categories = await db.getAllAsync<{ id: string; name: string; type: string }>(
        "SELECT id, name, type FROM categories",
      );

      const existing = await db.getAllAsync<ExistingTransactionRow>(
        `SELECT t.account_id, t.type, t.amount_minor, c.name AS category_name,
                t.description, t.occurred_at
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.type IN ('income', 'expense')`,
      );

      const accountKey = (name: string, currency: string) =>
        name.trim().toLocaleLowerCase() + "|" + currency.toUpperCase();
      const accountMap = new Map(
        accounts.filter((account) => !account.is_archived).map((account) => [
          accountKey(account.name, account.currency_code),
          account,
        ]),
      );

      const fingerprint = (
        accountId: string,
        type: string,
        amountMinor: number,
        category: string,
        description: string,
        date: string,
      ) => [
        accountId,
        type,
        amountMinor,
        category.trim().toLocaleLowerCase(),
        description.trim().toLocaleLowerCase(),
        date.slice(0, 10),
      ].join("|");

      const seen = new Set<string>();
      for (const row of existing) {
        seen.add(fingerprint(
          row.account_id,
          row.type,
          row.amount_minor,
          row.category_name ?? "",
          row.description ?? "",
          row.occurred_at,
        ));
      }

      const categoryMap = new Map(
        categories.map((category) => [
          category.type + "|" + category.name.trim().toLocaleLowerCase(),
          category.id,
        ]),
      );

      const prepared: {
        accountId: string;
        type: "income" | "expense";
        amountMinor: number;
        categoryName: string;
        categoryKey: string;
        description: string;
        occurredAt: string;
        categoryId: string;
      }[] = [];
      let skippedDuplicates = 0;

      for (const [index, row] of rows.entries()) {
        const account = accountMap.get(accountKey(row.accountName, row.currency));
        if (!account) {
          throw new Error(
            `Row ${index + 2}: active account "${row.accountName}" with currency ${row.currency} was not found. Create or restore it first.`,
          );
        }

        const key = fingerprint(
          account.id,
          row.type,
          row.amountMinor,
          row.category,
          row.description,
          row.occurredAt,
        );
        if (seen.has(key)) {
          skippedDuplicates += 1;
          continue;
        }
        seen.add(key);

        const categoryKey = row.type + "|" + row.category.trim().toLocaleLowerCase();
        let categoryId = categoryMap.get(categoryKey);
        if (!categoryId) {
          categoryId = "cat-import-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
          categoryMap.set(categoryKey, categoryId);
        }

        prepared.push({
          accountId: account.id,
          type: row.type,
          amountMinor: row.amountMinor,
          categoryName: row.category.trim(),
          categoryKey,
          description: row.description.trim(),
          occurredAt: row.occurredAt,
          categoryId,
        });
      }

      if (prepared.length === 0) return { imported: 0, skippedDuplicates };

      const now = new Date().toISOString();
      await db.withTransactionAsync(async () => {
        const insertedCategories = new Set<string>();
        for (const row of prepared) {
          if (insertedCategories.has(row.categoryKey)) continue;
          const exists = await db.getFirstAsync<{ id: string }>(
            "SELECT id FROM categories WHERE type = ? AND lower(name) = lower(?) LIMIT 1",
            row.type, row.categoryName,
          );
          if (!exists) {
            await db.runAsync(
              `INSERT INTO categories (id, name, type, icon, color, is_system, created_at, updated_at)
               VALUES (?, ?, ?, NULL, NULL, 0, ?, ?)`,
              row.categoryId, row.categoryName, row.type, now, now,
            );
          } else {
            row.categoryId = exists.id;
          }
          insertedCategories.add(row.categoryKey);
        }

        for (const row of prepared) {
          const category = await db.getFirstAsync<{ id: string }>(
            "SELECT id FROM categories WHERE type = ? AND lower(name) = lower(?) LIMIT 1",
            row.type, row.categoryName,
          );
          if (!category) throw new Error("Unable to create or locate an imported category.");
          await db.runAsync(
            `INSERT INTO transactions (
              id, account_id, category_id, transfer_group_id, transfer_direction, type,
              amount_minor, description, notes, occurred_at, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, NULL, ?, ?, ?, NULL, ?, ?, ?)`,
            "csv-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9),
            row.accountId, category.id, row.type, row.amountMinor, row.description,
            row.occurredAt, now, now,
          );
        }
      });

      return { imported: prepared.length, skippedDuplicates };
    },
  };
}
