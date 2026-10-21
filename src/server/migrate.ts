import postgres from "postgres";

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'staff')),
    disabled boolean NOT NULL DEFAULT false,
    must_change_password boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL DEFAULT '',
    venue text NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'published')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tiers (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id),
    name text NOT NULL,
    description text NOT NULL DEFAULT '',
    price_kobo integer NOT NULL CHECK (price_kobo >= 0),
    capacity integer NOT NULL CHECK (capacity >= 0),
    sort_order integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id),
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    status text NOT NULL CHECK (status IN ('held', 'confirmed', 'expired')),
    subtotal_kobo integer NOT NULL CHECK (subtotal_kobo >= 0),
    fees_kobo integer NOT NULL CHECK (fees_kobo >= 0),
    total_kobo integer NOT NULL CHECK (total_kobo >= 0),
    idempotency_key text UNIQUE,
    held_until timestamptz,
    confirmed_at timestamptz,
    email_error text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS tickets (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES events(id),
    tier_id uuid NOT NULL REFERENCES tiers(id),
    order_id uuid REFERENCES orders(id),
    number integer NOT NULL CHECK (number > 0),
    code text NOT NULL UNIQUE,
    status text NOT NULL CHECK (status IN ('available', 'held', 'sold', 'scanned')),
    held_until timestamptz,
    scanned_at timestamptz,
    UNIQUE (event_id, number)
  )`,
  `CREATE INDEX IF NOT EXISTS tickets_allocate_idx ON tickets (tier_id, status, held_until)`,
  `CREATE INDEX IF NOT EXISTS tickets_available_idx ON tickets (tier_id, number) WHERE status = 'available'`,
  `CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at)`,
  `CREATE TABLE IF NOT EXISTS discounts (
    id uuid PRIMARY KEY,
    code text NOT NULL UNIQUE,
    event_id uuid NOT NULL REFERENCES events(id),
    cut text NOT NULL CHECK (cut IN ('percentage', 'fixed')),
    percent integer NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
    amount_kobo integer NOT NULL DEFAULT 0 CHECK (amount_kobo >= 0),
    usage_limit integer NOT NULL CHECK (usage_limit >= 1),
    used integer NOT NULL DEFAULT 0 CHECK (used >= 0 AND used <= usage_limit)
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY,
    email text NOT NULL UNIQUE,
    source text NOT NULL CHECK (source IN ('newsletter', 'checkout')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS login_throttle (
    email text PRIMARY KEY,
    failed_attempts integer NOT NULL DEFAULT 0,
    locked_until timestamptz
  )`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_id uuid REFERENCES discounts(id)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_kobo integer NOT NULL DEFAULT 0 CHECK (discount_kobo >= 0)`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference text UNIQUE`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at timestamptz`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_kobo integer`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_channel text`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_error text`,
  `CREATE TABLE IF NOT EXISTS order_recipients (
    id uuid PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES orders(id),
    tier_id uuid NOT NULL REFERENCES tiers(id),
    position integer NOT NULL CHECK (position >= 0),
    name text NOT NULL,
    email text NOT NULL,
    UNIQUE (order_id, tier_id, position)
  )`,
];

export async function migrate(sql: postgres.Sql) {
  for (const statement of statements) {
    await sql.unsafe(statement);
  }
}
