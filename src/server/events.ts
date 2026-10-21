import "server-only";

import { randomUUID } from "node:crypto";
import { getDb, getSql } from "@/server/db";
import { HttpError, validEmail } from "@/server/http";
import { insertTickets } from "@/server/inventory";
import { nairaToKobo } from "@/server/money";
import { leads } from "@/server/schema";

export type TierInput = {
  id?: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
};

export type EventInput = {
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: "draft" | "published";
  tiers: TierInput[];
};

function parseEvent(input: EventInput) {
  if (!input || !Array.isArray(input.tiers)) {
    throw new HttpError(400, "Add at least one ticket tier.");
  }
  const title = String(input.title ?? "").trim();
  const venue = String(input.venue ?? "").trim();
  const description = String(input.description ?? "").trim().slice(0, 4000);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  if (!title || title.length > 160 || !venue || venue.length > 200) {
    throw new HttpError(400, "Add a title and a venue.");
  }
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
    throw new HttpError(400, "The end time has to be after the start.");
  }
  if (input.status !== "draft" && input.status !== "published") {
    throw new HttpError(400, "Choose draft or published.");
  }
  if (input.tiers.length < 1 || input.tiers.length > 20) {
    throw new HttpError(400, "Add at least one ticket tier.");
  }
  const parsed = input.tiers.map((tier) => {
    const name = String(tier?.name ?? "").trim();
    const description = String(tier?.description ?? "").trim().slice(0, 400);
    const price = Number(tier?.price);
    const capacity = Number(tier?.capacity);
    if (!name || name.length > 80) throw new HttpError(400, "Every tier needs a name.");
    if (!Number.isInteger(price) || price < 0 || price > 10_000_000) {
      throw new HttpError(400, "Ticket prices are whole naira amounts.");
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 2000) {
      throw new HttpError(400, "Each tier needs between 1 and 2000 tickets.");
    }
    return {
      id: typeof tier.id === "string" ? tier.id : undefined,
      name,
      description,
      price,
      capacity,
    };
  });
  return {
    title,
    description,
    venue,
    startsAt,
    endsAt,
    status: input.status,
    tiers: parsed,
  };
}

export async function createEvent(input: EventInput) {
  const draft = parseEvent(input);
  const eventId = randomUUID();
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO events (id, title, description, venue, starts_at, ends_at, status)
      VALUES (
        ${eventId}, ${draft.title}, ${draft.description}, ${draft.venue},
        ${draft.startsAt.toISOString()}, ${draft.endsAt.toISOString()}, ${draft.status}
      )
    `;
    let number = 0;
    for (const [index, tier] of draft.tiers.entries()) {
      const tierId = randomUUID();
      await tx`
        INSERT INTO tiers (id, event_id, name, description, price_kobo, capacity, sort_order)
        VALUES (
          ${tierId}, ${eventId}, ${tier.name}, ${tier.description},
          ${nairaToKobo(tier.price)}, ${tier.capacity}, ${index}
        )
      `;
      await insertTickets(tx, eventId, tierId, tier.capacity, number + 1);
      number += tier.capacity;
    }
  });
  return eventId;
}

export async function updateEvent(eventId: string, input: EventInput) {
  const draft = parseEvent(input);
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const found = await tx<{ id: string }[]>`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;
    if (!found[0]) throw new HttpError(404, "Event not found.");
    const currentTiers = await tx<{ id: string; name: string }[]>`
      SELECT id, name FROM tiers WHERE event_id = ${eventId}
    `;
    const keptIds = new Set(draft.tiers.map((tier) => tier.id).filter(Boolean));
    for (const tier of currentTiers) {
      if (keptIds.has(tier.id)) continue;
      const [{ count }] = await tx<{ count: string }[]>`
        SELECT COUNT(*)::text AS count FROM tickets
        WHERE tier_id = ${tier.id} AND status <> 'available'
      `;
      if (count !== "0") {
        throw new HttpError(409, `${tier.name} already has sold tickets, so it stays on the event.`);
      }
      await tx`DELETE FROM tickets WHERE tier_id = ${tier.id}`;
      await tx`DELETE FROM tiers WHERE id = ${tier.id}`;
    }

    const [{ max }] = await tx<{ max: number | null }[]>`
      SELECT MAX(number) AS max FROM tickets WHERE event_id = ${eventId}
    `;
    let number = max ?? 0;

    for (const [index, tier] of draft.tiers.entries()) {
      if (!tier.id) {
        const tierId = randomUUID();
        await tx`
          INSERT INTO tiers (id, event_id, name, description, price_kobo, capacity, sort_order)
          VALUES (
            ${tierId}, ${eventId}, ${tier.name}, ${tier.description},
            ${nairaToKobo(tier.price)}, ${tier.capacity}, ${index}
          )
        `;
        await insertTickets(tx, eventId, tierId, tier.capacity, number + 1);
        number += tier.capacity;
        continue;
      }
      const owned = currentTiers.some((item) => item.id === tier.id);
      if (!owned) throw new HttpError(400, "That ticket tier is not on this event.");
      const [{ committed }] = await tx<{ committed: string }[]>`
        SELECT COUNT(*)::text AS committed FROM tickets
        WHERE tier_id = ${tier.id} AND status <> 'available'
      `;
      const committedCount = Number(committed);
      if (tier.capacity < committedCount) {
        throw new HttpError(409, `${tier.name} already has ${committedCount} sold tickets.`);
      }
      const available = await tx<{ id: string }[]>`
        SELECT id FROM tickets WHERE tier_id = ${tier.id} AND status = 'available' ORDER BY number DESC
      `;
      const keepAvailable = tier.capacity - committedCount;
      if (available.length > keepAvailable) {
        const extra = available.slice(0, available.length - keepAvailable).map((row) => row.id);
        await tx`DELETE FROM tickets WHERE id IN ${tx(extra)}`;
      } else if (available.length < keepAvailable) {
        const missing = keepAvailable - available.length;
        await insertTickets(tx, eventId, tier.id, missing, number + 1);
        number += missing;
      }
      await tx`
        UPDATE tiers
        SET name = ${tier.name}, description = ${tier.description},
            price_kobo = ${nairaToKobo(tier.price)}, capacity = ${tier.capacity}, sort_order = ${index}
        WHERE id = ${tier.id}
      `;
    }

    await tx`
      UPDATE events
      SET title = ${draft.title}, description = ${draft.description}, venue = ${draft.venue},
          starts_at = ${draft.startsAt.toISOString()}, ends_at = ${draft.endsAt.toISOString()}, status = ${draft.status}
      WHERE id = ${eventId}
    `;
  });
}

export async function provisionTickets(eventId: string, tierId: string, count: number) {
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new HttpError(400, "Add between 1 and 500 tickets.");
  }
  const sql = getSql();
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${eventId}))`;
    const tier = await tx<{ id: string; capacity: number }[]>`
      SELECT id, capacity FROM tiers WHERE id = ${tierId} AND event_id = ${eventId} FOR UPDATE
    `;
    if (!tier[0]) throw new HttpError(400, "Pick a ticket tier.");
    if (tier[0].capacity + count > 5000) {
      throw new HttpError(400, "That tier would have more than 5000 tickets.");
    }
    const [{ max }] = await tx<{ max: number | null }[]>`
      SELECT MAX(number) AS max FROM tickets WHERE event_id = ${eventId}
    `;
    await insertTickets(tx, eventId, tierId, count, (max ?? 0) + 1);
    await tx`UPDATE tiers SET capacity = capacity + ${count} WHERE id = ${tierId}`;
  });
}

export async function saveLead(email: string, source: "newsletter" | "checkout") {
  const normalized = email.trim().toLowerCase();
  if (!validEmail(normalized)) throw new HttpError(400, "Enter a valid email address.");
  const inserted = await getDb()
    .insert(leads)
    .values({ id: randomUUID(), email: normalized, source })
    .onConflictDoNothing()
    .returning({ id: leads.id });
  if (inserted.length > 0) {
    const { fireAndForget, sendWelcomeEmail } = await import("@/server/mail");
    fireAndForget(sendWelcomeEmail(normalized), "welcome email");
  }
}
