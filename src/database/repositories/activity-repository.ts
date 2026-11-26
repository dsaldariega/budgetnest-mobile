import type { SQLiteDatabase } from "expo-sqlite";

export type ActivityEntityFilter =
  | "all"
  | "account"
  | "transaction"
  | "budget"
  | "goal"
  | "loan"
  | "subscription"
  | "recurring";

export type ActivityPeriod = "7" | "30" | "90" | "365" | "all";

export type ActivityLogItem = {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  summary: string;
  createdAt: string;
};

type ActivityLogRow = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action: string;
  summary: string;
  created_at: string;
};

export function createActivityRepository(db: SQLiteDatabase) {
  return {
    async list(options: {
      entityType?: ActivityEntityFilter;
      period?: ActivityPeriod;
      limit?: number;
    } = {}): Promise<ActivityLogItem[]> {
      const conditions: string[] = [];
      const values: (string | number)[] = [];

      if (options.entityType && options.entityType !== "all") {
        conditions.push("entity_type = ?");
        values.push(options.entityType);
      }
      if (options.period && options.period !== "all") {
        const since = new Date();
        since.setDate(since.getDate() - Number(options.period));
        conditions.push("created_at >= ?");
        values.push(since.toISOString());
      }

      const limit = Math.max(1, Math.min(Math.trunc(options.limit ?? 500), 500));
      const where = conditions.length ? " WHERE " + conditions.join(" AND ") : "";
      const rows = await db.getAllAsync<ActivityLogRow>(
        "SELECT id, entity_type, entity_id, action, summary, created_at " +
          "FROM activity_logs" + where +
          " ORDER BY created_at DESC, id DESC LIMIT ?",
        ...values,
        limit,
      );

      return rows.map((row) => ({
        id: row.id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        action: row.action,
        summary: row.summary,
        createdAt: row.created_at,
      }));
    },

    async countToday(): Promise<number> {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const row = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) AS count FROM activity_logs WHERE created_at >= ? AND created_at < ?",
        start,
        end,
      );
      return row?.count ?? 0;
    },
  };
}
