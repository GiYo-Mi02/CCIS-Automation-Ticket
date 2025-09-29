# CCIS Ticketing Admin UI

React + Vite frontend for the CCIS ticket automation backend. Provides an admin console for managing events, seating, bulk emailing, and ticket scanning.

## Features

- Manage events with poster uploads, scheduling, and capacity controls.
- Seat map visualization with availability stats.
- Contiguous seat reservation workflow for manual assignments.
- Bulk email queueing via CSV uploads or manual recipient entry.
- QR code scanner powered by `html5-qrcode` for ticket validation.
- Tailwind CSS styling with responsive layout.

## Getting started

1. Install dependencies:

   ```cmd
   cd client
   npm install
   ```

2. Configure environment variables:

   ```cmd
   copy .env.example .env
   ```

   - `VITE_API_BASE_URL` – URL of the running backend (defaults to `http://localhost:4000`).
   - `VITE_DEFAULT_EVENT_ID` – Event to load on startup.

3. Run the development server:

   ```cmd
   npm run dev
   ```

   Vite serves the app on `http://localhost:5173`. API requests to `/api/*` are proxied to `VITE_API_BASE_URL`.

4. Build for production:

   ```cmd
   npm run build
   npm run preview
   ```

## Events management

Visit `/events` to create or update events. The form supports:

- Poster uploads (max 5MB, served via the backend `/uploads` route).
- Start/end schedules (optional) and capacity updates.
- Rich descriptions shown on the admin dashboard.

## Email queue input formats

You can combine CSV uploads **and** manual entries in the bulk email widget. Each recipient line should follow:

```
email,name,ticketData
```

Name and ticket data are optional. Example manual entries:

```
user1@example.com,Jane Smith,Row A Seat 10
user2@example.com
```

## Tailwind CSS

Tailwind utilities are available across the project. Modify `tailwind.config.js` to adjust themes or extend the design system. Global styles live in `src/index.css`.
