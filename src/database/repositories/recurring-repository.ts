import type { SQLiteDatabase } from "expo-sqlite";
import { assertPositiveMinorUnits } from "@/domain/money";
import { compareDates } from "@/domain/dates";
import { advanceRecurringDate, getDueRecurringDates, type RecurringFrequency } from "@/domain/recurring";
export type RecurringRule = {
  id: string; name: string; type: "income" | "expense"; amountMinor: number; accountId: string;
  accountName: string; currencyCode: string; categoryId: string; categoryName: string;
  frequency: RecurringFrequency; intervalCount: number; startDate: string; nextOccurrenceDate: string;
  endDate: string | null; isActive: boolean; generatedCount: number;
};
export type SaveRecurringRuleInput = {
  id: string; name: string; type: "income" | "expense"; amountMinor: number; accountId: string;
  categoryId: string; frequency: RecurringFrequency; intervalCount: number; startDate: string; endDate?: string | null;
};
type RuleRow = {
  id: string; name: string; type: "income" | "expense"; amount_minor: number; account_id: string;
  account_name: string; currency_code: string; category_id: string; category_name: string;
  frequency: RecurringFrequency; interval_count: number; start_date: string; next_occurrence_date: string;
  end_date: string | null; is_active: number; generated_count: number;
};
function mapRule(r: RuleRow): RecurringRule {
  return { id:r.id,name:r.name,type:r.type,amountMinor:r.amount_minor,accountId:r.account_id,accountName:r.account_name,
    currencyCode:r.currency_code,categoryId:r.category_id,categoryName:r.category_name,frequency:r.frequency,
    intervalCount:r.interval_count,startDate:r.start_date,nextOccurrenceDate:r.next_occurrence_date,
    endDate:r.end_date,isActive:r.is_active===1,generatedCount:r.generated_count };
}
export function createRecurringRepository(db: SQLiteDatabase) {
  const selectSql = `SELECT r.*, a.name AS account_name, a.currency_code, c.name AS category_name,
    (SELECT COUNT(*) FROM transactions t WHERE t.recurring_rule_id=r.id AND t.deleted_at IS NULL) AS generated_count
    FROM recurring_rules r JOIN accounts a ON a.id=r.account_id JOIN categories c ON c.id=r.category_id`;
  return {
    async list(): Promise<RecurringRule[]> {
      return (await db.getAllAsync<RuleRow>(selectSql+" ORDER BY r.is_active DESC,r.next_occurrence_date ASC,r.name COLLATE NOCASE")).map(mapRule);
    },
    async save(input: SaveRecurringRuleInput): Promise<void> {
      const name=input.name.trim(); if(!name) throw new Error("Enter a name for this recurring item.");
      assertPositiveMinorUnits(input.amountMinor);
      if(!Number.isInteger(input.intervalCount)||input.intervalCount<1||input.intervalCount>120) throw new Error("Repeat interval must be between 1 and 120.");
      compareDates(input.startDate,input.startDate);
      if(input.endDate && compareDates(input.endDate,input.startDate)<0) throw new Error("End date cannot be before the start date.");
      const [account,category,existing]=await Promise.all([
        db.getFirstAsync<{is_archived:number}>("SELECT is_archived FROM accounts WHERE id=?",input.accountId),
        db.getFirstAsync<{type:string}>("SELECT type FROM categories WHERE id=?",input.categoryId),
        db.getFirstAsync<{id:string;next_occurrence_date:string;generated_count:number}>(
          "SELECT r.id,r.next_occurrence_date,(SELECT COUNT(*) FROM transactions t WHERE t.recurring_rule_id=r.id) AS generated_count FROM recurring_rules r WHERE r.id=?",input.id),
      ]);
      if(!account||account.is_archived) throw new Error("Choose an active account.");
      if(!category||category.type!==input.type) throw new Error("Choose a category that matches the income or expense type.");
      const now=new Date().toISOString();
      if(existing) {
        const next=existing.generated_count>0?existing.next_occurrence_date:input.startDate;
        if(input.endDate&&compareDates(next,input.endDate)>0) throw new Error("The next scheduled date is after the selected end date.");
        await db.runAsync("UPDATE recurring_rules SET name=?,type=?,amount_minor=?,account_id=?,category_id=?,frequency=?,interval_count=?,start_date=?,next_occurrence_date=?,end_date=?,updated_at=? WHERE id=?",
          name,input.type,input.amountMinor,input.accountId,input.categoryId,input.frequency,input.intervalCount,input.startDate,next,input.endDate??null,now,input.id);
      } else {
        await db.runAsync("INSERT INTO recurring_rules (id,name,type,amount_minor,account_id,category_id,frequency,interval_count,start_date,next_occurrence_date,end_date,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?,?)",
          input.id,name,input.type,input.amountMinor,input.accountId,input.categoryId,input.frequency,input.intervalCount,input.startDate,input.startDate,input.endDate??null,now,now);
      }
    },
    async setActive(id:string,active:boolean):Promise<void> {
      const result=await db.runAsync("UPDATE recurring_rules SET is_active=?,updated_at=? WHERE id=?",active?1:0,new Date().toISOString(),id);
      if(result.changes===0) throw new Error("Recurring schedule was not found.");
    },
    async delete(id:string):Promise<void> {
      const result=await db.runAsync("DELETE FROM recurring_rules WHERE id=?",id);
      if(result.changes===0) throw new Error("Recurring schedule was not found.");
    },
    async generateDue(throughDate:string):Promise<{generatedCount:number;skippedCount:number}> {
      compareDates(throughDate,throughDate);
      let generatedCount=0,skippedCount=0;
      await db.withTransactionAsync(async()=>{
        const rules=await db.getAllAsync<{id:string;name:string;type:"income"|"expense";amount_minor:number;account_id:string;category_id:string;frequency:RecurringFrequency;interval_count:number;next_occurrence_date:string;end_date:string|null}>(
          "SELECT id,name,type,amount_minor,account_id,category_id,frequency,interval_count,next_occurrence_date,end_date FROM recurring_rules WHERE is_active=1 ORDER BY next_occurrence_date ASC");
        const now=new Date().toISOString();
        for(const rule of rules) {
          const dates=getDueRecurringDates({nextOccurrenceDate:rule.next_occurrence_date,frequency:rule.frequency,intervalCount:rule.interval_count,throughDate,endDate:rule.end_date,maxOccurrences:500});
          if(!dates.length) {
            if(rule.end_date&&compareDates(rule.next_occurrence_date,rule.end_date)>0) await db.runAsync("UPDATE recurring_rules SET is_active=0,updated_at=? WHERE id=?",now,rule.id);
            continue;
          }
          const account=await db.getFirstAsync<{is_archived:number}>("SELECT is_archived FROM accounts WHERE id=?",rule.account_id);
          if(!account||account.is_archived) throw new Error("A recurring schedule uses an archived or missing account. Update the schedule before generating entries.");
          const category=await db.getFirstAsync<{type:string}>("SELECT type FROM categories WHERE id=?",rule.category_id);
          if(!category||category.type!==rule.type) throw new Error("A recurring schedule has an invalid category. Update the schedule before generating entries.");
          for(const occurrenceDate of dates) {
            const id="recurring-"+rule.id+"-"+occurrenceDate;
            const result=await db.runAsync(
              "INSERT OR IGNORE INTO transactions (id,account_id,category_id,transfer_group_id,transfer_direction,type,amount_minor,description,notes,occurred_at,created_at,updated_at,recurring_rule_id,recurring_occurrence_date) VALUES (?,?,?,NULL,NULL,?,?,?,?,?,?,?,?,?)",
              id,rule.account_id,rule.category_id,rule.type,rule.amount_minor,rule.name,"Generated from recurring schedule",occurrenceDate,now,now,rule.id,occurrenceDate);
            if(result.changes>0) generatedCount++; else skippedCount++;
          }
          const next=advanceRecurringDate(dates[dates.length-1],rule.frequency,rule.interval_count);
          const complete=rule.end_date&&compareDates(next,rule.end_date)>0;
          await db.runAsync("UPDATE recurring_rules SET next_occurrence_date=?,is_active=?,updated_at=? WHERE id=?",next,complete?0:1,now,rule.id);
        }
      });
      return {generatedCount,skippedCount};
    },
  };
}
