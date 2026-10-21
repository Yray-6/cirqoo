import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = timestamp("created_at", { withTimezone: true, mode: "date" })
  .notNull()
  .defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull(),
  disabled: boolean("disabled").notNull().default(false),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt,
});

export const events = pgTable("events", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  venue: text("venue").notNull(),
  startsAt: timestamp("starts_at", { withTimezone: true, mode: "date" }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true, mode: "date" }).notNull(),
  status: text("status").notNull(),
  createdAt,
});

export const tiers = pgTable("tiers", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceKobo: integer("price_kobo").notNull(),
  capacity: integer("capacity").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  status: text("status").notNull(),
  subtotalKobo: integer("subtotal_kobo").notNull(),
  feesKobo: integer("fees_kobo").notNull(),
  totalKobo: integer("total_kobo").notNull(),
  discountId: uuid("discount_id"),
  discountKobo: integer("discount_kobo").notNull().default(0),
  idempotencyKey: text("idempotency_key").unique(),
  heldUntil: timestamp("held_until", { withTimezone: true, mode: "date" }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true, mode: "date" }),
  emailError: text("email_error"),
  paymentReference: text("payment_reference").unique(),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }),
  paidKobo: integer("paid_kobo"),
  paymentChannel: text("payment_channel"),
  paymentError: text("payment_error"),
  createdAt,
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey(),
  eventId: uuid("event_id").notNull(),
  tierId: uuid("tier_id").notNull(),
  orderId: uuid("order_id"),
  number: integer("number").notNull(),
  code: text("code").notNull().unique(),
  status: text("status").notNull(),
  heldUntil: timestamp("held_until", { withTimezone: true, mode: "date" }),
  scannedAt: timestamp("scanned_at", { withTimezone: true, mode: "date" }),
});

export const orderRecipients = pgTable("order_recipients", {
  id: uuid("id").primaryKey(),
  orderId: uuid("order_id").notNull(),
  tierId: uuid("tier_id").notNull(),
  position: integer("position").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
});

export const discounts = pgTable("discounts", {
  id: uuid("id").primaryKey(),
  code: text("code").notNull().unique(),
  eventId: uuid("event_id").notNull(),
  cut: text("cut").notNull(),
  percent: integer("percent").notNull().default(0),
  amountKobo: integer("amount_kobo").notNull().default(0),
  usageLimit: integer("usage_limit").notNull(),
  used: integer("used").notNull().default(0),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt,
});

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull(),
  createdAt,
});

export const loginThrottle = pgTable("login_throttle", {
  email: text("email").primaryKey(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "date" }),
});
