import "server-only";

import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { acceptablePassword, hashPassword } from "@/server/password";
import { nairaToKobo, newTicketCode } from "@/server/money";

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

  const [{ count: eventCount }] = await sql<{ count: string }[]>`SELECT COUNT(*)::text AS count FROM events`;
  if (eventCount !== "0") return;

  const eventId = randomUUID();
  const earlyId = randomUUID();
  const soloId = randomUUID();
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO events (id, title, description, venue, starts_at, ends_at, status)
      VALUES (
        ${eventId},
        ${"Cirqoo After Hours - Karaoke & Games"},
        ${"Karaoke, games, and drinks at Halo Lagos. Tickets are non-refundable and valid only for this edition."},
        ${"Halo Lagos, Lekki"},
        ${"2026-11-06T18:00:00.000Z"},
        ${"2026-11-06T23:00:00.000Z"},
        ${"published"}
      )
    `;
    await tx`
      INSERT INTO tiers (id, event_id, name, description, price_kobo, capacity, sort_order)
      VALUES
        (${earlyId}, ${eventId}, ${"Solo - Early Bird"}, ${"Get early access to tickets at a ridiculous discount"}, ${nairaToKobo(10_000)}, 1, 0),
        (${soloId}, ${eventId}, ${"Solo"}, ${"Admits One"}, ${nairaToKobo(15_000)}, 10, 1)
    `;
    const rows = [
      { tierId: earlyId, count: 1 },
      { tierId: soloId, count: 10 },
    ];
    let number = 0;
    for (const row of rows) {
      for (let index = 0; index < row.count; index += 1) {
        number += 1;
        await tx`
          INSERT INTO tickets (id, event_id, tier_id, number, code, status)
          VALUES (${randomUUID()}, ${eventId}, ${row.tierId}, ${number}, ${newTicketCode()}, ${"available"})
        `;
      }
    }
  });
}
