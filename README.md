# Open Tickets

An event ticketing app built with Next.js. Guests can browse a published event, hold seats, pay with Paystack, and receive QR tickets by email. Staff can manage events, scan tickets, send reminders, and handle discounts from an admin panel.

## Features

- Public event page and multi-step checkout
- Inventory holds with timed release
- Paystack payments and webhook confirmation
- Transactional email (tickets, receipts, welcome, reminders) via Resend
- Admin login, event CRUD, ticket scanning, staff, discounts, and subscribers

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

Copy [`.env.example`](.env.example) and fill in values for your own Postgres database, session secret, admin account, Resend, and Paystack keys. Secrets belong only in environment variables; none are committed to this repository.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_URL_UNPOOLED` | Unpooled Postgres URL when required by your host |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin user created on seed |
| `RESEND_API_KEY` / `EMAIL_FROM` | Outbound email |
| `RESEND_ADMIN_EMAIL` | Admin notification recipient |
| `PAYSTACK_SECRET_KEY` / `PAYSTACK_PUBLIC_KEY` | Payments |
| `APP_ORIGIN` | Public site origin (e.g. `http://localhost:3000`) |

## License

MIT. See [LICENSE](LICENSE).
