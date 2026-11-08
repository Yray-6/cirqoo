# Open Tickets

An event ticketing app built with Next.js. Guests can browse a published event, hold seats, pay by card, and receive QR tickets by email. Staff can manage events, scan tickets, send reminders, and handle discounts from an admin panel.

## Features

- Public event page and multi-step checkout
- Inventory holds with timed release
- Card payments and webhook confirmation
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

Copy [`.env.example`](.env.example) and replace every value with your own. Every entry in that file is an example placeholder (`YOUR_API_KEY_HERE`, `admin@example.com`, and so on). Secrets belong only in environment variables; none are committed to this repository.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `DATABASE_URL_UNPOOLED` | Unpooled Postgres URL when required by your host |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | First admin user created on seed |
| `RESEND_API_KEY` / `EMAIL_FROM` | Outbound email |
| `RESEND_ADMIN_EMAIL` | Admin notification recipient |
| `PAYMENT_SECRET_KEY` / `PAYMENT_PUBLIC_KEY` | Card payment provider keys |
| `PAYMENT_API_BASE` | Payment API base URL |
| `PAYMENT_WEBHOOK_HEADER` | Header name for webhook signatures |
| `APP_ORIGIN` | Public site origin (e.g. `http://localhost:3000`) |

## License

MIT. See [LICENSE](LICENSE).
