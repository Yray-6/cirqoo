import "server-only";

import { getSql } from "@/server/db";
import { releaseExpired } from "@/server/inventory";
import { koboToNaira } from "@/server/money";
import { iso } from "@/server/time";

export type PublicCatalog = {
  id: string;
  title: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  soldOut: boolean;
  tiers: Array<{
    id: string;
    name: string;
    description: string;
    price: number;
    remaining: number;
  }>;
};

export async function getCatalog(): Promise<PublicCatalog | null> {
  const sql = getSql();
  return sql.begin(async (tx) => {
    await releaseExpired(tx);
    const events = await tx<{ id: string; title: string; venue: string; starts_at: Date; ends_at: Date }[]>`
      SELECT id, title, venue, starts_at, ends_at
      FROM events
      WHERE status = 'published'
      ORDER BY starts_at ASC
      LIMIT 1
    `;
    const event = events[0];
    if (!event) return null;
    const tiers = await tx<
      { id: string; name: string; description: string; price_kobo: number; remaining: number }[]
    >`
      SELECT tiers.id, tiers.name, tiers.description, tiers.price_kobo,
        COUNT(tickets.id) FILTER (WHERE tickets.status = 'available')::int AS remaining
      FROM tiers
      LEFT JOIN tickets ON tickets.tier_id = tiers.id
      WHERE tiers.event_id = ${event.id}
      GROUP BY tiers.id
      ORDER BY tiers.sort_order
    `;
    const view = tiers.map((tier) => ({
      id: tier.id,
      name: tier.name,
      description: tier.description,
      price: koboToNaira(tier.price_kobo),
      remaining: Number(tier.remaining),
    }));
    return {
      id: event.id,
      title: event.title,
      venue: event.venue,
      startsAt: iso(event.starts_at) ?? "",
      endsAt: iso(event.ends_at) ?? "",
      soldOut: view.every((tier) => tier.remaining < 1),
      tiers: view,
    };
  });
}
