"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  buyers,
  inflowDays,
  initialAnnouncements,
  initialDiscounts,
  initialEvents,
  initialProfile,
  initialTickets,
  leads,
  type AdminEvent,
  type AdminProfile,
  type AdminTicket,
  type Announcement,
  type DiscountCode,
  type DiscountCut,
  type EventDraft,
  type TierDraft,
} from "@/lib/admin-mock";

export type ScanResult =
  | { type: "unknown" }
  | { type: "unsold"; ticket: AdminTicket }
  | { type: "already"; ticket: AdminTicket }
  | { type: "used"; ticket: AdminTicket };

export type DiscountDraft = {
  code: string;
  eventId: string;
  cut: DiscountCut;
  percent: number;
  amount: number;
  usageLimit: number;
};

type AdminStore = {
  events: AdminEvent[];
  tickets: AdminTicket[];
  discounts: DiscountCode[];
  announcements: Announcement[];
  profile: AdminProfile;
  buyers: typeof buyers;
  leads: typeof leads;
  inflowDays: typeof inflowDays;
  createEvent: (draft: EventDraft) => void;
  updateEvent: (id: string, draft: EventDraft) => string | null;
  provisionTickets: (eventId: string, tierId: string, count: number) => string | null;
  scan: (code: string) => ScanResult;
  addDiscount: (draft: DiscountDraft) => string | null;
  redeemDiscount: (id: string) => string | null;
  addAnnouncement: (title: string, body: string) => void;
  updateProfile: (name: string) => void;
};

const AdminStoreContext = createContext<AdminStore | null>(null);

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newId() {
  return crypto.randomUUID();
}

function newCode(used: Set<string>) {
  let code = "";
  do {
    code = "CRQ-";
    for (let index = 0; index < 6; index += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  } while (used.has(code));
  used.add(code);
  return code;
}

function blankTicket(
  eventId: string,
  tier: TierDraft & { id: string },
  used: Set<string>,
  number: number,
): AdminTicket {
  return {
    number,
    code: newCode(used),
    eventId,
    tierId: tier.id,
    tierName: tier.name.trim(),
    status: "unsold",
  };
}

function nextTicketNumber(rows: AdminTicket[], eventId: string) {
  return rows
    .filter((item) => item.eventId === eventId)
    .reduce((max, item) => Math.max(max, item.number), 0);
}

export function AdminStoreProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState(initialEvents);
  const [tickets, setTickets] = useState(initialTickets);
  const [discounts, setDiscounts] = useState(initialDiscounts);
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [profile, setProfile] = useState(initialProfile);

  const store = useMemo<AdminStore>(() => {
    return {
      events,
      tickets,
      discounts,
      announcements,
      profile,
      buyers,
      leads,
      inflowDays,
      createEvent(draft) {
        const id = newId();
        const used = new Set(tickets.map((item) => item.code));
        const tiers = draft.tiers.map((tier) => ({
          id: newId(),
          name: tier.name.trim(),
          description: tier.description.trim(),
          price: tier.price,
          capacity: tier.capacity,
        }));
        let number = 0;
        const created = tiers.flatMap((tier) =>
          Array.from({ length: tier.capacity }, () => {
            number += 1;
            return blankTicket(id, tier, used, number);
          }),
        );
        setEvents((current) => [
          {
            id,
            title: draft.title.trim(),
            description: draft.description.trim(),
            venue: draft.venue.trim(),
            startsAt: draft.startsAt,
            endsAt: draft.endsAt,
            status: draft.status,
            tiers,
          },
          ...current,
        ]);
        setTickets((current) => [...created, ...current]);
      },
      updateEvent(id, draft) {
        const event = events.find((item) => item.id === id);
        if (!event) return "Event not found.";

        const owned = tickets.filter((item) => item.eventId === id);
        const removed = event.tiers.filter(
          (tier) => !draft.tiers.some((item) => item.id === tier.id),
        );
        for (const tier of removed) {
          const committed = owned.filter(
            (item) => item.tierId === tier.id && item.status !== "unsold",
          );
          if (committed.length > 0) {
            return `${tier.name} already has sold tickets, so it stays on the event.`;
          }
        }

        for (const tier of draft.tiers) {
          if (!tier.id) continue;
          const committed = owned.filter(
            (item) => item.tierId === tier.id && item.status !== "unsold",
          );
          if (tier.capacity < committed.length) {
            return `${tier.name} already has ${committed.length} sold tickets.`;
          }
        }

        const used = new Set(tickets.map((item) => item.code));
        const nextTiers = draft.tiers.map((tier) => ({
          id: tier.id ?? newId(),
          name: tier.name.trim(),
          description: tier.description.trim(),
          price: tier.price,
          capacity: tier.capacity,
        }));
        const kept: AdminTicket[] = [];
        let number = nextTicketNumber(owned, id);

        for (const tier of nextTiers) {
          const existing = owned.filter((item) => item.tierId === tier.id);
          const committed = existing
            .filter((item) => item.status !== "unsold")
            .map((item) => ({ ...item, tierName: tier.name }));
          const unsold = existing
            .filter((item) => item.status === "unsold")
            .slice(0, Math.max(tier.capacity - committed.length, 0))
            .map((item) => ({ ...item, tierName: tier.name }));
          const missing = tier.capacity - committed.length - unsold.length;
          const added = Array.from({ length: missing }, () => {
            number += 1;
            return blankTicket(id, tier, used, number);
          });
          kept.push(...committed, ...unsold, ...added);
        }

        setTickets((current) => [
          ...current.filter((item) => item.eventId !== id),
          ...kept,
        ]);
        setEvents((current) =>
          current.map((item) =>
            item.id === id
              ? {
                  ...item,
                  title: draft.title.trim(),
                  description: draft.description.trim(),
                  venue: draft.venue.trim(),
                  startsAt: draft.startsAt,
                  endsAt: draft.endsAt,
                  status: draft.status,
                  tiers: nextTiers,
                }
              : item,
          ),
        );
        return null;
      },
      provisionTickets(eventId, tierId, count) {
        const event = events.find((item) => item.id === eventId);
        const tier = event?.tiers.find((item) => item.id === tierId);
        if (!event || !tier) return "Pick a ticket tier.";
        if (!Number.isInteger(count) || count < 1 || count > 500) {
          return "Add between 1 and 500 tickets.";
        }
        const used = new Set(tickets.map((item) => item.code));
        let number = nextTicketNumber(tickets, eventId);
        const added = Array.from({ length: count }, () => {
          number += 1;
          return blankTicket(eventId, tier, used, number);
        });
        setTickets((current) => [...current, ...added]);
        setEvents((current) =>
          current.map((item) =>
            item.id === eventId
              ? {
                  ...item,
                  tiers: item.tiers.map((itemTier) =>
                    itemTier.id === tierId
                      ? { ...itemTier, capacity: itemTier.capacity + count }
                      : itemTier,
                  ),
                }
              : item,
          ),
        );
        return null;
      },
      scan(raw) {
        const code = raw.trim().toUpperCase();
        const ticket = tickets.find((item) => item.code === code);
        if (!ticket) return { type: "unknown" };
        if (ticket.status === "unsold") return { type: "unsold", ticket };
        if (ticket.status === "scanned") return { type: "already", ticket };
        const scannedAt = new Date().toISOString();
        const next = { ...ticket, status: "scanned" as const, scannedAt };
        setTickets((current) =>
          current.map((item) => (item.code === code ? next : item)),
        );
        return { type: "used", ticket: next };
      },
      addDiscount(draft) {
        const code = draft.code.trim().toUpperCase();
        if (!/^[A-Z0-9-]{4,16}$/.test(code)) {
          return "Use 4 to 16 letters or numbers.";
        }
        if (discounts.some((item) => item.code === code)) return "That code already exists.";
        if (!events.some((item) => item.id === draft.eventId)) return "Pick an event.";
        if (!Number.isInteger(draft.usageLimit) || draft.usageLimit < 1) {
          return "Set how many times the code can be used.";
        }
        if (draft.cut === "percentage" && (!Number.isInteger(draft.percent) || draft.percent < 1 || draft.percent > 100)) {
          return "Percentage cut is a whole number from 1 to 100.";
        }
        if (draft.cut === "fixed" && (!Number.isInteger(draft.amount) || draft.amount < 1)) {
          return "Fixed amount is a whole naira value.";
        }
        setDiscounts((current) => [
          {
            id: newId(),
            code,
            eventId: draft.eventId,
            cut: draft.cut,
            percent: draft.cut === "percentage" ? draft.percent : 0,
            amount: draft.cut === "fixed" ? draft.amount : 0,
            usageLimit: draft.usageLimit,
            used: 0,
          },
          ...current,
        ]);
        return null;
      },
      redeemDiscount(id) {
        const discount = discounts.find((item) => item.id === id);
        if (!discount) return "Code not found.";
        if (discount.used >= discount.usageLimit) return "This code has no uses left.";
        setDiscounts((current) =>
          current.map((item) => (item.id === id ? { ...item, used: item.used + 1 } : item)),
        );
        return null;
      },
      addAnnouncement(title, body) {
        setAnnouncements((current) => [
          {
            id: newId(),
            title: title.trim(),
            body: body.trim(),
            createdAt: new Date().toISOString(),
          },
          ...current,
        ]);
      },
      updateProfile(name) {
        setProfile((current) => ({ ...current, name: name.trim() }));
      },
    };
  }, [announcements, discounts, events, profile, tickets]);

  return <AdminStoreContext.Provider value={store}>{children}</AdminStoreContext.Provider>;
}

export function useAdminStore() {
  const store = useContext(AdminStoreContext);
  if (!store) throw new Error("Admin store is missing.");
  return store;
}
