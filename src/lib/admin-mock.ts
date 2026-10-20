import { naira } from "@/lib/tickets";

export { naira };

export const sampleToday = "2026-10-20T12:00:00.000Z";

export type EventStatus = "draft" | "published";
export type TicketStatus = "unsold" | "sold" | "scanned";

export type AdminTier = {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
};

export type AdminEvent = {
  id: string;
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  tiers: AdminTier[];
};

export type AdminTicket = {
  number: number;
  code: string;
  eventId: string;
  tierId: string;
  tierName: string;
  status: TicketStatus;
  buyerName?: string;
  buyerEmail?: string;
  scannedAt?: string;
};

export type DiscountCut = "percentage" | "fixed";

export type DiscountCode = {
  id: string;
  code: string;
  eventId: string;
  cut: DiscountCut;
  percent: number;
  amount: number;
  usageLimit: number;
  used: number;
};

export type Buyer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventId: string;
  ticketCount: number;
};

export type Lead = {
  id: string;
  email: string;
  source: "newsletter" | "checkout";
  createdAt: string;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type AdminProfile = {
  name: string;
  email: string;
};

export type InflowDay = {
  date: string;
  amount: number;
};

export type TierDraft = {
  id?: string;
  name: string;
  description: string;
  price: number;
  capacity: number;
};

export type EventDraft = {
  title: string;
  description: string;
  venue: string;
  startsAt: string;
  endsAt: string;
  status: EventStatus;
  tiers: TierDraft[];
};

const afterHoursTiers: AdminTier[] = [
  {
    id: "early-bird",
    name: "Solo - Early Bird",
    description: "Get early access to tickets at a ridiculous discount",
    price: 10_000,
    capacity: 1,
  },
  {
    id: "solo",
    name: "Solo",
    description: "Admits One",
    price: 15_000,
    capacity: 10,
  },
];

const listeningTiers: AdminTier[] = [
  {
    id: "listening-general",
    name: "General",
    description: "Admits one",
    price: 8_000,
    capacity: 8,
  },
];

export const initialEvents: AdminEvent[] = [
  {
    id: "after-hours",
    title: "Cirqoo After Hours - Karaoke & Games",
    description:
      "Karaoke, games, and drinks at Halo Lagos. Tickets are non-refundable and valid only for this edition.",
    venue: "Halo Lagos, Lekki",
    startsAt: "2026-11-06T18:00:00.000Z",
    endsAt: "2026-11-06T23:00:00.000Z",
    status: "published",
    tiers: afterHoursTiers,
  },
  {
    id: "listening-room",
    title: "Cirqoo Listening Room",
    description: "A quieter afternoon set. Still a draft.",
    venue: "Halo Lagos, Lekki",
    startsAt: "2026-11-21T16:00:00.000Z",
    endsAt: "2026-11-21T20:00:00.000Z",
    status: "draft",
    tiers: listeningTiers,
  },
];

function ticket(
  number: number,
  code: string,
  eventId: string,
  tierId: string,
  tierName: string,
  status: TicketStatus,
  buyerName?: string,
  buyerEmail?: string,
  scannedAt?: string,
): AdminTicket {
  return {
    number,
    code,
    eventId,
    tierId,
    tierName,
    status,
    buyerName,
    buyerEmail,
    scannedAt,
  };
}

export const initialTickets: AdminTicket[] = [
  ticket(1, "CRQ-OPEN01", "after-hours", "early-bird", "Solo - Early Bird", "sold", "Ada Okonkwo", "ada@example.com"),
  ticket(2, "CRQ-OPEN02", "after-hours", "solo", "Solo", "sold", "Chioma Eze", "chioma@example.com"),
  ticket(3, "CRQ-OPEN03", "after-hours", "solo", "Solo", "sold", "Chioma Eze", "chioma@example.com"),
  ticket(
    4,
    "CRQ-USED01",
    "after-hours",
    "solo",
    "Solo",
    "scanned",
    "Tunde Bakare",
    "tunde@example.com",
    "2026-11-06T18:42:00.000Z",
  ),
  ...["CRQ-FREE01", "CRQ-FREE02", "CRQ-FREE03", "CRQ-FREE04", "CRQ-FREE05", "CRQ-FREE06", "CRQ-FREE07"].map(
    (code, index) => ticket(index + 5, code, "after-hours", "solo", "Solo", "unsold"),
  ),
  ...["CRQ-ROOM01", "CRQ-ROOM02", "CRQ-ROOM03", "CRQ-ROOM04", "CRQ-ROOM05", "CRQ-ROOM06", "CRQ-ROOM07", "CRQ-ROOM08"].map(
    (code, index) => ticket(index + 1, code, "listening-room", "listening-general", "General", "unsold"),
  ),
];

export const initialDiscounts: DiscountCode[] = [
  {
    id: "early10",
    code: "EARLY10",
    eventId: "after-hours",
    cut: "percentage",
    percent: 10,
    amount: 0,
    usageLimit: 20,
    used: 4,
  },
  {
    id: "friends",
    code: "FRIENDS",
    eventId: "after-hours",
    cut: "fixed",
    percent: 0,
    amount: 2_000,
    usageLimit: 5,
    used: 1,
  },
];

export function describeCut(discount: DiscountCode) {
  return discount.cut === "percentage" ? `${discount.percent}% off` : `${naira(discount.amount)} off`;
}

export function ticketLabel(number: number) {
  return `#${String(number).padStart(2, "0")}`;
}

export const buyers: Buyer[] = [
  {
    id: "ada",
    name: "Ada Okonkwo",
    email: "ada@example.com",
    phone: "08031234567",
    eventId: "after-hours",
    ticketCount: 1,
  },
  {
    id: "chioma",
    name: "Chioma Eze",
    email: "chioma@example.com",
    phone: "08039876543",
    eventId: "after-hours",
    ticketCount: 2,
  },
  {
    id: "tunde",
    name: "Tunde Bakare",
    email: "tunde@example.com",
    phone: "08160001122",
    eventId: "after-hours",
    ticketCount: 1,
  },
];

export const leads: Lead[] = [
  {
    id: "lead-amaka",
    email: "amaka@example.com",
    source: "newsletter",
    createdAt: "2026-10-02T09:12:00.000Z",
  },
  {
    id: "lead-seun",
    email: "seun@example.com",
    source: "newsletter",
    createdAt: "2026-10-11T14:40:00.000Z",
  },
  {
    id: "lead-lola",
    email: "lola@example.com",
    source: "checkout",
    createdAt: "2026-10-18T19:05:00.000Z",
  },
];

export const initialAnnouncements: Announcement[] = [
  {
    id: "doors",
    title: "Doors open at 6",
    body: "Share this with the door team: capacity is limited and tickets may not be available at the door.",
    createdAt: "2026-10-16T10:00:00.000Z",
  },
];

export const initialProfile: AdminProfile = {
  name: "Cirqoo Admin",
  email: "admin@cirqoo.test",
};

export const inflowDays: InflowDay[] = Array.from({ length: 30 }, (_, index) => {
  const day = new Date(Date.UTC(2026, 9, 20));
  day.setUTCDate(day.getUTCDate() - (29 - index));
  const dateNumber = day.getUTCDate();
  const amount = dateNumber % 4 === 0 ? 0 : ((dateNumber * 17) % 8 + 1) * 10_000;
  return { date: day.toISOString().slice(0, 10), amount };
});

export function eventCapacity(event: AdminEvent) {
  return event.tiers.reduce((sum, tier) => sum + tier.capacity, 0);
}

export function eventSold(eventId: string, tickets: AdminTicket[]) {
  return tickets.filter((ticket) => ticket.eventId === eventId && ticket.status !== "unsold").length;
}

export function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function utcDayKey(iso: string) {
  return iso.slice(0, 10);
}

export function toUtcInput(iso: string) {
  return iso.slice(0, 16);
}

export function fromUtcInput(value: string) {
  return `${value}:00.000Z`;
}
