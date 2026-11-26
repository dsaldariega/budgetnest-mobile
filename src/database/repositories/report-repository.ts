import type { SQLiteDatabase } from "expo-sqlite";
export type ReportCurrencySummary = { currencyCode:string; incomeMinor:number; expenseMinor:number; netMinor:number };
export type ReportCategoryTotal = { currencyCode:string; categoryName:string; amountMinor:number; transactionCount:number };
export type ReportMonthTotal = { month:string; currencyCode:string; incomeMinor:number; expenseMinor:number };
export function createReportRepository(db:SQLiteDatabase){
 return {
  async summary(fromDate:string,toDate:string):Promise<ReportCurrencySummary[]>{
   const rows=await db.getAllAsync<{currency_code:string;income_minor:number;expense_minor:number}>(
    `SELECT a.currency_code,
      COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_minor ELSE 0 END),0) income_minor,
      COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_minor ELSE 0 END),0) expense_minor
     FROM transactions t JOIN accounts a ON a.id=t.account_id
     WHERE t.deleted_at IS NULL AND t.type IN ('income','expense') AND t.occurred_at>=? AND t.occurred_at<=?
     GROUP BY a.currency_code ORDER BY a.currency_code`,fromDate,toDate);
   return rows.map(r=>({currencyCode:r.currency_code,incomeMinor:r.income_minor,expenseMinor:r.expense_minor,netMinor:r.income_minor-r.expense_minor}));
  },
  async expensesByCategory(fromDate:string,toDate:string):Promise<ReportCategoryTotal[]>{
   return db.getAllAsync<ReportCategoryTotal>(
    `SELECT a.currency_code AS currencyCode,COALESCE(c.name,'Uncategorized') AS categoryName,
      SUM(t.amount_minor) AS amountMinor,COUNT(*) AS transactionCount
     FROM transactions t JOIN accounts a ON a.id=t.account_id
     LEFT JOIN categories c ON c.id=t.category_id
     WHERE t.deleted_at IS NULL AND t.type='expense' AND t.occurred_at>=? AND t.occurred_at<=?
     GROUP BY a.currency_code,c.name ORDER BY a.currency_code,amountMinor DESC`,fromDate,toDate);
  },
  async monthlyTrend(fromDate:string,toDate:string):Promise<ReportMonthTotal[]>{
   return db.getAllAsync<ReportMonthTotal>(
    `SELECT substr(t.occurred_at,1,7) AS month,a.currency_code AS currencyCode,
      COALESCE(SUM(CASE WHEN t.type='income' THEN t.amount_minor ELSE 0 END),0) AS incomeMinor,
      COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount_minor ELSE 0 END),0) AS expenseMinor
     FROM transactions t JOIN accounts a ON a.id=t.account_id
     WHERE t.deleted_at IS NULL AND t.type IN ('income','expense') AND t.occurred_at>=? AND t.occurred_at<=?
     GROUP BY substr(t.occurred_at,1,7),a.currency_code ORDER BY month ASC,a.currency_code ASC`,fromDate,toDate);
  }
 };
}
