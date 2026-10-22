import "server-only";

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { acceptablePassword, hashPassword } from "@/server/password";

type Sql = postgres.Sql;

export async function seed(sql: Sql) {
  const [{ count: userCount }] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM users`;
  if (userCount === "0") {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (!email || !password) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required to create the first admin.");
    }
    if (!acceptablePassword(password)) {
      throw new Error("ADMIN_PASSWORD must be 10 to 200 characters.");
    }
    await sql`
      INSERT INTO users (id, name, email, password_hash, role, disabled, must_change_password)
      VALUES (
        ${randomUUID()},
        ${"Cirqoo Admin"},
        ${email},
        ${await hashPassword(password)},
        ${"admin"},
        false,
        false
      )
    `;
  }
}
