const express = require("express");
const pool = require("../lib/db");
const { verifySignedPayload } = require("../lib/qr");

const router = express.Router();

function buildSeatLabel(seat) {
  if (!seat) return null;
  const parts = [];
  if (seat.section) parts.push(`Section ${seat.section}`);
  if (seat.row_label) parts.push(`Row ${seat.row_label}`);
  if (seat.seat_number !== null && seat.seat_number !== undefined) {
    parts.push(`Seat ${seat.seat_number}`);
  }
  return parts.join(" · ") || null;
}

router.post("/verify-qr", async (req, res, next) => {
  const { qr } = req.body || {};

  if (!qr) {
    return res.status(400).json({ error: "QR payload missing" });
  }

  let parsed;
  try {
    parsed = JSON.parse(qr);
  } catch (err) {
    return res.status(400).json({ error: "QR code is not valid JSON" });
  }

  if (!verifySignedPayload(parsed)) {
    return res.status(400).json({ error: "Ticket signature is invalid" });
  }

  const ticketId = parsed.p.ticket_id;

  try {
    const [[ticket]] = await pool.query(
      `SELECT t.id, t.ticket_code, t.status, t.user_email, t.user_name, t.used_at, t.event_id, t.seat_id,
              e.name AS event_name,
              s.section, s.row_label, s.seat_number
         FROM tickets t
         LEFT JOIN events e ON e.id = t.event_id
         LEFT JOIN seats s ON s.id = t.seat_id
        WHERE t.id = ?
        LIMIT 1`,
      [ticketId]
    );

    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (ticket.status === "used") {
      return res.status(409).json({
        error: ticket.used_at
          ? `Ticket already used at ${new Date(
              ticket.used_at
            ).toLocaleString()}`
          : "Ticket already used",
        ticketId: ticket.id,
        ticketCode: ticket.ticket_code,
        attendee: ticket.user_email,
        attendeeName: ticket.user_name || null,
        eventName: ticket.event_name || null,
        seatLabel: buildSeatLabel(ticket),
      });
    }

    if (ticket.status === "cancelled") {
      return res.status(409).json({
        error: "Ticket has been cancelled",
        ticketId: ticket.id,
        ticketCode: ticket.ticket_code,
        attendee: ticket.user_email,
        attendeeName: ticket.user_name || null,
        eventName: ticket.event_name || null,
        seatLabel: buildSeatLabel(ticket),
      });
    }

    if (ticket.status !== "active") {
      return res.status(409).json({ error: "Ticket is not valid" });
    }

    const usedAt = new Date();
    await pool.query(
      'UPDATE tickets SET status = "used", used_at = ? WHERE id = ?',
      [usedAt, ticketId]
    );

    res.json({
      ok: true,
      message: "Ticket accepted",
      ticketId: ticket.id,
      ticketCode: ticket.ticket_code,
      attendee: ticket.user_email,
      attendeeName: ticket.user_name || null,
      eventName: ticket.event_name || null,
      seatLabel: buildSeatLabel(ticket),
      usedAt: usedAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
