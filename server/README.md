# CCIS Ticket Automation Backend

Admin-focused Node/Express backend that provisions 1,196 seats for an initial event, generates signed QR codes, manages event metadata (posters, schedules), and runs an SMTP-backed bulk email queue.

## Prerequisites

- Node.js 18+
- MySQL 8+ (or MariaDB)
- An SMTP account (e.g. SendGrid, Mailgun) for outbound email

## 1. Install dependencies

```cmd
cd server
npm install
```

## 2. Configure environment variables

Copy `.env.example` to `.env` and adjust credentials:

```cmd
copy .env.example .env
```

Set `QR_SECRET` to a random 32+ character string and supply SMTP credentials.

## 3. Create the schema

Log into MySQL and execute the schema file:

```sql
SOURCE /absolute/path/to/server/db/schema.sql;
```

This provisions the `ccis_ticketing` database and all required tables.

## 4. Generate the demo event and seats

```cmd
npm run generate:seats
```

This inserts an example event with exactly 1,196 seats across realistic row patterns.

## 5. Run the API server

```cmd
npm start
```

The API listens on `http://localhost:4000` by default. Key endpoints:

- `GET /api/admin/events` – list events with poster URLs and scheduling metadata
- `POST /api/admin/events` – create event (`multipart/form-data` with optional `poster` file)
- `PUT /api/admin/events/:id` – update event details or poster (also `multipart/form-data`)
- `GET /api/admin/events/:id/seats` – seat map
- `POST /api/admin/events/:id/auto-assign` – reserve contiguous seats
- `POST /api/admin/tickets/create` – issue ticket, mark seat sold, store QR payload
- `POST /api/admin/emails/bulk` – enqueue bulk emails **and** auto-assign the next available seats for the specified event (requires `event_id`, returns queued ticket details with seat + QR code).
- `POST /api/scanner/verify-qr` – validate QR scans and mark tickets used

Uploaded posters are served from `/uploads/posters/...`. Ensure the `server/uploads/posters` directory is writable by the process.

## 6. Start the email worker

Run in a second terminal to process the queue continuously:

```cmd
npm run worker
```

The worker batches up to 200 pending emails, marks their status, and retries failures.

## 7. Maintenance notes

- Release expired reservations periodically:
  ```sql
  UPDATE seats SET status='available', reserved_token=NULL, reserved_until=NULL
  WHERE status='reserved' AND reserved_until < NOW();
  ```
- Align SMTP rate limits with batch size; adjust in `lib/emailWorker.js` if needed.
- Always keep `QR_SECRET` confidential and rotate if compromised.
- Back up the `uploads/` directory alongside the database to retain event posters.

## 8. Frontend pairing (optional)

Pair this API with a React admin UI for seat visualization and QR scanning. Components outlined in the project brief can consume the endpoints above.
