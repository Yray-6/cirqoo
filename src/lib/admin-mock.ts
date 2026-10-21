import { naira } from "@/lib/tickets";

export { naira };

export type EventStatus = "draft" | "published";
export type TicketStatus = "unsold" | "held" | "sold" | "scanned";
export type UserRole = "admin" | "staff";

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
  sold: number;
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
  scannedAt?: string;
  discountCode?: string;
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
  role: UserRole;
  mustChangePassword: boolean;
};

export type AdminOrder = {
  id: string;
  eventId: string;
  buyerName: string;
  email: string;
  phone: string;
  status: "held" | "confirmed" | "expired";
  total: number;
  heldUntil: string | null;
  emailError: string | null;
  ticketCount: number;
};

export type StaffAccount = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  disabled: boolean;
  mustChangePassword: boolean;
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

export function describeCut(discount: DiscountCode) {
  return discount.cut === "percentage" ? `${discount.percent}% off` : `${naira(discount.amount)} off`;
}

export function ticketLabel(number: number) {
  return `#${String(number).padStart(2, "0")}`;
}

export function eventCapacity(event: AdminEvent) {
  return event.tiers.reduce((sum, tier) => sum + tier.capacity, 0);
}

export function eventSold(event: AdminEvent) {
  return event.sold;
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
