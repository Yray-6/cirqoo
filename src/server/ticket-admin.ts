import "server-only";

import { getSql } from "@/server/db";
import { HttpError } from "@/server/http";

export async function deleteTickets(
  eventId: string,
  input: { code?: string; allUnsold?: boolean },
) {
  const code = input.code?.trim() ?? "";
  const allUnsold = input.allUnsold === true;
  if (!eventId) throw new HttpError(400, "Pick an event.");
  if (allUnsold === Boolean(code)) {
    throw new HttpError(400, allUnsold ? "Delete one ticket or all unsold tickets." : "Choose a ticket to delete.");
  }
  if (code && !/^CRQ-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(code)) {
    throw new HttpError(400, "That ticket code is not valid.");
  }

  const sql = getSql();
  return sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const event = await tx<{ id: string }[]>`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;
    if (!event[0]) throw new HttpError(404, "Event not found.");

    const removed = allUnsold
      ? await tx<{ tier_id: string }[]>`
          DELETE FROM tickets
          WHERE event_id = ${eventId} AND status = 'available'
          RETURNING tier_id
        `
      : await tx<{ tier_id: string }[]>`
          DELETE FROM tickets
          WHERE event_id = ${eventId} AND code = ${code} AND status = 'available'
          RETURNING tier_id
        `;

    if (!allUnsold && removed.length === 0) {
      const existing = await tx<{ status: string }[]>`
        SELECT status FROM tickets WHERE event_id = ${eventId} AND code = ${code}
      `;
      if (!existing[0]) throw new HttpError(404, "Ticket not found.");
      throw new HttpError(409, "Only unsold tickets can be deleted.");
    }

    const byTier = new Map<string, number>();
    for (const row of removed) byTier.set(row.tier_id, (byTier.get(row.tier_id) ?? 0) + 1);
    for (const [tierId, count] of byTier) {
      const updated = await tx<{ id: string }[]>`
        UPDATE tiers
        SET capacity = capacity - ${count}
        WHERE id = ${tierId} AND event_id = ${eventId} AND capacity >= ${count}
        RETURNING id
      `;
      if (!updated[0]) throw new HttpError(409, "Those tickets could not be removed.");
    }
    return removed.length;
  });
}
