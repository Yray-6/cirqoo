import "server-only";

import postgres from "postgres";
import { assertEnv, migrationUrl } from "@/server/env";
import { migrate } from "@/server/migrate";
import { seed } from "@/server/seed";

export async function boot() {
  assertEnv();
  const sql = postgres(migrationUrl(), { max: 1 });
  try {
    await sql`SELECT pg_advisory_lock(842154)`;
    await migrate(sql);
    await seed(sql);
  } finally {
    await sql`SELECT pg_advisory_unlock(842154)`;
    await sql.end();
  }
}
