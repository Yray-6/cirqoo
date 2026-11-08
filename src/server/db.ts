import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl, poolMax } from "@/server/env";
import * as schema from "@/server/schema";

const globalForDb = globalThis as {
  openTicketsSql?: ReturnType<typeof postgres>;
};

export function getSql() {
  if (!globalForDb.openTicketsSql) {
    globalForDb.openTicketsSql = postgres(databaseUrl(), { max: poolMax() });
  }
  return globalForDb.openTicketsSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Tx = postgres.TransactionSql<Record<string, never>>;
