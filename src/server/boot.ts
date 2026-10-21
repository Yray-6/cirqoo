import "server-only";

import postgres from "postgres";
import { assertEnv, migrationUrl } from "@/server/env";
import { migrate } from "@/server/migrate";
import { seed } from "@/server/seed";

function onnotice(notice: { code?: string }) {
  if (notice.code === "42P07") return;
  console.log(notice);
}

export async function boot() {
  assertEnv();
  const sql = postgres(migrationUrl(), { max: 1, onnotice });
  try {
    await sql`SELECT pg_advisory_lock(842154)`;
    await migrate(sql);
    await seed(sql);
  } finally {
    await sql`SELECT pg_advisory_unlock(842154)`;
    await sql.end();
  }
}
