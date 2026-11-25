import type { PropsWithChildren } from "react";
import { SQLiteProvider } from "expo-sqlite";
import { migrateDatabase } from "@/database/migrations";

export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider
      databaseName="budgetnest.db"
      onInit={migrateDatabase}
    >
      {children}
    </SQLiteProvider>
  );
}
