const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const { v4: uuidv4 } = require("uuid");
const pool = require("../lib/db");
const { signPayload, generateQrDataUrl } = require("../lib/qr");
const { processPendingEmails } = require("../lib/emailWorker");

const router = express.Router();
const ANALYTICS_REFRESH_MS = Number(process.env.ANALYTICS_REFRESH_MS || 5000);

const DEFAULT_EMAIL_TEMPLATE = `<!doctype html>
<p>Hi {{name}},</p>
<p>Here are your ticket details for <strong>{{event}}</strong>:</p>
<ul>
  <li><strong>Seat:</strong> {{seat}}</li>
  <li><strong>Ticket Code:</strong> {{ticket_code}}</li>
  <li><strong>Starts:</strong> {{event_starts}}</li>
</ul>
<p>Present this QR code at the entrance:</p>
<p><img src="cid:{{qr_cid}}" alt="Ticket QR Code" style="max-width:240px;" /></p>
<p>If you have any questions, reply to this email. See you there!</p>`;

const DEFAULT_SUBJECT_TEMPLATE = "Your Ticket for {{event}}";

const posterDir = path.join(__dirname, "..", "uploads", "posters");
fs.mkdirSync(posterDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, posterDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".png";
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Poster must be an image"));
    }
    cb(null, true);
  },
});

function parseDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseNumberOrNull(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function slugify(value) {
  if (!value || typeof value !== "string") return "event";
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .substring(0, 80) || "event"
  );
}

function toIsoString(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatSeat(attendee) {
  const { section, row_label: rowLabel, seat_number: seatNumber } = attendee;
  if (section || rowLabel || seatNumber) {
    const parts = [];
    if (section) parts.push(`Section ${section}`);
    if (rowLabel) parts.push(`Row ${rowLabel}`);
    if (seatNumber) parts.push(`Seat ${seatNumber}`);
    return parts.join(" ");
  }
  return "Unassigned";
}

async function buildAnalyticsSnapshot() {
  const now = new Date();

  const [events] = await pool.query(
    `SELECT id, name, description, poster_url, starts_at, ends_at, capacity, created_at
       FROM events
      ORDER BY starts_at IS NULL, starts_at ASC, created_at DESC`
  );

  const [seatRows] = await pool.query(
    `SELECT event_id, status, COUNT(*) AS count
       FROM seats
      GROUP BY event_id, status`
  );

  const [ticketRows] = await pool.query(
    `SELECT event_id, status, COUNT(*) AS count, COALESCE(SUM(price), 0) AS revenue
       FROM tickets
      GROUP BY event_id, status`
  );

  const [checkinBuckets] = await pool.query(
    `SELECT event_id,
            DATE_FORMAT(used_at, '%Y-%m-%d %H:%i:00') AS bucket,
            COUNT(*) AS count
       FROM tickets
      WHERE status = 'used'
        AND used_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      GROUP BY event_id, bucket
      ORDER BY bucket ASC`
  );

  const [checkinsLastFive] = await pool.query(
    `SELECT event_id, COUNT(*) AS count
       FROM tickets
      WHERE status = 'used'
        AND used_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
      GROUP BY event_id`
  );

  const [emailQueueRows] = await pool.query(
    `SELECT status, COUNT(*) AS count
       FROM email_queue
      GROUP BY status`
  );

  const seatByEvent = seatRows.reduce((acc, row) => {
    const eventId = row.event_id;
    if (!acc[eventId]) {
      acc[eventId] = { available: 0, reserved: 0, sold: 0, blocked: 0 };
    }
    const statusKey =
      row.status && acc[eventId][row.status] !== undefined
        ? row.status
        : "available";
    acc[eventId][statusKey] = Number(row.count) || 0;
    return acc;
  }, {});

  const ticketByEvent = ticketRows.reduce((acc, row) => {
    const eventId = row.event_id;
    if (!acc[eventId]) {
      acc[eventId] = {
        total: 0,
        active: 0,
        used: 0,
        cancelled: 0,
        revenue: 0,
      };
    }
    const statusKey = row.status;
    const count = Number(row.count) || 0;
    acc[eventId].total += count;
    if (statusKey && acc[eventId][statusKey] !== undefined) {
      acc[eventId][statusKey] += count;
    }
    acc[eventId].revenue += Number(row.revenue) || 0;
    return acc;
  }, {});

  const checkinsHistoryByEvent = checkinBuckets.reduce((acc, row) => {
    const eventId = row.event_id;
    if (!acc[eventId]) {
      acc[eventId] = [];
    }
    const isoBucket = row.bucket
      ? `${row.bucket.replace(" ", "T")}.000Z`
      : null;
    acc[eventId].push({
      bucket: isoBucket,
      count: Number(row.count) || 0,
    });
    return acc;
  }, {});

  const checkinsLastFiveByEvent = checkinsLastFive.reduce((acc, row) => {
    acc[row.event_id] = Number(row.count) || 0;
    return acc;
  }, {});

  const queueSummary = emailQueueRows.reduce(
    (acc, row) => {
      const statusKey = row.status || "pending";
      acc[statusKey] = Number(row.count) || 0;
      return acc;
    },
    { pending: 0, sending: 0, sent: 0, failed: 0 }
  );

  let totalCapacity = 0;
  let totalSeatsAvailable = 0;
  let totalSeatsReserved = 0;
  let totalSeatsSold = 0;
  let totalSeatsBlocked = 0;
  let totalTicketsActive = 0;
  let totalTicketsUsed = 0;
  let totalTicketsCancelled = 0;
  let totalRevenue = 0;
  let totalCheckinsLastHour = 0;
  let totalCheckinsLastFive = 0;

  const eventsSummary = events.map((event) => {
    const seatCounts = {
      available: seatByEvent[event.id]?.available || 0,
      reserved: seatByEvent[event.id]?.reserved || 0,
      sold: seatByEvent[event.id]?.sold || 0,
      blocked: seatByEvent[event.id]?.blocked || 0,
    };

    const ticketCounts = {
      total: ticketByEvent[event.id]?.total || 0,
      active: ticketByEvent[event.id]?.active || 0,
      used: ticketByEvent[event.id]?.used || 0,
      cancelled: ticketByEvent[event.id]?.cancelled || 0,
      revenue: ticketByEvent[event.id]?.revenue || 0,
    };

    const history = checkinsHistoryByEvent[event.id] || [];
    const checkinsLastHour = history.reduce((sum, item) => sum + item.count, 0);
    const checkinsLastFive = checkinsLastFiveByEvent[event.id] || 0;

    totalCapacity += event.capacity || 0;
    totalSeatsAvailable += seatCounts.available;
    totalSeatsReserved += seatCounts.reserved;
    totalSeatsSold += seatCounts.sold;
    totalSeatsBlocked += seatCounts.blocked;
    totalTicketsActive += ticketCounts.active;
    totalTicketsUsed += ticketCounts.used;
    totalTicketsCancelled += ticketCounts.cancelled;
    totalRevenue += ticketCounts.revenue;
    totalCheckinsLastHour += checkinsLastHour;
    totalCheckinsLastFive += checkinsLastFive;

    const engaged = ticketCounts.active + ticketCounts.used;
    const occupancy = event.capacity
      ? Math.min(1, engaged / event.capacity)
      : null;

    return {
      id: event.id,
      name: event.name,
      description: event.description,
      posterUrl: event.poster_url,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      capacity: event.capacity,
      seats: seatCounts,
      tickets: ticketCounts,
      occupancy,
      checkIns: {
        lastFiveMinutes: checkinsLastFive,
        lastHour: checkinsLastHour,
        history,
      },
    };
  });

  return {
    generatedAt: now.toISOString(),
    totals: {
      events: events.length,
      capacity: totalCapacity,
      seats: {
        available: totalSeatsAvailable,
        reserved: totalSeatsReserved,
        sold: totalSeatsSold,
        blocked: totalSeatsBlocked,
      },
      tickets: {
        active: totalTicketsActive,
        used: totalTicketsUsed,
        cancelled: totalTicketsCancelled,
        total: totalTicketsActive + totalTicketsUsed + totalTicketsCancelled,
      },
      revenue: totalRevenue,
      checkIns: {
        lastHour: totalCheckinsLastHour,
        lastFiveMinutes: totalCheckinsLastFive,
      },
    },
    queue: queueSummary,
    events: eventsSummary,
  };
}

async function fetchEventWithAttendees(eventId) {
  const [[event]] = await pool.query(
    "SELECT id, name, starts_at, ends_at FROM events WHERE id = ?",
    [eventId]
  );

  if (!event) {
    return null;
  }

  const [attendees] = await pool.query(
    `SELECT t.id, t.ticket_code, t.user_email, t.price, t.created_at, s.section, s.row_label, s.seat_number
     FROM tickets t
     LEFT JOIN seats s ON t.seat_id = s.id
     WHERE t.event_id = ?
     ORDER BY t.created_at DESC, t.id DESC`,
    [eventId]
  );

  return { event, attendees };
}

function buildCsv(attendees) {
  const headers = ["Email", "Ticket Code", "Seat", "Price", "Issued At"];
  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value).replace(/"/g, '""');
    return /[",\n]/.test(str) ? `"${str}"` : str;
  };

  const lines = [headers.map(escape).join(",")];
  for (const attendee of attendees) {
    lines.push(
      [
        attendee.user_email || "",
        attendee.ticket_code || "",
        formatSeat(attendee),
        attendee.price != null ? attendee.price : "",
        toIsoString(attendee.created_at),
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\n");
}

async function buildExcel(attendees) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendees");

  sheet.columns = [
    { header: "Email", key: "email", width: 35 },
    { header: "Ticket Code", key: "ticketCode", width: 25 },
    { header: "Seat", key: "seat", width: 30 },
    { header: "Price", key: "price", width: 10 },
    { header: "Issued At", key: "issuedAt", width: 25 },
  ];

  for (const attendee of attendees) {
    sheet.addRow({
      email: attendee.user_email || "",
      ticketCode: attendee.ticket_code || "",
      seat: formatSeat(attendee),
      price: attendee.price != null ? attendee.price : "",
      issuedAt: toIsoString(attendee.created_at),
    });
  }

  sheet.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function buildPdf(event, attendees, res, filename) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.pdf"`
  );

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(res);

  doc.fontSize(18).text("Attendee List", { align: "left" });
  doc.moveDown(0.5);
  doc.fontSize(12).text(`Event: ${event.name || ""}`);
  if (event.starts_at) {
    doc.text(`Starts: ${new Date(event.starts_at).toLocaleString()}`);
  }
  doc.moveDown();

  if (attendees.length === 0) {
    doc.text("No attendees yet.");
    doc.end();
    return;
  }

  attendees.forEach((attendee, idx) => {
    doc.fontSize(12).text(`${idx + 1}. ${attendee.user_email || ""}`);
    doc.fontSize(11).text(`   Ticket: ${attendee.ticket_code || ""}`);
    doc.text(`   Seat: ${formatSeat(attendee)}`);
    doc.text(
      `   Price: ${
        attendee.price != null && attendee.price !== "" ? attendee.price : "N/A"
      }`
    );
    doc.text(`   Issued: ${toIsoString(attendee.created_at) || ""}`);
    doc.moveDown(0.5);
  });

  doc.end();
}

async function listEvents(req, res, next) {
  try {
    const [events] = await pool.query(
      "SELECT id, name, description, poster_url, starts_at, ends_at, performance_at, capacity, created_at FROM events ORDER BY starts_at IS NULL, starts_at DESC, created_at DESC"
    );
    res.json(events);
  } catch (err) {
    next(err);
  }
}

async function createEvent(req, res, next) {
  const { name, description, starts_at, ends_at, capacity } = req.body;
  const cleanName = typeof name === "string" ? name.trim() : "";

  if (!cleanName) {
    return res.status(400).json({ error: "Event name is required" });
  }

  const startsAt = parseDateOrNull(starts_at);
  const endsAt = parseDateOrNull(ends_at);
  const capacityValue = parseNumberOrNull(capacity);
  const finalCapacity = capacityValue ?? 1196;
  const posterUrl = req.file
    ? `/uploads/posters/${req.file.filename}`
    : req.body.poster_url || null;

  try {
    const [result] = await pool.query(
      "INSERT INTO events (name, description, poster_url, starts_at, ends_at, performance_at, capacity) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        cleanName,
        description || null,
        posterUrl,
        startsAt,
        endsAt,
        startsAt,
        finalCapacity,
      ]
    );

    res.status(201).json({
      id: result.insertId,
      name: cleanName,
      description: description || null,
      poster_url: posterUrl,
      starts_at: startsAt,
      ends_at: endsAt,
      performance_at: startsAt,
      capacity: finalCapacity,
    });
  } catch (err) {
    next(err);
  }
}

async function updateEvent(req, res, next) {
  const { id } = req.params;
  const { name, description, starts_at, ends_at, capacity } = req.body;
  const startsAt = parseDateOrNull(starts_at);
  const endsAt = parseDateOrNull(ends_at);
  const capacityValue = parseNumberOrNull(capacity);
  const providedName =
    name !== undefined && typeof name === "string" ? name.trim() : name;
  if (providedName !== undefined && providedName === "") {
    return res.status(400).json({ error: "Event name cannot be empty" });
  }

  try {
    const [[existing]] = await pool.query(
      "SELECT poster_url, performance_at, capacity, name, description, starts_at, ends_at FROM events WHERE id = ?",
      [id]
    );

    if (!existing) {
      return res.status(404).json({ error: "Event not found" });
    }

    let posterUrl = existing.poster_url;
    if (req.file) {
      posterUrl = `/uploads/posters/${req.file.filename}`;
      if (existing.poster_url && existing.poster_url.startsWith("/uploads/")) {
        const previousPath = path.join(
          __dirname,
          "..",
          existing.poster_url.replace(/^\/+/, "")
        );
        fs.unlink(previousPath, () => undefined);
      }
    } else if (req.body.poster_url === "") {
      posterUrl = null;
    }

    const nextName = providedName ?? existing.name;
    const nextDescription = description ?? existing.description;
    const nextStartsAt = startsAt ?? existing.starts_at;
    const nextEndsAt = endsAt ?? existing.ends_at;
    const nextCapacity = capacityValue ?? existing.capacity;
    const nextPerformanceAt = nextStartsAt || existing.performance_at;

    await pool.query(
      "UPDATE events SET name = ?, description = ?, poster_url = ?, starts_at = ?, ends_at = ?, performance_at = ?, capacity = ? WHERE id = ?",
      [
        nextName,
        nextDescription,
        posterUrl,
        nextStartsAt,
        nextEndsAt,
        nextPerformanceAt,
        nextCapacity,
        id,
      ]
    );

    res.json({
      id: Number(id),
      name: nextName,
      description: nextDescription,
      poster_url: posterUrl,
      starts_at: nextStartsAt,
      ends_at: nextEndsAt,
      performance_at: nextPerformanceAt,
      capacity: nextCapacity,
    });
  } catch (err) {
    next(err);
  }
}

router.get("/events", listEvents);
router.post("/events", upload.single("poster"), createEvent);
router.put("/events/:id", upload.single("poster"), updateEvent);

router.get("/analytics/overview", async (_req, res, next) => {
  try {
    const snapshot = await buildAnalyticsSnapshot();
    res.json(snapshot);
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/stream", async (req, res, next) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders && res.flushHeaders();

  let closed = false;

  const sendSnapshot = async () => {
    if (closed) return;
    try {
      const snapshot = await buildAnalyticsSnapshot();
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } catch (err) {
      console.error("analytics stream error", err);
      res.write(`event: error\n`);
      res.write(
        `data: ${JSON.stringify({ error: err.message || "failed" })}\n\n`
      );
    }
  };

  const interval = setInterval(sendSnapshot, ANALYTICS_REFRESH_MS);

  req.on("close", () => {
    closed = true;
    clearInterval(interval);
  });

  req.on("end", () => {
    closed = true;
    clearInterval(interval);
  });

  sendSnapshot().catch((err) => {
    closed = true;
    clearInterval(interval);
    next(err);
  });
});

router.get("/events/:id/attendees/export.csv", async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (!eventId) {
      return res.status(400).json({ error: "Invalid event id" });
    }

    const result = await fetchEventWithAttendees(eventId);
    if (!result) {
      return res.status(404).json({ error: "Event not found" });
    }

    const { event, attendees } = result;
    const csv = buildCsv(attendees);
    const filename = `${slugify(event.name)}-attendees`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.csv"`
    );
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.get("/events/:id/attendees/export.xlsx", async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (!eventId) {
      return res.status(400).json({ error: "Invalid event id" });
    }

    const result = await fetchEventWithAttendees(eventId);
    if (!result) {
      return res.status(404).json({ error: "Event not found" });
    }

    const { event, attendees } = result;
    const buffer = await buildExcel(attendees);
    const filename = `${slugify(event.name)}-attendees`;

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${filename}.xlsx"`
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.get("/events/:id/attendees/export.pdf", async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    if (!eventId) {
      return res.status(400).json({ error: "Invalid event id" });
    }

    const result = await fetchEventWithAttendees(eventId);
    if (!result) {
      return res.status(404).json({ error: "Event not found" });
    }

    const { event, attendees } = result;
    const filename = `${slugify(event.name)}-attendees`;
    buildPdf(event, attendees, res, filename);
  } catch (err) {
    next(err);
  }
});

router.get("/events/:id/seats", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, section, row_label, seat_number, row_idx, col_idx, status FROM seats WHERE event_id = ? ORDER BY row_idx, col_idx",
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/events/:id/auto-assign", async (req, res, next) => {
  const { qty } = req.body;
  const eventId = req.params.id;

  if (!qty || qty < 1) {
    return res
      .status(400)
      .json({ error: "Quantity must be greater than zero" });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM seats WHERE event_id = ? AND status = "available" ORDER BY row_idx, col_idx',
      [eventId]
    );

    const seatRows = rows.reduce((acc, seat) => {
      acc[seat.row_label] = acc[seat.row_label] || [];
      acc[seat.row_label].push(seat);
      return acc;
    }, {});

    function findContiguous(arr, k) {
      let run = [];
      for (const seat of arr) {
        if (seat.status === "available") {
          run.push(seat);
          if (run.length === k) return run;
        } else {
          run = [];
        }
      }
      return null;
    }

    let found = null;
    for (const rowLabel of Object.keys(seatRows)) {
      const block = findContiguous(seatRows[rowLabel], qty);
      if (block) {
        found = block;
        break;
      }
    }

    if (!found) {
      return res.status(409).json({ error: "Cannot find contiguous block" });
    }

    const token = uuidv4();
    const reservedUntil = new Date(Date.now() + 10 * 60 * 1000);
    const seatIds = found.map((seat) => seat.id);
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const [updateResult] = await connection.query(
        'UPDATE seats SET status = "reserved", reserved_token = ?, reserved_until = ? WHERE id IN (?) AND status = "available"',
        [token, reservedUntil, seatIds]
      );

      if (updateResult.affectedRows !== seatIds.length) {
        throw new Error("Some seats were taken in parallel");
      }

      await connection.commit();
      res.json({ reserved: seatIds, reservedToken: token, reservedUntil });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
});

router.post("/tickets/create", async (req, res, next) => {
  const { event_id, seat_id, user_email, price } = req.body;

  if (!event_id || !seat_id || !user_email) {
    return res
      .status(400)
      .json({ error: "event_id, seat_id, and user_email are required" });
  }

  const ticketCode = `CCIS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  try {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [ticketResult] = await connection.query(
        "INSERT INTO tickets (ticket_code, user_email, event_id, seat_id, price) VALUES (?, ?, ?, ?, ?)",
        [ticketCode, user_email, event_id, seat_id, price || 0]
      );

      await connection.query('UPDATE seats SET status = "sold" WHERE id = ?', [
        seat_id,
      ]);

      const payload = {
        ticket_id: ticketResult.insertId,
        event_id,
        seat_id,
        issued_at: new Date().toISOString(),
        nonce: uuidv4(),
      };

      const signed = signPayload(payload);
      const dataUrl = await generateQrDataUrl(signed);

      await connection.query("UPDATE tickets SET qr_payload = ? WHERE id = ?", [
        JSON.stringify(signed),
        ticketResult.insertId,
      ]);

      await connection.commit();

      res.json({
        ticketId: ticketResult.insertId,
        ticketCode,
        qrDataUrl: dataUrl,
      });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    next(err);
  }
});

function normaliseRecipient(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    const email = entry.trim();
    return email ? { email, name: "" } : null;
  }
  if (typeof entry.email === "string" && entry.email.trim()) {
    return {
      email: entry.email.trim(),
      name: typeof entry.name === "string" ? entry.name.trim() : "",
    };
  }
  return null;
}

function interpolateTemplate(template, data) {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_match, key) => {
    const lowerKey = key.toLowerCase();
    return data[lowerKey] ?? "";
  });
}

async function fetchNextSeat(connection, eventId) {
  const [rows] = await connection.query(
    'SELECT id, section, row_label, seat_number, row_idx, col_idx FROM seats WHERE event_id = ? AND status = "available" ORDER BY row_idx, col_idx LIMIT 1 FOR UPDATE',
    [eventId]
  );
  if (rows.length === 0) {
    const err = new Error("Not enough available seats for all recipients");
    err.status = 409;
    throw err;
  }
  return rows[0];
}

async function createTicketWithQr(connection, { eventId, seat, email }) {
  const ticketCode = `CCIS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const [ticketResult] = await connection.query(
    "INSERT INTO tickets (ticket_code, user_email, event_id, seat_id, price) VALUES (?, ?, ?, ?, ?)",
    [ticketCode, email, eventId, seat.id, 0]
  );

  await connection.query('UPDATE seats SET status = "sold" WHERE id = ?', [
    seat.id,
  ]);

  const payload = {
    ticket_id: ticketResult.insertId,
    event_id: eventId,
    seat_id: seat.id,
    issued_at: new Date().toISOString(),
    nonce: uuidv4(),
  };

  const signed = signPayload(payload);
  const qrDataUrl = await generateQrDataUrl(signed);
  await connection.query("UPDATE tickets SET qr_payload = ? WHERE id = ?", [
    JSON.stringify(signed),
    ticketResult.insertId,
  ]);

  return { ticketCode, qrDataUrl };
}

router.post("/emails/bulk", async (req, res, next) => {
  const { list, subject, bodyTemplate, event_id } = req.body;

  if (!Array.isArray(list) || list.length === 0) {
    return res.status(400).json({ error: "list must be a non-empty array" });
  }

  const recipients = list
    .map((entry) => normaliseRecipient(entry))
    .filter(Boolean);

  if (recipients.length === 0) {
    return res
      .status(400)
      .json({ error: "No valid recipient emails were provided" });
  }

  const eventId = Number(event_id);
  if (!eventId) {
    return res.status(400).json({ error: "event_id is required" });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [[event]] = await connection.query(
      "SELECT id, name, starts_at, ends_at FROM events WHERE id = ?",
      [eventId]
    );

    if (!event) {
      const err = new Error("Event not found");
      err.status = 404;
      throw err;
    }

    let queued = 0;
    const details = [];
    const template =
      typeof bodyTemplate === "string" && bodyTemplate.trim()
        ? bodyTemplate
        : DEFAULT_EMAIL_TEMPLATE;
    const subjectTemplate =
      typeof subject === "string" && subject.trim()
        ? subject
        : DEFAULT_SUBJECT_TEMPLATE;

    for (const person of recipients) {
      const seat = await fetchNextSeat(connection, eventId);

      const { ticketCode, qrDataUrl } = await createTicketWithQr(connection, {
        eventId,
        seat,
        email: person.email,
      });

      const seatLabel = `Section ${seat.section} Row ${seat.row_label} Seat ${seat.seat_number}`;
      const qrCid = `qr-${ticketCode}@ccis.dev`;

      const templateData = {
        name: person.name || "Guest",
        email: person.email,
        event: event.name || "",
        seat: seatLabel,
        ticket_code: ticketCode,
        qr_data_url: qrDataUrl,
        qr_cid: qrCid,
        event_starts: event.starts_at
          ? new Date(event.starts_at).toLocaleString()
          : "",
      };

      const body = interpolateTemplate(template, {
        ...templateData,
        ticket: `${seatLabel}\nTicket Code: ${ticketCode}`,
      });

      const resolvedSubject = interpolateTemplate(
        subjectTemplate,
        templateData
      );

      const [, base64] = qrDataUrl.split(",");
      const attachments = [
        {
          filename: `${ticketCode}.png`,
          content: base64,
          encoding: "base64",
          contentType: "image/png",
          cid: qrCid,
        },
      ];

      await connection.query(
        "INSERT INTO email_queue (to_email, subject, body, attachments, status) VALUES (?, ?, ?, ?, 'pending')",
        [person.email, resolvedSubject, body, JSON.stringify(attachments)]
      );

      queued += 1;
      details.push({ email: person.email, seat: seatLabel, ticketCode });
    }

    await connection.commit();
    res.json({ queued, details });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {}

    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }

    next(err);
  } finally {
    connection.release();
  }
});

router.post("/emails/send-now", async (req, res, next) => {
  const limit = Math.min(
    500,
    Math.max(1, Number.parseInt(req.body?.limit, 10) || 200)
  );
  try {
    const result = await processPendingEmails(limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
