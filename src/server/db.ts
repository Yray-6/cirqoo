import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl, poolMax } from "@/server/env";
import * as schema from "@/server/schema";

const globalForDb = globalThis as {
  cirqooSql?: ReturnType<typeof postgres>;
};

export function getSql() {
  if (!globalForDb.cirqooSql) {
    globalForDb.cirqooSql = postgres(databaseUrl(), { max: poolMax() });
  }
  return globalForDb.cirqooSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Tx = postgres.TransactionSql<Record<string, never>>;
